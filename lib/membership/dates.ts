import { GYM } from "@/content/gym";

/**
 * Calendar dates are plain "YYYY-MM-DD" strings in gym-local time (Bangkok).
 * Membership start/end dates are inclusive: a Day Pass bought today starts and ends today.
 */
export type ISODate = string;

const DAY = 86_400_000;

export function localDate(at: Date = new Date()): ISODate {
  return new Date(at.getTime() + GYM.utcOffsetHours * 3_600_000).toISOString().slice(0, 10);
}

/** Hour of day (0–23) and weekday (0 = Monday) in gym-local time. */
export function localClock(at: Date): { hour: number; weekday: number } {
  const d = new Date(at.getTime() + GYM.utcOffsetHours * 3_600_000);
  return { hour: d.getUTCHours(), weekday: (d.getUTCDay() + 6) % 7 };
}

function toUTC(d: ISODate): Date {
  return new Date(`${d}T00:00:00Z`);
}

export function addDays(d: ISODate, n: number): ISODate {
  return new Date(toUTC(d).getTime() + n * DAY).toISOString().slice(0, 10);
}

/** Same day-of-month n months later, clamped to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(d: ISODate, n: number): ISODate {
  const [y, m, day] = d.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / DAY);
}

export function isISODate(s: unknown): s is ISODate {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s).getTime()) && toUTC(s).toISOString().startsWith(s);
}

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "3 Oct" — or "3 Oct 2027" when not this year */
export function formatDate(d: ISODate, today: ISODate = localDate()): string {
  return d.slice(0, 4) === today.slice(0, 4) ? SHORT.format(toUTC(d)) : LONG.format(toUTC(d));
}

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

/** "07:42" in gym time */
export function formatTime(at: Date): string {
  return TIME.format(at);
}

/** "Today 07:42", "Yesterday 18:10", "3 Oct 18:10" */
export function formatMoment(at: Date, now: Date = new Date()): string {
  const d = localDate(at);
  const today = localDate(now);
  const gap = diffDays(d, today);
  const prefix = gap === 0 ? "Today" : gap === 1 ? "Yesterday" : formatDate(d, today);
  return `${prefix} ${formatTime(at)}`;
}
