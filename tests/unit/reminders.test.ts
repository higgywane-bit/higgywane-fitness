import { describe, expect, it } from "vitest";
import type { MembershipLike } from "@/lib/membership/access";
import { dueReminders, type ReminderCandidate } from "@/lib/membership/reminders";
import { reminderEmail } from "@/lib/email/templates";
import { formatPhone } from "@/lib/format";

const plan = (startsOn: string, endsOn: string, over: Partial<MembershipLike> = {}): MembershipLike => ({
  id: startsOn,
  kind: "membership",
  planName: "1 Month",
  startsOn,
  endsOn,
  ...over,
});
const who = (ms: MembershipLike[], over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  memberId: "m1",
  email: "a@b.co",
  firstName: "Nicha",
  marketingOptIn: true,
  archived: false,
  memberships: ms,
  ...over,
});
const rules = { before: [7, 1], after: [3] };

describe("renewal reminders", () => {
  it("sends the week-out reminder inside the 7-day window", () => {
    const [r] = dueReminders([who([plan("2026-10-01", "2026-10-31")])], "2026-10-26", rules);
    expect(r).toMatchObject({ kind: "before-7", daysLeft: 5, endsOn: "2026-10-31" });
  });
  it("switches to the last-day reminder", () => {
    expect(dueReminders([who([plan("2026-10-01", "2026-10-31")])], "2026-10-30", rules)[0].kind).toBe("before-1");
  });
  it("skips members who already renewed", () => {
    const ms = [plan("2026-10-01", "2026-10-31"), plan("2026-11-01", "2026-11-30")];
    expect(dueReminders([who(ms)], "2026-10-28", rules)).toEqual([]);
  });
  it("sends a win-back a few days after expiry, once the window opens", () => {
    expect(dueReminders([who([plan("2026-10-01", "2026-10-31")])], "2026-11-02", rules)).toEqual([]);
    expect(dueReminders([who([plan("2026-10-01", "2026-10-31")])], "2026-11-03", rules)[0].kind).toBe("after-3");
    expect(dueReminders([who([plan("2026-10-01", "2026-10-31")])], "2026-11-20", rules)).toEqual([]);
  });
  it("respects opt-out, missing email and archived members", () => {
    const ms = [plan("2026-10-01", "2026-10-31")];
    expect(dueReminders([who(ms, { marketingOptIn: false }), who(ms, { email: null }), who(ms, { archived: true })], "2026-10-30", rules)).toEqual([]);
  });
  it("doesn't nag day-pass or 1-week buyers about a week left", () => {
    expect(dueReminders([who([plan("2026-10-30", "2026-10-30")])], "2026-10-30", rules)).toEqual([]);
    expect(dueReminders([who([plan("2026-10-25", "2026-10-31")])], "2026-10-26", rules)).toEqual([]);
    expect(dueReminders([who([plan("2026-10-25", "2026-10-31")])], "2026-10-30", rules)[0].kind).toBe("before-1");
  });
  it("writes the email", () => {
    const [r] = dueReminders([who([plan("2026-10-01", "2026-10-31")])], "2026-10-30", rules);
    const e = reminderEmail(r);
    expect(e.subject).toBe("Your Superfit membership ends tomorrow");
    expect(e.html).toContain("Hi Nicha");
  });
});

describe("formatPhone", () => {
  it("shows Thai numbers the local way", () => {
    expect(formatPhone("+66812345678")).toBe("081 234 5678");
    expect(formatPhone("+6621234567")).toBe("02 123 4567");
    expect(formatPhone("+447700900123")).toBe("+447700900123");
  });
});
