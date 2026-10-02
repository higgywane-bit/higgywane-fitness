import "server-only";
import { and, desc, eq, gte, isNotNull, lte, ne, sql } from "drizzle-orm";
import { GYM } from "@/content/gym";
import { dailySeries, hourHeatmap, inRange, monthToDateRanges, pctChange } from "@/lib/admin/analytics";
import { listMembers, recentCheckIns } from "@/lib/admin/queries";
import { getDb, t, type DB } from "@/lib/db";
import { addDays, addMonths, diffDays, localDate } from "@/lib/membership/dates";
import { fullName } from "@/lib/membership/service";
import type { WidgetId } from "./catalog";
import { expensesInRange } from "@/lib/expenses/rules";
import { memberFlow, profitAndLoss, renewalRate, revenueByMonth } from "@/lib/performance/metrics";
import { loadTargets } from "@/lib/performance/targets";
import { entryHours } from "@/lib/staff/rules";

/*
 * Where every dashboard number comes from. Definitions live here once
 * (see docs/ADMIN-PLAN.md "Metric definitions"); modules only display them.
 * Sources are fetched lazily and shared, so a layout only pays for what it shows.
 */

const DAY = 86_400_000;
/** Bangkok-local timestamp expression for SQL bucketing (Thailand is UTC+7, no DST). */
const local = (col: unknown) => sql`((${col} at time zone 'UTC') + interval '7 hours')`;

export class DashboardContext {
  readonly today: string;
  private cache = new Map<string, Promise<unknown>>();
  constructor(
    readonly db: DB,
    readonly now: Date,
  ) {
    this.today = localDate(now);
  }
  private memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) this.cache.set(key, fn());
    return this.cache.get(key) as Promise<T>;
  }

  members = () => this.memo("members", () => listMembers(this.now));
  memberships = () => this.memo("memberships", () => this.db.select().from(t.memberships));
  visits = () =>
    this.memo("visits", () =>
      this.db
        .select({ at: t.checkIns.at, memberId: t.checkIns.memberId })
        .from(t.checkIns)
        .where(and(eq(t.checkIns.allowed, true), gte(t.checkIns.at, new Date(this.now.getTime() - 70 * DAY)))),
    );
  expenses = () => this.memo("expenses", () => this.db.select().from(t.expenses));
  plans = () =>
    this.memo("plans", async () =>
      (await this.memberships()).map((m) => ({ memberId: m.memberId, kind: m.kind, startsOn: m.startsOn, endsOn: m.endsOn, cancelled: !!m.cancelledAt, planName: m.planName, price: m.price, createdAt: m.createdAt, source: m.source })),
    );
  sales = () =>
    this.memo("sales", () =>
      this.db
        .select({ at: t.sales.occurredAt, amount: t.sales.amountSatang, category: t.sales.category })
        .from(t.sales)
        .where(gte(t.sales.occurredAt, new Date(this.now.getTime() - 66 * DAY))),
    );
}

export async function createContext(now = new Date()) {
  return new DashboardContext(await getDb(), now);
}

const baht = (satang: number) => satang / 100;

function sumSales(rows: { at: Date; amount: number }[], from: string, to: string) {
  return baht(rows.filter((s) => inRange(s.at, from, to)).reduce((a, s) => a + s.amount, 0));
}

export type KpiData = { value: number; format: "count" | "thb" | "decimal" | "pct"; change?: number | null; sub?: string; href?: string; tone?: "warn" };

/* ── loaders, one per module ─────────────────────────────── */

export const LOADERS: Record<WidgetId, (c: DashboardContext) => Promise<unknown>> = {
  async "kpi-active"(c) {
    const ms = (await c.members()).filter((m) => !m.archived);
    const mtd = monthToDateRanges(c.today);
    const active = ms.filter((m) => m.status === "active" || m.status === "expiring").length;
    const fresh = ms.filter((m) => localDate(new Date(m.createdAt)) >= mtd.thisStart).length;
    return { value: active, format: "count", sub: `+${fresh} new this month`, href: "/admin/members?status=active" } satisfies KpiData;
  },
  async "kpi-in-today"(c) {
    const v = await c.visits();
    const start = new Date(`${c.today}T00:00:00+07:00`);
    const uniq = (from: Date, to: Date) => new Set(v.filter((x) => x.at >= from && x.at <= to).map((x) => x.memberId)).size;
    const now = uniq(start, c.now);
    const before = uniq(new Date(start.getTime() - 7 * DAY), new Date(c.now.getTime() - 7 * DAY));
    const change = pctChange(now, before);
    return { value: now, format: "count", change, sub: change != null ? "vs last week" : "Members checked in", href: "/admin/check-in" } satisfies KpiData;
  },
  async "kpi-expiring"(c) {
    const ms = (await c.members()).filter((m) => !m.archived);
    const n = ms.filter((m) => m.status === "expiring").length;
    const frozen = ms.filter((m) => m.status === "frozen").length;
    return { value: n, format: "count", tone: n ? "warn" : undefined, sub: frozen ? `${frozen} paused` : "Renewals to chase", href: "/admin/members?status=expiring" } satisfies KpiData;
  },
  async "kpi-new-members"(c) {
    const ms = await c.members();
    const mtd = monthToDateRanges(c.today);
    const created = ms.map((m) => localDate(new Date(m.createdAt)));
    const now = created.filter((d) => d >= mtd.thisStart).length;
    const before = created.filter((d) => d >= mtd.prevStart && d <= mtd.prevEnd).length;
    const change = pctChange(now, before);
    return { value: now, format: "count", change, sub: change != null ? "vs last month" : "This month" } satisfies KpiData;
  },
  async "kpi-memberships-sold"(c) {
    const ms = await c.memberships();
    const mtd = monthToDateRanges(c.today);
    const sold = ms.filter((m) => m.source !== "glofox" && !m.cancelledAt && inRange(m.createdAt, mtd.thisStart, mtd.thisEnd));
    const value = sold.reduce((a, m) => a + m.price, 0);
    return { value: sold.length, format: "count", sub: `฿${value.toLocaleString("en-US")} this month` } satisfies KpiData;
  },
  async "kpi-visits-per-member"(c) {
    const [v, ms] = await Promise.all([c.visits(), c.members()]);
    const active = ms.filter((m) => !m.archived && (m.status === "active" || m.status === "expiring")).length;
    const since = new Date(c.now.getTime() - 30 * DAY);
    const visits = v.filter((x) => x.at >= since).length;
    return { value: active ? Math.round((visits / active) * 10) / 10 : 0, format: "decimal", sub: "per active member, 30 days" } satisfies KpiData;
  },
  async "kpi-sales-today"(c) {
    const s = await c.sales();
    const now = sumSales(s, c.today, c.today);
    const lastWeekDay = addDays(c.today, -7);
    const before = baht(s.filter((x) => localDate(x.at) === lastWeekDay && x.at.getTime() <= c.now.getTime() - 7 * DAY).reduce((a, x) => a + x.amount, 0));
    const change = pctChange(now, before);
    return { value: now, format: "thb", change, sub: change != null ? "vs last week, same time" : undefined, href: "/admin/sales" } satisfies KpiData;
  },
  async "kpi-sales-week"(c) {
    const s = await c.sales();
    const now = sumSales(s, addDays(c.today, -6), c.today);
    const before = sumSales(s, addDays(c.today, -13), addDays(c.today, -7));
    const change = pctChange(now, before);
    return { value: now, format: "thb", change, sub: change != null ? "vs previous 7 days" : "Last 7 days", href: "/admin/sales" } satisfies KpiData;
  },
  async "kpi-sales-month"(c) {
    const s = await c.sales();
    const mtd = monthToDateRanges(c.today);
    const now = sumSales(s, mtd.thisStart, mtd.thisEnd);
    const change = pctChange(now, sumSales(s, mtd.prevStart, mtd.prevEnd));
    return { value: now, format: "thb", change, sub: s.length ? (change != null ? "vs last month" : "Month to date") : "Import Qashier sales", href: "/admin/sales" } satisfies KpiData;
  },
  async "kpi-avg-sale"(c) {
    const s = await c.sales();
    const mtd = monthToDateRanges(c.today);
    const avg = (from: string, to: string) => {
      const r = s.filter((x) => inRange(x.at, from, to));
      return r.length ? baht(r.reduce((a, x) => a + x.amount, 0)) / r.length : 0;
    };
    const now = avg(mtd.thisStart, mtd.thisEnd);
    const change = pctChange(Math.round(now), Math.round(avg(mtd.prevStart, mtd.prevEnd)));
    return { value: now, format: "thb", change, sub: change != null ? "vs last month" : "Per receipt" } satisfies KpiData;
  },

  async "visits-daily"(c) {
    return { series: dailySeries((await c.visits()).map((v) => v.at), 30, c.today), today: c.today };
  },
  async "busy-hours"(c) {
    const since = c.now.getTime() - 56 * DAY;
    return { grid: hourHeatmap((await c.visits()).map((v) => v.at).filter((d) => d.getTime() > since), GYM.hours.open, GYM.hours.close), open: GYM.hours.open };
  },
  async "active-trend"(c) {
    const ms = (await c.memberships()).filter((m) => m.kind === "membership" && !m.cancelledAt);
    const series = Array.from({ length: 12 }, (_, i) => {
      const date = addDays(c.today, -(11 - i) * 7);
      const ids = new Set(ms.filter((m) => m.startsOn <= date && date <= m.endsOn).map((m) => m.memberId));
      return { date, value: ids.size };
    });
    return { series, today: c.today };
  },
  async "sales-daily"(c) {
    const s = await c.sales();
    return { series: dailySeries(s.map((x) => x.at), 30, c.today, (i) => baht(s[i].amount)), today: c.today, empty: !s.length };
  },
  async "sales-monthly"(c) {
    const from = `${addMonths(c.today.slice(0, 8) + "01", -11)}`;
    const rows = await c.db
      .select({ month: sql<string>`to_char(${local(t.sales.occurredAt)}, 'YYYY-MM')`, total: sql<number>`sum(${t.sales.amountSatang})::bigint` })
      .from(t.sales)
      .where(gte(t.sales.occurredAt, new Date(`${from}T00:00:00+07:00`)))
      .groupBy(sql`1`);
    const byMonth = new Map(rows.map((r) => [r.month, baht(Number(r.total))]));
    const series = Array.from({ length: 12 }, (_, i) => {
      const month = addMonths(from, i).slice(0, 7);
      return { date: `${month}-01`, value: byMonth.get(month) ?? 0 };
    });
    return { series, today: c.today, empty: !rows.length };
  },
  async "sales-by-type"(c) {
    const s = await c.sales();
    const mtd = monthToDateRanges(c.today);
    const labels: Record<string, string> = { membership: "Memberships", pt: "Personal training", cafe: "Cafe", retail: "Retail", other: "Other" };
    const items = Object.entries(labels)
      .map(([k, label]) => ({ label, value: baht(s.filter((x) => x.category === k && inRange(x.at, mtd.thisStart, mtd.thisEnd)).reduce((a, x) => a + x.amount, 0)) }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
    return { items };
  },
  async "top-sellers"(c) {
    const mtd = monthToDateRanges(c.today);
    const item = sql`item`;
    const rows = await c.db
      .select({
        name: sql<string>`${item}->>'name'`,
        qty: sql<number>`sum((${item}->>'qty')::int)::int`,
        total: sql<number>`sum((${item}->>'amountSatang')::bigint)::bigint`,
      })
      .from(sql`${t.sales}, jsonb_array_elements(${t.sales.items}) as item`)
      .where(and(isNotNull(t.sales.items), gte(t.sales.occurredAt, new Date(`${mtd.thisStart}T00:00:00+07:00`))))
      .groupBy(sql`1`)
      .orderBy(sql`3 desc`)
      .limit(8);
    return { items: rows.map((r) => ({ name: r.name, qty: Number(r.qty), value: baht(Number(r.total)) })) };
  },
  async "members-by-plan"(c) {
    const mix = new Map<string, number>();
    for (const m of await c.members()) if (!m.archived && (m.status === "active" || m.status === "expiring") && m.plan) mix.set(m.plan, (mix.get(m.plan) ?? 0) + 1);
    return { items: [...mix].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) };
  },

  async "expiring-list"(c) {
    const rows = (await c.members()).filter((m) => !m.archived && m.status === "expiring").sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
    return { rows, today: c.today };
  },
  async "win-back"(c) {
    const rows = (await c.members())
      .filter((m) => !m.archived && m.status === "expired" && (m.daysSinceExpiry ?? 99) <= 30)
      .sort((a, b) => (a.daysSinceExpiry ?? 0) - (b.daysSinceExpiry ?? 0));
    return { rows, today: c.today };
  },
  async "latest-checkins"() {
    return { items: await recentCheckIns(8) };
  },
  async "top-visitors"(c) {
    const since = new Date(c.now.getTime() - 30 * DAY);
    const counts = new Map<string, number>();
    for (const v of await c.visits()) if (v.memberId && v.at >= since) counts.set(v.memberId, (counts.get(v.memberId) ?? 0) + 1);
    const byId = new Map((await c.members()).map((m) => [m.id, m]));
    const rows = [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .flatMap(([id, n]) => (byId.get(id) ? [{ member: byId.get(id)!, visits: n }] : []));
    return { rows };
  },
  async birthdays(c) {
    const rows = await c.db
      .select({ id: t.members.id, firstName: t.members.firstName, lastName: t.members.lastName, birthDate: t.members.birthDate, phone: t.members.phone })
      .from(t.members)
      .where(and(isNotNull(t.members.birthDate), sql`${t.members.archivedAt} is null`));
    const upcoming = rows
      .map((r) => {
        const md = r.birthDate!.slice(5);
        let next = `${c.today.slice(0, 4)}-${md}`;
        if (next < c.today) next = `${Number(c.today.slice(0, 4)) + 1}-${md}`;
        return { id: r.id, name: fullName(r), phone: r.phone, date: next, inDays: diffDays(c.today, next), age: Number(next.slice(0, 4)) - Number(r.birthDate!.slice(0, 4)) };
      })
      .filter((r) => r.inDays >= 0 && r.inDays <= 7)
      .sort((a, b) => a.inDays - b.inDays);
    return { rows: upcoming, today: c.today };
  },
  async "recent-sales"(c) {
    const rows = await c.db
      .select({ id: t.sales.id, at: t.sales.occurredAt, amount: t.sales.amountSatang, description: t.sales.description, category: t.sales.category, externalId: t.sales.externalId })
      .from(t.sales)
      .orderBy(desc(t.sales.occurredAt))
      .limit(8);
    return { rows: rows.map((r) => ({ ...r, at: r.at.toISOString(), amount: baht(r.amount) })) };
  },

  /* ── business ── */
  async "kpi-profit-month"(c) {
    const mtd = monthToDateRanges(c.today);
    const [s, e] = await Promise.all([c.sales(), c.expenses()]);
    const cost = (from: string, to: string) => expensesInRange(e, from, to).reduce((a, x) => a + x.amountSatang, 0) / 100;
    const now = sumSales(s, mtd.thisStart, mtd.thisEnd) - cost(mtd.thisStart, mtd.thisEnd);
    const before = sumSales(s, mtd.prevStart, mtd.prevEnd) - cost(mtd.prevStart, mtd.prevEnd);
    const change = pctChange(now, before);
    return { value: now, format: "thb", change, tone: now < 0 ? "warn" : undefined, sub: change != null ? "vs last month, same days" : "Sales minus costs", href: "/admin/performance" } satisfies KpiData;
  },
  async "kpi-costs-month"(c) {
    const mtd = monthToDateRanges(c.today);
    const e = await c.expenses();
    const cost = (from: string, to: string) => expensesInRange(e, from, to).reduce((a, x) => a + x.amountSatang, 0) / 100;
    const now = cost(mtd.thisStart, mtd.thisEnd);
    return { value: now, format: "thb", change: pctChange(now, cost(mtd.prevStart, mtd.prevEnd)), sub: "vs last month, same days", href: "/admin/expenses" } satisfies KpiData;
  },
  async targets(c) {
    const mtd = monthToDateRanges(c.today);
    const [targets, s, plans] = await Promise.all([loadTargets(c.db), c.sales(), c.plans()]);
    const flow = memberFlow(plans, { from: mtd.thisStart, to: c.today });
    const [{ n }] = await c.db
      .select({ n: sql<number>`count(*)::int` })
      .from(t.ptSessions)
      .where(and(eq(t.ptSessions.status, "done"), gte(t.ptSessions.at, new Date(`${mtd.thisStart}T00:00:00+07:00`))));
    const rows = [
      { label: "Sales", value: sumSales(s, mtd.thisStart, mtd.thisEnd), target: targets.revenue, money: true },
      { label: "New members", value: flow.joined, target: targets.newMembers, money: false },
      { label: "Active members", value: flow.activeEnd, target: targets.activeMembers, money: false },
      { label: "PT sessions", value: n, target: targets.ptSessions, money: false },
    ].filter((r) => r.target);
    return { rows };
  },
  async "profit-monthly"(c) {
    const from = `${addMonths(c.today.slice(0, 8) + "01", -11)}`;
    const [rows, e] = await Promise.all([
      c.db
        .select({ at: t.sales.occurredAt, amountSatang: t.sales.amountSatang, category: t.sales.category })
        .from(t.sales)
        .where(gte(t.sales.occurredAt, new Date(`${from}T00:00:00+07:00`))),
      c.expenses(),
    ]);
    const pnl = profitAndLoss(revenueByMonth(rows, { from, to: c.today }), expensesInRange(e, from, c.today));
    return { series: pnl.map((m) => ({ date: `${m.month}-01`, value: Math.max(0, m.profit) })), losses: pnl.filter((m) => m.profit < 0).length, today: c.today, empty: !rows.length };
  },
  async "kpi-renewal-rate"(c) {
    const r = renewalRate(await c.plans(), { from: addDays(c.today, -104), to: addDays(c.today, -14) }, c.today);
    return { value: r.rate == null ? 0 : Math.round(r.rate * 100), format: "pct", sub: r.ended ? `${r.renewed} of ${r.ended} plans renewed` : "No plans ended yet", href: "/admin/performance?period=last-90" } satisfies KpiData;
  },
  async "kpi-churn"(c) {
    const mtd = monthToDateRanges(c.today);
    const f = memberFlow(await c.plans(), { from: mtd.thisStart, to: c.today });
    return { value: f.churned, format: "count", tone: f.churnRate && f.churnRate > 0.08 ? "warn" : undefined, sub: f.churnRate != null ? `${Math.round(f.churnRate * 100)}% of ${f.activeStart} active on the 1st` : undefined, href: "/admin/performance" } satisfies KpiData;
  },
  async "at-risk"(c) {
    const rows = (await c.members()).filter((m) => !m.archived && m.atRisk).sort((a, b) => (a.lastVisit ?? "").localeCompare(b.lastVisit ?? ""));
    return { rows, today: c.today };
  },
  async "kpi-open-leads"(c) {
    const rows = await c.db.select({ stage: t.leads.stage, next: t.leads.nextFollowUp }).from(t.leads).where(and(ne(t.leads.stage, "won"), ne(t.leads.stage, "lost")));
    const due = rows.filter((r) => r.next && r.next <= c.today).length;
    return { value: rows.length, format: "count", tone: due ? "warn" : undefined, sub: due ? `${due} follow-ups due` : "None due today", href: "/admin/leads" } satisfies KpiData;
  },
  async "follow-ups"(c) {
    const rows = await c.db
      .select({ id: t.leads.id, name: t.leads.name, phone: t.leads.phone, source: t.leads.source, stage: t.leads.stage, next: t.leads.nextFollowUp })
      .from(t.leads)
      .where(and(ne(t.leads.stage, "won"), ne(t.leads.stage, "lost"), lte(t.leads.nextFollowUp, c.today)))
      .orderBy(t.leads.nextFollowUp)
      .limit(8);
    return { rows, today: c.today };
  },
  async "kpi-cafe-orders"(c) {
    const start = new Date(`${c.today}T00:00:00+07:00`);
    const rows = await c.db.select({ status: t.cafeOrders.status, subtotal: t.cafeOrders.subtotal }).from(t.cafeOrders).where(gte(t.cafeOrders.createdAt, start));
    const live = rows.filter((r) => r.status !== "cancelled");
    const waiting = rows.filter((r) => r.status === "new" || r.status === "preparing").length;
    return { value: live.length, format: "count", tone: waiting ? "warn" : undefined, sub: waiting ? `${waiting} waiting at the bar` : `฿${live.reduce((a, r) => a + r.subtotal, 0).toLocaleString("en-US")} today`, href: "/admin/cafe" } satisfies KpiData;
  },
  async "kpi-pt-month"(c) {
    const mtd = monthToDateRanges(c.today);
    const [[{ n }], [{ waiting }]] = await Promise.all([
      c.db
        .select({ n: sql<number>`count(*)::int` })
        .from(t.ptSessions)
        .where(and(eq(t.ptSessions.status, "done"), gte(t.ptSessions.at, new Date(`${mtd.thisStart}T00:00:00+07:00`)))),
      c.db.select({ waiting: sql<number>`count(*)::int` }).from(t.ptBookings).where(eq(t.ptBookings.status, "requested")),
    ]);
    return { value: n, format: "count", tone: waiting ? "warn" : undefined, sub: waiting ? `${waiting} booking requests waiting` : "Delivered this month", href: "/admin/coaching" } satisfies KpiData;
  },
  async "on-shift"(c) {
    const [people, shifts, entries] = await Promise.all([
      c.db.select().from(t.staff).where(eq(t.staff.active, true)),
      c.db.select().from(t.shifts).where(eq(t.shifts.date, c.today)),
      c.db.select().from(t.timeEntries).where(gte(t.timeEntries.clockIn, new Date(`${c.today}T00:00:00+07:00`))),
    ]);
    const rows = people
      .map((p) => {
        const mine = entries.filter((e) => e.staffId === p.id);
        const open = mine.find((e) => !e.clockOut);
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          color: p.color,
          shifts: shifts.filter((s) => s.staffId === p.id).map((s) => `${s.start}–${s.end}`),
          clockedInAt: open?.clockIn.toISOString() ?? null,
          hours: Math.round(mine.reduce((a, e) => a + entryHours(e.clockIn, e.clockOut, c.now), 0) * 10) / 10,
        };
      })
      .filter((p) => p.shifts.length || p.hours > 0)
      .sort((a, b) => Number(!!b.clockedInAt) - Number(!!a.clockedInAt) || (a.shifts[0] ?? "").localeCompare(b.shifts[0] ?? ""));
    return { rows };
  },
};
