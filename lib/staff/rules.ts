import { addDays, type ISODate } from "@/lib/membership/dates";

/** Pure staff maths: shift lengths, weeks, hours and wage estimates. */

export const ROLES = {
  owner: { label: "Owner", can: ["everything"] },
  manager: { label: "Manager", can: ["members", "plans", "staff", "money", "settings"] },
  desk: { label: "Front desk", can: ["check-in", "members", "plans", "leads", "cafe"] },
  coach: { label: "Coach", can: ["check-in", "coaching", "leads"] },
  cafe: { label: "Cafe", can: ["cafe", "check-in"] },
} as const;

export type Role = keyof typeof ROLES;

export const AREAS = {
  desk: "Front desk",
  cafe: "Cafe bar",
  floor: "Gym floor",
  pt: "PT sessions",
  cleaning: "Cleaning",
} as const;

export type Area = keyof typeof AREAS;

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isTime(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Hours in a shift; a shift ending before it starts runs past midnight. */
export function shiftHours(start: string, end: string): number {
  let mins = minutesOf(end) - minutesOf(start);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

/** Hours worked for a clock entry; an open entry counts up to `now`. */
export function entryHours(clockIn: Date, clockOut: Date | null, now = new Date()): number {
  const end = clockOut ?? now;
  return Math.max(0, Math.round(((end.getTime() - clockIn.getTime()) / 3_600_000) * 100) / 100);
}

/** Monday of the week containing `day`. */
export function weekStart(day: ISODate): ISODate {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

export function weekDays(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function wageEstimate(hours: number, hourlyRate: number | null | undefined): number | null {
  return hourlyRate ? Math.round(hours * hourlyRate) : null;
}

/** Shifts overlapping on the same day for the same person. */
export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  const as = minutesOf(a.start);
  const ae = as + shiftHours(a.start, a.end) * 60;
  const bs = minutesOf(b.start);
  const be = bs + shiftHours(b.start, b.end) * 60;
  return as < be && bs < ae;
}
