import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Superfit members database (Postgres).
 * Money: memberships store whole THB (like pricing.json); POS sales store satang
 * because cafe receipts can carry cents.
 */

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const members = pgTable(
  "members",
  {
    id: id(),
    /** short human number for the front desk: #1042 */
    memberNo: integer("member_no").notNull().generatedAlwaysAsIdentity({ startWith: 1001 }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    nickname: text("nickname"),
    email: text("email"),
    phone: text("phone"),
    lineId: text("line_id"),
    birthDate: date("birth_date"),
    gender: text("gender"),
    emergencyContact: text("emergency_contact"),
    notes: text("notes"),
    photoUrl: text("photo_url"),
    /** admin | glofox | app | demo */
    source: text("source").notNull().default("admin"),
    /** id in the system we imported from (Glofox member id) */
    externalId: text("external_id"),
    /** secret for the member's pass link: /pass/<token> */
    passToken: text("pass_token").notNull().unique(),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(true),
    /** free labels for segments: student, vip, staff, competitor… */
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("members_member_no_idx").on(t.memberNo),
    index("members_email_idx").on(sql`lower(${t.email})`),
    index("members_phone_idx").on(t.phone),
    uniqueIndex("members_external_idx").on(t.source, t.externalId),
  ],
);

/** Anything that gets a member through the door: their phone QR, or an old Glofox card. */
export const credentials = pgTable(
  "credentials",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    /** qr | card */
    kind: text("kind").notNull(),
    /** normalised (see lib/membership/codes.ts) */
    code: text("code").notNull().unique(),
    createdAt: createdAt(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("credentials_member_idx").on(t.memberId)],
);

/** A plan a member bought: gym access between two dates, or a PT pack. */
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull(),
    planName: text("plan_name").notNull(),
    /** membership | pt */
    kind: text("kind").$type<"membership" | "pt">().notNull(),
    startsOn: date("starts_on").notNull(),
    /** inclusive */
    endsOn: date("ends_on").notNull(),
    sessionsTotal: integer("sessions_total"),
    sessionsUsed: integer("sessions_used").notNull().default(0),
    /** THB actually paid (after any discount) */
    price: integer("price").notNull().default(0),
    /** cash | qashier | promptpay | transfer | card | comp | glofox */
    paymentMethod: text("payment_method").notNull().default("cash"),
    /** receipt / Qashier transaction number */
    paymentRef: text("payment_ref"),
    frozenFrom: date("frozen_from"),
    frozenUntil: date("frozen_until"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    source: text("source").notNull().default("admin"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("memberships_member_idx").on(t.memberId), index("memberships_ends_idx").on(t.endsOn)],
);

/** Every scan, allowed or not. Denied scans of unknown codes keep the raw code. */
export const checkIns = pgTable(
  "check_ins",
  {
    id: id(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    membershipId: uuid("membership_id").references(() => memberships.id, { onDelete: "set null" }),
    code: text("code"),
    /** scan | camera | typed | search */
    method: text("method").notNull(),
    allowed: boolean("allowed").notNull(),
    /** DenyReason when not allowed */
    reason: text("reason"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("check_ins_at_idx").on(t.at), index("check_ins_member_idx").on(t.memberId, t.at)],
);

/** Till sales, mostly from Qashier (CSV export now, API/webhook later). */
export const sales = pgTable(
  "sales",
  {
    id: id(),
    /** qashier | manual | demo */
    source: text("source").notNull(),
    /** receipt number in the source system; makes re-imports safe */
    externalId: text("external_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    amountSatang: integer("amount_satang").notNull(),
    /** membership | pt | cafe | retail | other */
    category: text("category").notNull().default("other"),
    description: text("description"),
    paymentMethod: text("payment_method"),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    items: jsonb("items").$type<{ name: string; qty: number; amountSatang: number }[]>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sales_external_idx").on(t.source, t.externalId), index("sales_at_idx").on(t.occurredAt)],
);

/** Member timeline + staff accountability. */
export const activity = pgTable(
  "activity",
  {
    id: id(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    /** who did it (the staff member working at the time) */
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_member_idx").on(t.memberId, t.at), index("activity_at_idx").on(t.at), index("activity_lead_idx").on(t.leadId)],
);

/** One row per reminder sent, so the daily job never emails twice. */
export const reminders = pgTable(
  "reminders",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    /** the end date the reminder was about */
    endsOn: date("ends_on").notNull(),
    /** e.g. before-7, before-1, after-3 */
    kind: text("kind").notNull(),
    channel: text("channel").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reminders_once_idx").on(t.memberId, t.endsOn, t.kind)],
);

/** Small key/value store for admin preferences shared by every device (e.g. dashboard layout). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Reports uploaded for the Insights area (Glofox exports today, anything CSV later).
 * Rows are kept as uploaded so they can be re-analysed any way, any time.
 */
export const reportUploads = pgTable(
  "report_uploads",
  {
    id: id(),
    /** glofox | qashier | other */
    source: text("source").notNull().default("glofox"),
    /** transactions | attendance | members | memberships | generic (detected, can be changed) */
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    fileName: text("file_name"),
    headers: jsonb("headers").$type<string[]>().notNull(),
    rows: jsonb("rows").$type<string[][]>().notNull(),
    rowCount: integer("row_count").notNull(),
    /** first/last date found in the report, for the list view */
    dateFrom: date("date_from"),
    dateTo: date("date_to"),
    notes: text("notes"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("report_uploads_kind_idx").on(t.kind, t.uploadedAt)],
);

/* ── Team ─────────────────────────────────────────────────── */

export type StaffRole = "owner" | "manager" | "desk" | "coach" | "cafe";

export const staff = pgTable("staff", {
  id: id(),
  name: text("name").notNull(),
  role: text("role").$type<StaffRole>().notNull(),
  email: text("email"),
  phone: text("phone"),
  /** sha-256 of the 4–6 digit PIN used to switch "who's working" at shared devices */
  pinHash: text("pin_hash"),
  /** links a coach to their public profile in content/coaches.ts */
  coachSlug: text("coach_slug"),
  /** THB per hour, for wage estimates */
  hourlyRate: integer("hourly_rate"),
  /** % of PT pack price paid to the coach per session delivered */
  ptCommissionPct: integer("pt_commission_pct"),
  color: text("color"),
  active: boolean("active").notNull().default(true),
  demo: boolean("demo").notNull().default(false),
  createdAt: createdAt(),
});

/** Planned shifts on the rota. Times are gym-local HH:MM. */
export const shifts = pgTable(
  "shifts",
  {
    id: id(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    start: text("start").notNull(),
    end: text("end").notNull(),
    /** desk | cafe | floor | pt | cleaning */
    area: text("area").notNull().default("desk"),
    notes: text("notes"),
  },
  (t) => [index("shifts_date_idx").on(t.date)],
);

/** Clock in / clock out. An open entry has no clockOut. */
export const timeEntries = pgTable(
  "time_entries",
  {
    id: id(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    clockIn: timestamp("clock_in", { withTimezone: true }).notNull(),
    clockOut: timestamp("clock_out", { withTimezone: true }),
    note: text("note"),
  },
  (t) => [index("time_entries_staff_idx").on(t.staffId, t.clockIn)],
);

/* ── Sales pipeline ───────────────────────────────────────── */

export type LeadStage = "new" | "contacted" | "trial" | "won" | "lost";

export const leads = pgTable(
  "leads",
  {
    id: id(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    lineId: text("line_id"),
    /** walk-in | instagram | facebook | website | line | referral | google | other */
    source: text("source").notNull().default("walk-in"),
    /** membership | pt | day-pass | cafe | other */
    interest: text("interest").notNull().default("membership"),
    stage: text("stage").$type<LeadStage>().notNull().default("new"),
    notes: text("notes"),
    ownerId: uuid("owner_id").references(() => staff.id, { onDelete: "set null" }),
    nextFollowUp: date("next_follow_up"),
    lostReason: text("lost_reason"),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    /** made-up demo data, removed by Settings → Remove demo data */
    demo: boolean("demo").notNull().default(false),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("leads_stage_idx").on(t.stage, t.createdAt)],
);

/* ── Coaching ─────────────────────────────────────────────── */

/** One delivered (or missed) PT session, so coaches get credit and members see history. */
export const ptSessions = pgTable(
  "pt_sessions",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").references(() => memberships.id, { onDelete: "set null" }),
    coachId: uuid("coach_id").references(() => staff.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** done | no-show */
    status: text("status").notNull().default("done"),
    notes: text("notes"),
  },
  (t) => [index("pt_sessions_at_idx").on(t.at), index("pt_sessions_coach_idx").on(t.coachId, t.at)],
);

/** PT requests from the website booking form, handled by the desk or the coach. */
export const ptBookings = pgTable(
  "pt_bookings",
  {
    id: id(),
    reference: text("reference").notNull(),
    coachSlug: text("coach_slug").notNull(),
    packageId: text("package_id"),
    date: date("date").notNull(),
    time: text("time").notNull(),
    name: text("name").notNull(),
    contact: text("contact").notNull(),
    goal: text("goal"),
    note: text("note"),
    /** requested | confirmed | declined | done */
    status: text("status").notNull().default("requested"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    /** made-up demo data, removed by Settings → Remove demo data */
    demo: boolean("demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("pt_bookings_date_idx").on(t.date)],
);

/* ── Cafe ─────────────────────────────────────────────────── */

export type CafeOrderStatus = "new" | "preparing" | "ready" | "collected" | "cancelled";

/** Orders placed on the website, shown on the bar's order board. */
export const cafeOrders = pgTable(
  "cafe_orders",
  {
    /** same id the customer's confirmation page uses */
    id: uuid("id").primaryKey(),
    number: text("number").notNull(),
    status: text("status").$type<CafeOrderStatus>().notNull().default("new"),
    customerName: text("customer_name").notNull(),
    contact: text("contact"),
    /** takeaway | dine-in */
    serviceMode: text("service_mode").notNull(),
    table: text("table"),
    pickupTime: text("pickup_time"),
    note: text("note"),
    lines: jsonb("lines").$type<{ name: string; qty: number; summary: string[]; note?: string; unitPrice: number }[]>().notNull(),
    /** whole THB, like the menu */
    subtotal: integer("subtotal").notNull(),
    protein: integer("protein"),
    kcal: integer("kcal"),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").notNull(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    /** made-up demo data, removed by Settings → Remove demo data */
    demo: boolean("demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cafe_orders_created_idx").on(t.createdAt), index("cafe_orders_status_idx").on(t.status)],
);

/* ── Money out ────────────────────────────────────────────── */

export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    date: date("date").notNull(),
    /** rent | wages | cafe-stock | supplements | equipment | utilities | marketing | maintenance | software | other */
    category: text("category").notNull(),
    description: text("description").notNull(),
    vendor: text("vendor"),
    amountSatang: integer("amount_satang").notNull(),
    /** none | monthly: monthly ones repeat in profit & loss until ended */
    recurring: text("recurring").notNull().default("none"),
    endsOn: date("ends_on"),
    paymentMethod: text("payment_method"),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    /** made-up demo data, removed by Settings → Remove demo data */
    demo: boolean("demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_date_idx").on(t.date)],
);

/* ── Messages ─────────────────────────────────────────────── */

export const messages = pgTable("messages", {
  id: id(),
  /** email | line */
  channel: text("channel").notNull(),
  audience: text("audience").notNull(),
  audienceLabel: text("audience_label").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recipients: integer("recipients").notNull(),
  sent: integer("sent").notNull().default(0),
  /** sent | preview (no mail provider connected) */
  status: text("status").notNull(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
  demo: boolean("demo").notNull().default(false),
  createdAt: createdAt(),
});

export type Member = typeof members.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
export type CheckInRow = typeof checkIns.$inferSelect;
export type SaleRow = typeof sales.$inferSelect;
export type ActivityRow = typeof activity.$inferSelect;
export type ReportUpload = typeof reportUploads.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type PtSession = typeof ptSessions.$inferSelect;
export type PtBooking = typeof ptBookings.$inferSelect;
export type CafeOrderRow = typeof cafeOrders.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
