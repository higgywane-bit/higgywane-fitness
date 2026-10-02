import { GYM } from "@/content/gym";
import { memberStanding, type MembershipLike } from "./access";
import { diffDays, type ISODate } from "./dates";

/*
 * Who should get a renewal email today. Windows rather than exact days, so a
 * missed cron run still sends; the reminders table makes each one send once.
 */

export type ReminderKind = `before-${number}` | `after-${number}`;

export type ReminderCandidate = {
  memberId: string;
  email: string | null;
  firstName: string;
  marketingOptIn: boolean;
  archived: boolean;
  memberships: MembershipLike[];
};

export type DueReminder = {
  memberId: string;
  email: string;
  firstName: string;
  kind: ReminderKind;
  /** the end date this reminder is about (cover end, including paid renewals) */
  endsOn: ISODate;
  plan: string;
  daysLeft?: number;
  daysSinceExpiry?: number;
};

export function dueReminders(
  candidates: ReminderCandidate[],
  today: ISODate,
  rules: { before: readonly number[]; after: readonly number[] } = GYM.reminders,
): DueReminder[] {
  const before = [...rules.before].sort((a, b) => a - b); // e.g. [1, 7]
  const after = [...rules.after].sort((a, b) => a - b);
  const out: DueReminder[] = [];
  for (const c of candidates) {
    if (!c.email || !c.marketingOptIn || c.archived) continue;
    const s = memberStanding(c.memberships, today);
    if ((s.status === "active" || s.status === "expiring") && s.coverEnds && s.daysLeft !== undefined) {
      // the tightest window the member is inside: 1 day left → "before-1", 5 days left → "before-7"
      const n = before.find((d) => s.daysLeft! <= d);
      // No "a week left" email the day someone buys a 1-week pass, and none at all for day passes.
      const length = diffDays(s.current!.startsOn, s.coverEnds) + 1;
      const fits = n !== undefined && length > 1 && (n <= 1 || length > n * 2);
      if (n !== undefined && fits) out.push({ memberId: c.memberId, email: c.email, firstName: c.firstName, kind: `before-${n}`, endsOn: s.coverEnds, plan: s.current!.planName, daysLeft: s.daysLeft });
    } else if (s.status === "expired" && s.endedOn && s.daysSinceExpiry !== undefined) {
      const n = [...after].reverse().find((d) => s.daysSinceExpiry! >= d && s.daysSinceExpiry! <= d + 7);
      if (n !== undefined) out.push({ memberId: c.memberId, email: c.email, firstName: c.firstName, kind: `after-${n}`, endsOn: s.endedOn, plan: s.current!.planName, daysSinceExpiry: s.daysSinceExpiry });
    }
  }
  return out;
}
