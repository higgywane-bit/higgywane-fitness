import type { ISODate } from "@/lib/membership/dates";
import type { DayStatus } from "./feedback";

/*
 * Rules about a PT client as the coach sees them: which list they sit in, what their
 * row says, and which parts of the app they can see. Pure, so the coach list, the
 * client page and the tests never disagree.
 *
 * Lifecycle: a PT pack is sold at the desk with a coach → client created as "invited"
 * and emailed a link → they set a password → "active". The coach can archive them.
 */

export type ClientStatus = "invited" | "active" | "archived";

export const CLIENT_STATUS: Record<ClientStatus, string> = {
  invited: "Not on the app yet",
  active: "On the app",
  archived: "Archived",
};

/** What the client sees in their app. The coach switches each part on or off. */
export type Visibility = {
  workouts: boolean;
  nutrition: boolean;
  dailyPlan: boolean;
  feedback: boolean;
  homeStats: boolean;
};

export const VISIBILITY_LABELS: { id: keyof Visibility; label: string; hint?: string }[] = [
  { id: "workouts", label: "Workouts" },
  { id: "nutrition", label: "Nutrition" },
  { id: "dailyPlan", label: "Daily plan", hint: "Meals under the macros" },
  { id: "feedback", label: "Daily feedback" },
  { id: "homeStats", label: "Steps and weight on home" },
];

export const DEFAULT_VISIBILITY: Visibility = { workouts: true, nutrition: true, dailyPlan: true, feedback: true, homeStats: true };

export function visibilityOf(raw: unknown): Visibility {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Visibility, unknown>>;
  const out = { ...DEFAULT_VISIBILITY };
  for (const k of Object.keys(out) as (keyof Visibility)[]) if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  return out;
}

/** Invite links work for 14 days; the coach can send a new one any time. */
export const INVITE_DAYS = 14;

export type ClientSection = "active" | "setup" | "archived";

/** Clients list: "Active" (on the app) and "To set up" (invited, waiting for them to join). */
export function sectionOf(status: ClientStatus): ClientSection {
  return status === "active" ? "active" : status === "invited" ? "setup" : "archived";
}

export type Tone = "default" | "warn" | "good" | "muted";
export type RowPart = { text: string; tone: Tone };

/**
 * The second line of a client row, most urgent first:
 * "3 sessions left · Today's feedback not in" / "1 session left" / "10 sessions left · Not on the app yet".
 */
export function clientRowParts(c: {
  status: ClientStatus;
  sessionsLeft: number | null;
  feedbackToday: DayStatus | null;
  feedbackOn: boolean;
  workedOutToday: boolean;
  inviteExpired?: boolean;
}): RowPart[] {
  const parts: RowPart[] = [];
  if (c.sessionsLeft == null) parts.push({ text: "No PT pack", tone: "warn" });
  else if (c.sessionsLeft <= 1) parts.push({ text: c.sessionsLeft === 1 ? "1 session left" : "No sessions left", tone: "warn" });
  else parts.push({ text: `${c.sessionsLeft} sessions left`, tone: c.sessionsLeft <= 2 ? "warn" : "default" });

  if (c.status === "invited") parts.push({ text: c.inviteExpired ? "Invite expired" : "Not on the app yet", tone: c.inviteExpired ? "warn" : "muted" });
  else if (c.status === "active") {
    if (c.workedOutToday) parts.push({ text: "Trained today", tone: "good" });
    else if (c.feedbackOn && c.feedbackToday !== "complete") parts.push({ text: "Today's feedback not in", tone: "warn" });
  }
  return parts;
}

/** Sort for the list: needs attention first, then by name. */
export function clientSort(a: { name: string; urgency: number }, b: { name: string; urgency: number }): number {
  return b.urgency - a.urgency || a.name.localeCompare(b.name);
}

export function urgency(parts: RowPart[]): number {
  return parts.filter((p) => p.tone === "warn").length;
}

/** "PH" for Pete Hudson, "B" for Bella. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "?").slice(0, 1)).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "Tuesday 6 October" in Bangkok time. */
export function longDate(d: ISODate): string {
  return new Date(`${d}T12:00:00+07:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" });
}

/** "Monday 5 Oct" */
export function mediumDate(d: ISODate): string {
  return new Date(`${d}T12:00:00+07:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
}

export function greeting(hour: number): string {
  return hour < 12 ? "Morning" : hour < 18 ? "Hey" : "Evening";
}
