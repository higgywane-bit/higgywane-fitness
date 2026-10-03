import { GYM } from "@/content/gym";
import type { PlanDuration, PlanKind } from "@/content/plans";
import { addDays, addMonths, diffDays, type ISODate } from "./dates";

/**
 * The membership rules, as pure functions. Every screen (check-in, member list,
 * dashboard, reminder emails) asks these the same questions, so they always agree.
 */

export type MembershipLike = {
  id: string;
  kind: PlanKind;
  planName: string;
  startsOn: ISODate;
  /** inclusive: the last day the member can train */
  endsOn: ISODate;
  frozenFrom?: ISODate | null;
  frozenUntil?: ISODate | null;
  cancelledAt?: Date | string | null;
  sessionsTotal?: number | null;
  sessionsUsed?: number | null;
};

export type MembershipState = "upcoming" | "active" | "frozen" | "expired" | "used-up" | "cancelled";

export function planEndDate(start: ISODate, duration: PlanDuration): ISODate {
  return "days" in duration ? addDays(start, duration.days - 1) : addDays(addMonths(start, duration.months), -1);
}

export function isFrozenOn(m: MembershipLike, day: ISODate): boolean {
  return !!m.frozenFrom && !!m.frozenUntil && m.frozenFrom <= day && day <= m.frozenUntil;
}

export function sessionsLeft(m: MembershipLike): number | null {
  return m.sessionsTotal == null ? null : Math.max(0, m.sessionsTotal - (m.sessionsUsed ?? 0));
}

export function membershipState(m: MembershipLike, today: ISODate): MembershipState {
  if (m.cancelledAt) return "cancelled";
  if (today < m.startsOn) return "upcoming";
  if (today > m.endsOn) return "expired";
  if (sessionsLeft(m) === 0) return "used-up";
  if (isFrozenOn(m, today)) return "frozen";
  return "active";
}

const live = (ms: MembershipLike[], kind: PlanKind) =>
  ms.filter((m) => m.kind === kind && !m.cancelledAt).sort((a, b) => a.startsOn.localeCompare(b.startsOn));

/**
 * Last day of unbroken cover starting from `m`, following renewals that start
 * on or before the day after the previous one ends. A member on a 1-month plan
 * who already paid for the next month has ~60 days left, not ~30.
 */
export function coverageEnd(ms: MembershipLike[], from: MembershipLike): ISODate {
  let end = from.endsOn;
  for (const m of live(ms, from.kind)) {
    if (m.startsOn <= addDays(end, 1) && m.endsOn > end) end = m.endsOn;
  }
  return end;
}

/** Where a newly sold plan should start: today, or the day after current cover runs out. */
export function nextStartDate(ms: MembershipLike[], kind: PlanKind, today: ISODate): ISODate {
  const current = live(ms, kind).find((m) => m.startsOn <= today && today <= m.endsOn);
  if (!current) return today;
  return addDays(coverageEnd(ms, current), 1);
}

export type MemberStatus = "active" | "expiring" | "frozen" | "upcoming" | "expired" | "none";

export type MemberStanding = {
  status: MemberStatus;
  /** the gym membership covering today (or the one that matters most) */
  current?: MembershipLike;
  /** last day of unbroken cover */
  coverEnds?: ISODate;
  /** 0 = today is the last day */
  daysLeft?: number;
  /** future start date when status = upcoming */
  startsOn?: ISODate;
  /** most recent end date when status = expired */
  endedOn?: ISODate;
  daysSinceExpiry?: number;
  frozenUntil?: ISODate;
  /** open PT pack, if any */
  pt?: { membership: MembershipLike; sessionsLeft: number; endsOn: ISODate };
};

export function memberStanding(ms: MembershipLike[], today: ISODate): MemberStanding {
  const gym = live(ms, "membership");
  const pt = live(ms, "pt")
    .filter((m) => membershipState(m, today) === "active")
    .map((m) => ({ membership: m, sessionsLeft: sessionsLeft(m) ?? 0, endsOn: m.endsOn }))[0];

  const current = gym.find((m) => m.startsOn <= today && today <= m.endsOn);
  if (current) {
    const coverEnds = coverageEnd(ms, current);
    const daysLeft = diffDays(today, coverEnds);
    if (isFrozenOn(current, today)) {
      return { status: "frozen", current, coverEnds, daysLeft, frozenUntil: current.frozenUntil!, pt };
    }
    return { status: daysLeft <= GYM.expiringSoonDays ? "expiring" : "active", current, coverEnds, daysLeft, pt };
  }

  const upcoming = gym.find((m) => m.startsOn > today);
  if (upcoming) return { status: "upcoming", current: upcoming, startsOn: upcoming.startsOn, pt };

  const past = gym.filter((m) => m.endsOn < today).at(-1);
  if (past) {
    return { status: "expired", current: past, endedOn: past.endsOn, daysSinceExpiry: diffDays(past.endsOn, today), pt };
  }
  return { status: "none", pt };
}

export type DenyReason = "expired" | "no-membership" | "frozen" | "not-started" | "unknown-code" | "archived";

export type AccessDecision =
  | { allowed: true; standing: MemberStanding; nudge: "last-day" | "renew-soon" | null }
  | { allowed: false; standing?: MemberStanding; reason: DenyReason };

/** The single question the front desk asks: can this member train today? */
export function evaluateAccess(ms: MembershipLike[], today: ISODate): AccessDecision {
  const standing = memberStanding(ms, today);
  switch (standing.status) {
    case "active":
    case "expiring": {
      const d = standing.daysLeft ?? 0;
      const c = standing.current!;
      // a day pass ending today isn't a renewal conversation
      const short = diffDays(c.startsOn, c.endsOn) + 1 <= GYM.renewNudgeDays;
      const nudge = short ? null : d === 0 ? "last-day" : d <= GYM.renewNudgeDays ? "renew-soon" : null;
      return { allowed: true, standing, nudge };
    }
    case "frozen":
      return { allowed: false, standing, reason: "frozen" };
    case "upcoming":
      return { allowed: false, standing, reason: "not-started" };
    case "expired":
      return { allowed: false, standing, reason: "expired" };
    default:
      return { allowed: false, standing, reason: "no-membership" };
  }
}

/** "Last day today", "Ends tomorrow", "12 days left" */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "Last day today";
  if (daysLeft === 1) return "Ends tomorrow";
  return `${daysLeft} days left`;
}

export function expiredLabel(days: number): string {
  if (days <= 1) return "Expired yesterday";
  return `Expired ${days} days ago`;
}

/** Pausing a plan pushes its end date back by the length of the pause. */
export function applyFreeze(m: MembershipLike, from: ISODate, until: ISODate): Pick<MembershipLike, "frozenFrom" | "frozenUntil" | "endsOn"> {
  const length = diffDays(from, until) + 1;
  return { frozenFrom: from, frozenUntil: until, endsOn: addDays(m.endsOn, length) };
}

/** Ending a pause early gives back the unused pause days. */
export function endFreeze(m: MembershipLike, today: ISODate): Pick<MembershipLike, "frozenFrom" | "frozenUntil" | "endsOn"> {
  if (!m.frozenFrom || !m.frozenUntil) return { frozenFrom: m.frozenFrom, frozenUntil: m.frozenUntil, endsOn: m.endsOn };
  if (today < m.frozenFrom) {
    const length = diffDays(m.frozenFrom, m.frozenUntil) + 1;
    return { frozenFrom: null, frozenUntil: null, endsOn: addDays(m.endsOn, -length) };
  }
  if (today > m.frozenUntil) return { frozenFrom: m.frozenFrom, frozenUntil: m.frozenUntil, endsOn: m.endsOn };
  const unused = diffDays(today, m.frozenUntil) + 1;
  const ended = addDays(today, -1);
  return {
    frozenFrom: ended < m.frozenFrom ? null : m.frozenFrom,
    frozenUntil: ended < m.frozenFrom ? null : ended,
    endsOn: addDays(m.endsOn, -unused),
  };
}
