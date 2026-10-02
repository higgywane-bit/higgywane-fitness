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
    type: text("type").notNull(),
    message: text("message").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_member_idx").on(t.memberId, t.at)],
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

export type Member = typeof members.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
export type CheckInRow = typeof checkIns.$inferSelect;
export type SaleRow = typeof sales.$inferSelect;
export type ActivityRow = typeof activity.$inferSelect;
export type ReportUpload = typeof reportUploads.$inferSelect;
