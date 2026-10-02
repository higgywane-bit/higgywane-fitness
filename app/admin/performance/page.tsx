import Link from "next/link";
import { BarChart, BarList, LabeledBars } from "@/components/admin/charts";
import { LinkTabs } from "@/components/admin/link-tabs";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { TargetsButton } from "@/components/admin/targets-form";
import { formatTHB } from "@/lib/format";
import { formatDate } from "@/lib/membership/dates";
import { PERIODS, type PeriodId } from "@/lib/performance/metrics";
import { performanceData } from "@/lib/performance/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Performance" };

const CATEGORY: Record<string, string> = { membership: "Memberships", pt: "Personal training", cafe: "Cafe", retail: "Retail", other: "Other" };
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);

function Progress({ label, value, target, format = (n: number) => String(Math.round(n)) }: { label: string; value: number; target: number | null; format?: (n: number) => string }) {
  if (!target) return null;
  const share = Math.min(1, value / target);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="tabular">
          <span className="font-semibold">{format(value)}</span>
          <span className="text-text-tertiary"> / {format(target)}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-label={label} aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", share >= 1 ? "bg-success" : "bg-white/80")} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const pid = (PERIODS.some((x) => x.id === period) ? period : "this-month") as PeriodId;
  const d = await performanceData(pid);
  const hasTargets = Object.values(d.targets).some((v) => v);

  return (
    <div className="pb-12">
      <PageHeader eyebrow={`${formatDate(d.period.from, d.today)} – ${formatDate(d.period.to, d.today)} · compared with the period before`} title="Performance">
        <TargetsButton targets={d.targets} />
      </PageHeader>
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <LinkTabs label="Period" active={pid} tabs={PERIODS.map((x) => ({ id: x.id, label: x.label, href: `?period=${x.id}` }))} />

        {hasTargets ? (
          <Panel title="This month vs targets" action={<span className="text-xs text-text-tertiary">{d.progress.monthsLeftDays} days to go</span>}>
            <div className="grid gap-5 md:grid-cols-2">
              <Progress label="Sales" value={d.progress.revenue} target={d.targets.revenue} format={formatTHB} />
              <Progress label="New members" value={d.progress.newMembers} target={d.targets.newMembers} />
              <Progress label="Active members" value={d.progress.activeMembers} target={d.targets.activeMembers} />
              <Progress label="PT sessions" value={d.progress.ptSessions} target={d.targets.ptSessions} />
            </div>
          </Panel>
        ) : null}

        <h2 className="pt-2 text-xs font-semibold tracking-[0.16em] text-text-tertiary uppercase">Money</h2>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Sales" value={formatTHB(d.money.revenue)} change={d.money.revenueChange} sub="From Qashier" href="/admin/sales" />
          <StatTile label="Costs" value={formatTHB(d.money.spend)} change={d.money.spendChange} lowerIsBetter href="/admin/expenses" />
          <StatTile label="Profit" value={formatTHB(d.money.profit)} change={d.money.profitChange} tone={d.money.profit < 0 ? "warn" : undefined} />
          <StatTile label="Margin" value={pct(d.money.margin)} sub={d.revenuePerMember ? `${formatTHB(d.revenuePerMember)} per active member` : undefined} />
        </div>

        <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title="Profit & loss · last 12 months">
            <BarChart data={d.pnl.map((m) => ({ date: `${m.month}-01`, value: Math.max(0, m.profit) }))} today={d.today} unit="thb" labelFormat="month" tickEvery={2} />
            <div className="mt-4 -mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
              <table className="w-full min-w-[520px] text-right text-sm">
                <thead className="text-xs text-text-tertiary">
                  <tr>
                    <th className="pb-2 text-left font-medium">Month</th>
                    <th className="pb-2 font-medium">Sales</th>
                    <th className="pb-2 font-medium">Costs</th>
                    <th className="pb-2 font-medium">Profit</th>
                    <th className="pb-2 font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-hairline">
                  {[...d.pnl].reverse().map((m) => (
                    <tr key={m.month}>
                      <td className="py-2 text-left text-text-secondary">{MONTH.format(new Date(`${m.month}-01T00:00:00Z`))}</td>
                      <td className="py-2">{formatTHB(m.revenue)}</td>
                      <td className="py-2 text-text-secondary">{formatTHB(m.expenses)}</td>
                      <td className={cn("py-2 font-semibold", m.profit < 0 && "text-red-text")}>{formatTHB(m.profit)}</td>
                      <td className="py-2 text-text-secondary">{pct(m.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-text-tertiary">Chart shows profit (losing months show as empty). Sales from Qashier; costs from Expenses, with monthly costs repeated.</p>
          </Panel>
          <Panel title="Sales by type">
            <BarList unit="thb" items={d.byCategory.map((c) => ({ label: CATEGORY[c.category] ?? c.category, value: c.value }))} />
          </Panel>
        </div>

        <h2 className="pt-2 text-xs font-semibold tracking-[0.16em] text-text-tertiary uppercase">Members</h2>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Active at end" value={d.flow.activeEnd} sub={`${d.flow.net >= 0 ? "+" : ""}${d.flow.net} over the period`} href="/admin/members?status=active" />
          <StatTile label="Joined" value={d.flow.joined} change={d.flowPrev.joined ? Math.round(((d.flow.joined - d.flowPrev.joined) / d.flowPrev.joined) * 100) : null} sub={`+${d.flow.returned} came back`} />
          <StatTile label="Churned" value={d.flow.churned} sub={`${pct(d.flow.churnRate)} of members at the start`} tone={d.flow.churnRate && d.flow.churnRate > 0.1 ? "warn" : undefined} />
          <StatTile label="Renewal rate" value={pct(d.renewals.rate)} sub={`${d.renewals.renewed} of ${d.renewals.ended} plans that ended`} />
        </div>

        <div className="grid gap-3 md:gap-4 xl:grid-cols-2">
          <Panel title="Where members came and went">
            <ol className="grid grid-cols-5 items-end gap-2 text-center">
              {[
                { label: "Start", value: d.flow.activeStart, cls: "bg-white/25" },
                { label: "Joined", value: d.flow.joined, cls: "bg-success" },
                { label: "Came back", value: d.flow.returned, cls: "bg-success/60" },
                { label: "Left", value: -d.flow.churned, cls: "bg-red" },
                { label: "End", value: d.flow.activeEnd, cls: "bg-white/70" },
              ].map((s) => {
                const max = Math.max(1, d.flow.activeStart, d.flow.activeEnd);
                return (
                  <li key={s.label}>
                    <span className="tabular block text-lg font-semibold">{s.value > 0 && (s.label === "Joined" || s.label === "Came back") ? `+${s.value}` : s.value}</span>
                    <span className={cn("mx-auto mt-1 block w-full max-w-12 rounded-t-[4px]", s.cls)} style={{ height: `${Math.max(4, (Math.abs(s.value) / max) * 120)}px` }} />
                    <span className="mt-2 block text-xs text-text-secondary">{s.label}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-xs text-text-tertiary">Active = had a gym plan that day. Joined = first-ever plan. Came back = had a plan before, lapsed, and returned. Left = active at the start, not at the end.</p>
          </Panel>
          <Panel title="Do new members stay? (retention by join month)">
            <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
              <table className="w-full min-w-[460px] text-center text-sm">
                <thead className="text-xs text-text-tertiary">
                  <tr>
                    <th className="pb-2 text-left font-medium">Joined</th>
                    <th className="pb-2 font-medium">People</th>
                    {Array.from({ length: 6 }, (_, i) => (
                      <th key={i} className="pb-2 font-medium">
                        M{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular">
                  {d.cohorts.map((c) => (
                    <tr key={c.month}>
                      <td className="py-1 text-left text-text-secondary">{MONTH.format(new Date(`${c.month}-01T00:00:00Z`))}</td>
                      <td className="py-1">{c.size}</td>
                      {Array.from({ length: 6 }, (_, i) => {
                        const v = c.retained[i];
                        return (
                          <td key={i} className="p-0.5">
                            {v == null || !c.size ? (
                              <span className="block h-8" />
                            ) : (
                              <span className="block rounded-md py-1.5 text-xs font-semibold" style={{ backgroundColor: `rgb(225 29 72 / ${0.1 + v * 0.8})` }}>
                                {Math.round(v * 100)}%
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-text-tertiary">Share of each month&apos;s new members with an active plan at the end of month 1, 2, 3…</p>
          </Panel>
        </div>

        <h2 className="pt-2 text-xs font-semibold tracking-[0.16em] text-text-tertiary uppercase">Gym floor, coaches, cafe</h2>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Visits" value={d.visits.total} change={d.visits.change} />
          <StatTile label="Visits per day" value={d.visits.perDay.toFixed(0)} />
          <StatTile label="Visits per member" value={d.visits.perMember.toFixed(1)} sub="Active members, this period" />
          <StatTile label="Website cafe orders" value={d.cafe.orders} sub={d.cafe.orders ? `${formatTHB(d.cafe.avg)} average` : undefined} href="/admin/cafe" />
        </div>
        <div className="grid gap-3 md:gap-4 xl:grid-cols-3">
          <Panel title="Visits by weekday">
            <LabeledBars items={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({ label, value: d.visits.byWeekday[i] }))} unit="visits" />
          </Panel>
          <Panel title="Coaches" action={<Link href="/admin/coaching" className="text-sm text-text-secondary hover:text-white">Coaching</Link>}>
            {d.coaches.length ? (
              <ul className="divide-y divide-hairline text-sm">
                {d.coaches.map((c) => (
                  <li key={c.id} className="flex min-h-11 items-center gap-3">
                    <span className="flex-1 font-medium">{c.name}</span>
                    <span className="tabular text-text-secondary">{c.sessions} sessions</span>
                    <span className="tabular w-20 text-right font-semibold">{c.commission != null ? formatTHB(c.commission) : "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-tertiary">No coaches set up yet.</p>
            )}
          </Panel>
          <Panel title="Cafe: most ordered online">
            {d.cafe.top.length ? <BarList items={d.cafe.top.map(([label, value]) => ({ label, value }))} /> : <p className="text-sm text-text-tertiary">No website orders in this period.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
