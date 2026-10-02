import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, t } from "@/lib/db";
import { expensesInRange } from "@/lib/expenses/rules";
import { addDays, addMonths, diffDays, localDate } from "@/lib/membership/dates";
import {
  activeOn,
  coachStats,
  cohorts,
  memberFlow,
  monthsIn,
  pctChange,
  previousPeriod,
  profitAndLoss,
  renewalRate,
  resolvePeriod,
  revenueByMonth,
  type GymPlan,
  type PeriodId,
} from "./metrics";
import { loadTargets } from "./targets";

const dayStart = (d: string) => new Date(`${d}T00:00:00+07:00`);
const dayEnd = (d: string) => new Date(`${d}T23:59:59.999+07:00`);

export async function performanceData(periodId: PeriodId, now = new Date()) {
  const db = await getDb();
  const today = localDate(now);
  const p = resolvePeriod(periodId, today);
  const prev = previousPeriod(p);
  const yearFrom = `${addMonths(today.slice(0, 8) + "01", -11)}`;
  const earliest = [prev.from, yearFrom].sort()[0];

  const [msRows, salesRows, expenseRows, visits, sessions, coaches, orders, targets] = await Promise.all([
    db.select().from(t.memberships),
    db.select({ at: t.sales.occurredAt, amountSatang: t.sales.amountSatang, category: t.sales.category }).from(t.sales).where(gte(t.sales.occurredAt, dayStart(earliest))),
    db.select().from(t.expenses),
    db.select({ at: t.checkIns.at, memberId: t.checkIns.memberId }).from(t.checkIns).where(and(eq(t.checkIns.allowed, true), gte(t.checkIns.at, dayStart(prev.from)))),
    db
      .select({ s: t.ptSessions, price: t.memberships.price, total: t.memberships.sessionsTotal })
      .from(t.ptSessions)
      .leftJoin(t.memberships, eq(t.memberships.id, t.ptSessions.membershipId))
      .where(and(gte(t.ptSessions.at, dayStart(p.from)), lte(t.ptSessions.at, dayEnd(p.to)))),
    db.select().from(t.staff).where(eq(t.staff.role, "coach")),
    db.select().from(t.cafeOrders).where(and(gte(t.cafeOrders.createdAt, dayStart(p.from)), lte(t.cafeOrders.createdAt, dayEnd(p.to)))),
    loadTargets(db),
  ]);

  const plans: GymPlan[] = msRows.map((m) => ({ memberId: m.memberId, kind: m.kind, startsOn: m.startsOn, endsOn: m.endsOn, cancelled: !!m.cancelledAt, planName: m.planName, price: m.price, createdAt: m.createdAt, source: m.source }));
  const sum = (from: string, to: string) => salesRows.filter((s) => { const d = localDate(s.at); return d >= from && d <= to; }).reduce((a, s) => a + s.amountSatang, 0) / 100;
  const costs = (from: string, to: string) => expensesInRange(expenseRows, from, to).reduce((a, e) => a + e.amountSatang, 0) / 100;

  const revenue = sum(p.from, p.to);
  const revenuePrev = sum(prev.from, prev.to);
  const spend = costs(p.from, p.to);
  const spendPrev = costs(prev.from, prev.to);
  const profit = revenue - spend;
  const flow = memberFlow(plans, p);
  const flowPrev = memberFlow(plans, prev);
  const renewals = renewalRate(plans, p, today);

  // average active members across the period (sampled weekly), for revenue per member
  const samples: number[] = [];
  for (let d = p.from; d <= p.to; d = addDays(d, 7)) samples.push(activeOn(plans, d).size);
  const avgActive = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;

  const byCategory = new Map<string, number>();
  for (const s of salesRows) {
    const d = localDate(s.at);
    if (d >= p.from && d <= p.to) byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + s.amountSatang / 100);
  }

  const year = { from: yearFrom, to: today };
  const pnl = profitAndLoss(revenueByMonth(salesRows, year), expensesInRange(expenseRows, year.from, year.to));

  const inPeriod = visits.filter((v) => { const d = localDate(v.at); return d >= p.from && d <= p.to; });
  const prevVisits = visits.filter((v) => { const d = localDate(v.at); return d >= prev.from && d <= prev.to; }).length;
  const days = Math.min(diffDays(p.from, p.to), diffDays(p.from, today)) + 1;
  const byWeekday = Array(7).fill(0) as number[];
  for (const v of inPeriod) byWeekday[(new Date(`${localDate(v.at)}T00:00:00Z`).getUTCDay() + 6) % 7]++;

  const liveOrders = orders.filter((o) => o.status !== "cancelled");
  const orderValue = liveOrders.reduce((a, o) => a + o.subtotal, 0);
  const items = new Map<string, number>();
  for (const o of liveOrders) for (const l of o.lines) items.set(l.name, (items.get(l.name) ?? 0) + l.qty);

  const monthNow = today.slice(0, 7);
  const monthFlow = memberFlow(plans, { from: `${monthNow}-01`, to: today });
  const monthRevenue = sum(`${monthNow}-01`, today);
  const monthSessions = (
    await db.select({ id: t.ptSessions.id }).from(t.ptSessions).where(and(gte(t.ptSessions.at, dayStart(`${monthNow}-01`)), eq(t.ptSessions.status, "done")))
  ).length;

  return {
    today,
    period: p,
    prev,
    money: { revenue, revenueChange: pctChange(revenue, revenuePrev), spend, spendChange: pctChange(spend, spendPrev), profit, profitChange: pctChange(profit, revenuePrev - spendPrev), margin: revenue ? profit / revenue : null },
    flow,
    flowPrev,
    renewals,
    avgActive,
    revenuePerMember: avgActive ? revenue / avgActive : null,
    byCategory: [...byCategory].map(([k, v]) => ({ category: k, value: v })).sort((a, b) => b.value - a.value),
    pnl,
    cohorts: cohorts(plans, today, 6),
    visits: { total: inPeriod.length, change: pctChange(inPeriod.length, prevVisits), perDay: days > 0 ? inPeriod.length / days : 0, perMember: avgActive ? inPeriod.length / avgActive : 0, byWeekday },
    coaches: coachStats(
      sessions.map((x) => ({ coachId: x.s.coachId, status: x.s.status, packPrice: x.price, packSessions: x.total })),
      coaches,
    ),
    cafe: { orders: liveOrders.length, value: orderValue, avg: liveOrders.length ? orderValue / liveOrders.length : 0, top: [...items].sort((a, b) => b[1] - a[1]).slice(0, 6) },
    targets,
    progress: { revenue: monthRevenue, newMembers: monthFlow.joined, activeMembers: monthFlow.activeEnd, ptSessions: monthSessions, monthsLeftDays: diffDays(today, addDays(addMonths(`${monthNow}-01`, 1), -1)) },
    months: monthsIn(p).length,
  };
}
