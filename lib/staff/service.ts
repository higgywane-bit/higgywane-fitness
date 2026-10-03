import { createHash } from "node:crypto";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { shifts, staff, timeEntries, type Staff } from "@/lib/db/schema";
import { isISODate } from "@/lib/membership/dates";
import { logActivity, normalizeEmail, normalizePhone, ServiceError } from "@/lib/membership/service";
import { isTime, overlaps, ROLES, type Area, type Role } from "./rules";

const COLORS = ["#e11d48", "#f5d04c", "#7cc4ff", "#34c759", "#c084fc", "#fb923c", "#2dd4bf", "#f472b6"];

export function hashPin(staffId: string, pin: string): string {
  return createHash("sha256").update(`superfit-staff:${staffId}:${pin}`).digest("hex");
}

export type StaffInput = {
  name: string;
  role: Role;
  email?: string | null;
  phone?: string | null;
  coachSlug?: string | null;
  hourlyRate?: number | null;
  ptCommissionPct?: number | null;
  pin?: string | null;
};

function values(input: StaffInput) {
  const name = input.name?.trim();
  if (!name) throw new ServiceError("Name is required.");
  if (!(input.role in ROLES)) throw new ServiceError("Pick a role.");
  if (input.pin && !/^\d{4,6}$/.test(input.pin)) throw new ServiceError("PIN must be 4 to 6 digits.");
  const num = (v: number | null | undefined, max: number) => (v == null || Number.isNaN(v) ? null : Math.max(0, Math.min(max, Math.round(v))));
  return {
    name,
    role: input.role,
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    coachSlug: input.role === "coach" ? input.coachSlug?.trim() || null : null,
    hourlyRate: num(input.hourlyRate, 100_000),
    ptCommissionPct: input.role === "coach" ? num(input.ptCommissionPct, 100) : null,
  };
}

export async function createStaff(db: DB, input: StaffInput): Promise<Staff> {
  const count = (await db.select({ id: staff.id }).from(staff)).length;
  const [row] = await db.insert(staff).values({ ...values(input), color: COLORS[count % COLORS.length] }).returning();
  if (input.pin) await db.update(staff).set({ pinHash: hashPin(row.id, input.pin) }).where(eq(staff.id, row.id));
  await logActivity(db, null, "staff.created", `${row.name} added as ${ROLES[row.role].label}`);
  return row;
}

export async function updateStaff(db: DB, id: string, input: StaffInput) {
  await db.update(staff).set(values(input)).where(eq(staff.id, id));
  if (input.pin) await db.update(staff).set({ pinHash: hashPin(id, input.pin) }).where(eq(staff.id, id));
  await logActivity(db, null, "staff.updated", `${input.name.trim()}'s details updated`);
}

export async function setStaffActive(db: DB, id: string, active: boolean) {
  const [row] = await db.update(staff).set({ active }).where(eq(staff.id, id)).returning();
  if (row) await logActivity(db, null, active ? "staff.restored" : "staff.deactivated", `${row.name} ${active ? "reactivated" : "deactivated"}`);
}

export async function verifyPin(db: DB, id: string, pin: string): Promise<Staff> {
  const [row] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  if (!row || !row.active) throw new ServiceError("That staff member isn't active.");
  if (row.pinHash && row.pinHash !== hashPin(id, pin)) throw new ServiceError("Wrong PIN.");
  return row;
}

export async function listStaff(db: DB, opts: { includeInactive?: boolean } = {}) {
  const rows = await db.select().from(staff).orderBy(staff.name);
  return opts.includeInactive ? rows : rows.filter((r) => r.active);
}

/* ── rota ── */

export type ShiftInput = { staffId: string; date: string; start: string; end: string; area: Area; notes?: string | null };

export async function addShift(db: DB, input: ShiftInput) {
  if (!isISODate(input.date)) throw new ServiceError("Pick a date.");
  if (!isTime(input.start) || !isTime(input.end)) throw new ServiceError("Times must look like 07:00.");
  if (input.start === input.end) throw new ServiceError("A shift needs a start and an end.");
  const same = await db.select().from(shifts).where(and(eq(shifts.staffId, input.staffId), eq(shifts.date, input.date)));
  if (same.some((s) => overlaps(s, input))) throw new ServiceError("That overlaps another shift for the same person.");
  const [row] = await db.insert(shifts).values({ ...input, notes: input.notes?.trim() || null }).returning();
  return row;
}

export async function removeShift(db: DB, id: string) {
  await db.delete(shifts).where(eq(shifts.id, id));
}

/** Copy last week's rota into this week (skips anything that would overlap). */
export async function copyWeek(db: DB, fromMonday: string, toMonday: string) {
  const { addDays, diffDays } = await import("@/lib/membership/dates");
  const src = await db.select().from(shifts).where(and(gte(shifts.date, fromMonday), lte(shifts.date, addDays(fromMonday, 6))));
  let added = 0;
  for (const s of src) {
    const date = addDays(toMonday, diffDays(fromMonday, s.date));
    try {
      await addShift(db, { staffId: s.staffId, date, start: s.start, end: s.end, area: s.area as Area, notes: s.notes });
      added++;
    } catch {
      /* overlap: keep what's there */
    }
  }
  return added;
}

/* ── time clock ── */

export async function openEntry(db: DB, staffId: string) {
  const [row] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.staffId, staffId), isNull(timeEntries.clockOut)))
    .orderBy(desc(timeEntries.clockIn))
    .limit(1);
  return row ?? null;
}

export async function clockIn(db: DB, staffId: string, now = new Date()) {
  if (await openEntry(db, staffId)) throw new ServiceError("Already clocked in.");
  const [row] = await db.insert(timeEntries).values({ staffId, clockIn: now }).returning();
  const [s] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, staffId));
  await logActivity(db, null, "staff.clock-in", `${s?.name ?? "Staff"} clocked in`, now);
  return row;
}

export async function clockOut(db: DB, staffId: string, now = new Date()) {
  const open = await openEntry(db, staffId);
  if (!open) throw new ServiceError("Not clocked in.");
  await db.update(timeEntries).set({ clockOut: now }).where(eq(timeEntries.id, open.id));
  const [s] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, staffId));
  await logActivity(db, null, "staff.clock-out", `${s?.name ?? "Staff"} clocked out`, now);
}

export async function editEntry(db: DB, id: string, clockInAt: Date, clockOutAt: Date | null) {
  if (clockOutAt && clockOutAt <= clockInAt) throw new ServiceError("Clock-out must be after clock-in.");
  await db.update(timeEntries).set({ clockIn: clockInAt, clockOut: clockOutAt }).where(eq(timeEntries.id, id));
}
