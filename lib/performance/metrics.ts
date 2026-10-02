import { addDays, addMonths, diffDays, localDate, type ISODate } from "@/lib/membership/dates";

/*
 * Business performance, as pure functions over plain rows so the numbers are testable
 * and portable. Definitions are in docs/ADMIN-PLAN.md §4.
 */

export type Period = { from: ISODate; to: ISODate };

export type PeriodId = "this-month" | "last-month" | "last-90" | "this-year" | "last-12m";

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-90", label: "Last 90 days" },
  { id: "this-year", label: "This year" },
  { id: "last-12m", label: "Last 12 months" },
];

export function resolvePeriod(id: PeriodId, today: ISODate): Period {
  const monthStart = `${today.slice(0, 8)}01`;
  switch (id) {
    case "last-month":
      return { from: addMonths(monthStart, -1), to: addDays(monthStart, -1) };
    case "last-90":
      return { from: addDays(today, -89), to: today };
    case "this-year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "last-12m":
      return { from: addDays(addMonths(today, -12), 1), to: today };
    default:
      return { from: monthStart, to: today };
  }
}

/** The stretch of the same length just before. */
export function previousPeriod(p: Period): Period {
  const len = diffDays(p.from, p.to) + 1;
  return { from: addDays(p.from, -len), to: addDays(p.from, -1) };
}

export function monthsIn(p: Period): string[] {
  const out: string[] = [];
  let m = `${p.from.slice(0, 7)}-01`;
  while (m.slice(0, 7) <= p.to.slice(0, 7)) {
    out.push(m.slice(0, 7));
    m = addMonths(m, 1);
  }
  return out;
}

export type GymPlan = { memberId: string; kind: string; startsOn: ISODate; endsOn: ISODate; cancelled: boolean; planName: string; price: number; createdAt: Date; source: string };

const gym = (ms: GymPlan[]) => ms.filter((m) => m.kind === "membership" && !m.cancelled);

/** Members with gym cover on a date. */
export function activeOn(ms: GymPlan[], day: ISODate): Set<string> {
  return new Set(gym(ms).filter((m) => m.startsOn <= day && day <= m.endsOn).map((m) => m.memberId));
}

export type MemberFlow = {
  activeStart: number;
  activeEnd: number;
  net: number;
  joined: number;
  returned: number;
  churned: number;
  churnRate: number | null;
  retentionRate: number | null;
};

/**
 * Who came and went. Joined = first ever gym plan started in the period; returned = had a plan
 * before, wasn't active at the start, active at the end; churned = active at the start, not at the end.
 */
export function memberFlow(ms: GymPlan[], p: Period): MemberFlow {
  const start = activeOn(ms, addDays(p.from, -1));
  const end = activeOn(ms, p.to);
  const firstStart = new Map<string, ISODate>();
  for (const m of gym(ms)) if (!firstStart.has(m.memberId) || m.startsOn < firstStart.get(m.memberId)!) firstStart.set(m.memberId, m.startsOn);
  const joined = [...firstStart].filter(([, d]) => d >= p.from && d <= p.to).length;
  const churned = [...start].filter((id) => !end.has(id)).length;
  const returned = [...end].filter((id) => !start.has(id) && (firstStart.get(id) ?? "9999") < p.from).length;
  return {
    activeStart: start.size,
    activeEnd: end.size,
    net: end.size - start.size,
    joined,
    returned,
    churned,
    churnRate: start.size ? churned / start.size : null,
    retentionRate: start.size ? 1 - churned / start.size : null,
  };
}

/**
 * Of the plans (a week or longer) that ended in the period, how many were followed by another
 * plan starting no more than `graceDays` after the end (renewing early counts too).
 */
export function renewalRate(ms: GymPlan[], p: Period, today: ISODate, graceDays = 14) {
  const plans = gym(ms);
  // only judge plans whose grace window has passed, otherwise "not yet" looks like "no"
  const ended = plans.filter((m) => m.endsOn >= p.from && m.endsOn <= p.to && addDays(m.endsOn, graceDays) <= today && diffDays(m.startsOn, m.endsOn) >= 6);
  const renewed = ended.filter((e) => plans.some((n) => n.memberId === e.memberId && n !== e && n.startsOn > e.startsOn && n.startsOn <= addDays(e.endsOn, graceDays + 1)));
  return { ended: ended.length, renewed: renewed.length, rate: ended.length ? renewed.length / ended.length : null };
}

/** Retention by join month: share of each month's new members still active N months later. */
export function cohorts(ms: GymPlan[], today: ISODate, months = 6) {
  const first = new Map<string, ISODate>();
  for (const m of gym(ms)) if (!first.has(m.memberId) || m.startsOn < first.get(m.memberId)!) first.set(m.memberId, m.startsOn);
  const thisMonth = `${today.slice(0, 7)}-01`;
  return Array.from({ length: months }, (_, i) => {
    const month = addMonths(thisMonth, -(months - 1 - i)).slice(0, 7);
    const ids = [...first].filter(([, d]) => d.slice(0, 7) === month).map(([id]) => id);
    const retained = Array.from({ length: months - i }, (_, k) => {
      const check = addDays(addMonths(`${month}-01`, k + 1), -1); // last day of month k
      if (check > today) return null;
      const act = activeOn(ms, check);
      return ids.length ? ids.filter((id) => act.has(id)).length / ids.length : null;
    });
    return { month, size: ids.length, retained };
  });
}

/** Revenue split by month and category, in baht. */
export function revenueByMonth(sales: { at: Date; amountSatang: number; category: string }[], p: Period) {
  const months = monthsIn(p);
  const rows = new Map(months.map((m) => [m, { month: m, total: 0, byCategory: {} as Record<string, number> }]));
  for (const s of sales) {
    const d = localDate(s.at);
    if (d < p.from || d > p.to) continue;
    const r = rows.get(d.slice(0, 7));
    if (!r) continue;
    r.total += s.amountSatang / 100;
    r.byCategory[s.category] = (r.byCategory[s.category] ?? 0) + s.amountSatang / 100;
  }
  return [...rows.values()];
}

export function profitAndLoss(revenue: { month: string; total: number }[], costs: { occurrence: ISODate; amountSatang: number }[]) {
  return revenue.map((r) => {
    const expenses = costs.filter((c) => c.occurrence.slice(0, 7) === r.month).reduce((a, c) => a + c.amountSatang / 100, 0);
    const profit = r.total - expenses;
    return { month: r.month, revenue: r.total, expenses, profit, margin: r.total ? profit / r.total : null };
  });
}

/** Coach output: sessions delivered, no-shows, and pay at their commission rate. */
export function coachStats(
  sessions: { coachId: string | null; status: string; packPrice: number | null; packSessions: number | null }[],
  coaches: { id: string; name: string; ptCommissionPct: number | null }[],
) {
  return coaches
    .map((c) => {
      const mine = sessions.filter((s) => s.coachId === c.id);
      const done = mine.filter((s) => s.status === "done");
      const value = mine.reduce((a, s) => a + (s.packPrice && s.packSessions ? s.packPrice / s.packSessions : 0), 0);
      return {
        id: c.id,
        name: c.name,
        sessions: done.length,
        noShows: mine.length - done.length,
        value: Math.round(value),
        commission: c.ptCommissionPct != null ? Math.round((value * c.ptCommissionPct) / 100) : null,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

export function pctChange(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}
