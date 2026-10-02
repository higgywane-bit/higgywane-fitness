import Link from "next/link";
import { Cake } from "lucide-react";
import { BarChart, BarList, Heatmap } from "@/components/admin/charts";
import { CheckInFeed } from "@/components/admin/check-in-feed";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { MemberRow } from "@/components/admin/member-row";
import { StatTile } from "@/components/admin/stat-tile";
import type { FeedItem, MemberListRow } from "@/lib/admin/queries";
import { widgetMeta, type WidgetId } from "@/lib/dashboard/catalog";
import type { KpiData } from "@/lib/dashboard/data";
import { formatPhone, formatTHB } from "@/lib/format";
import { daysLeftLabel, expiredLabel } from "@/lib/membership/access";
import { formatDate, formatMoment, localDate } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";

/* Renderers: one per module. Data shapes come from LOADERS in lib/dashboard/data.ts. */

type Series = { series: { date: string; value: number }[]; today: string; empty?: boolean };
type Members = { rows: MemberListRow[]; today: string };
type Items = { items: { label: string; value: number }[] };

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-tertiary">{children}</p>;
}

const noSales = (
  <Empty>
    No sales yet. <Link href="/admin/sales" className="text-white underline underline-offset-4">Import a Qashier export</Link>.
  </Empty>
);

function fmtKpi(d: KpiData) {
  if (d.format === "thb") return formatTHB(d.value);
  if (d.format === "pct") return `${d.value}%`;
  if (d.format === "decimal") return d.value.toFixed(1);
  return String(d.value);
}

function Kpi(id: WidgetId) {
  return function KpiTile({ data }: { data: KpiData }) {
    return <StatTile label={widgetMeta(id)!.title} value={fmtKpi(data)} change={data.change} sub={data.sub} href={data.href} tone={data.tone} />;
  };
}


export const RENDERERS: Record<WidgetId, React.ComponentType<{ data: never }>> = {
  "kpi-active": Kpi("kpi-active"),
  "kpi-in-today": Kpi("kpi-in-today"),
  "kpi-expiring": Kpi("kpi-expiring"),
  "kpi-new-members": Kpi("kpi-new-members"),
  "kpi-memberships-sold": Kpi("kpi-memberships-sold"),
  "kpi-visits-per-member": Kpi("kpi-visits-per-member"),
  "kpi-sales-today": Kpi("kpi-sales-today"),
  "kpi-sales-week": Kpi("kpi-sales-week"),
  "kpi-sales-month": Kpi("kpi-sales-month"),
  "kpi-avg-sale": Kpi("kpi-avg-sale"),

  "visits-daily": ({ data }: { data: Series }) => <BarChart data={data.series} today={data.today} unit="visits" />,
  "busy-hours": ({ data }: { data: { grid: number[][]; open: number } }) => <Heatmap grid={data.grid} open={data.open} />,
  "active-trend": ({ data }: { data: Series }) => <BarChart data={data.series} today={data.today} unit="count" tickEvery={3} summary="latest" />,
  "sales-daily": ({ data }: { data: Series }) => (data.empty ? noSales : <BarChart data={data.series} today={data.today} unit="thb" />),
  "sales-monthly": ({ data }: { data: Series }) =>
    data.empty ? noSales : <BarChart data={data.series} today={data.today} unit="thb" tickEvery={2} labelFormat="month" />,
  "sales-by-type": ({ data }: { data: Items }) => (data.items.length ? <BarList items={data.items} unit="thb" /> : noSales),
  "top-sellers": ({ data }: { data: { items: { name: string; qty: number; value: number }[] } }) => {
    if (!data.items.length) return <Empty>No item-level sales this month yet. Qashier exports with item names fill this in.</Empty>;
    const max = Math.max(...data.items.map((i) => i.value));
    return (
      <ol className="space-y-3">
        {data.items.map((i, n) => (
          <li key={i.name} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3">
            <span className="tabular text-xs text-text-tertiary">{n + 1}</span>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{i.name}</span>
                <span className="tabular shrink-0 text-xs text-text-tertiary">{i.qty} sold</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
                <div className={cn("h-full rounded-full", n === 0 ? "bg-red" : "bg-white/60")} style={{ width: `${(i.value / max) * 100}%` }} />
              </div>
            </div>
            <span className="tabular text-sm font-semibold">{formatTHB(i.value)}</span>
          </li>
        ))}
      </ol>
    );
  },
  "members-by-plan": ({ data }: { data: Items }) => <BarList items={data.items} />,

  "expiring-list": ({ data }: { data: Members }) =>
    data.rows.length ? (
      <ul className="-mx-2">
        {data.rows.slice(0, 7).map((m) => (
          <li key={m.id}>
            <MemberRow
              m={m}
              sub={`${m.plan} · ends ${formatDate(m.coverEnds!, data.today)}`}
              right={<span className={cn("tabular shrink-0 text-xs font-semibold", (m.daysLeft ?? 0) <= 1 ? "text-red-text" : "text-energy")}>{daysLeftLabel(m.daysLeft ?? 0)}</span>}
            />
          </li>
        ))}
      </ul>
    ) : (
      <Empty>Nobody runs out in the next 7 days.</Empty>
    ),
  "win-back": ({ data }: { data: Members }) =>
    data.rows.length ? (
      <ul className="-mx-2">
        {data.rows.slice(0, 7).map((m) => (
          <li key={m.id}>
            <MemberRow
              m={m}
              sub={m.phone ? formatPhone(m.phone) : (m.email ?? m.plan)}
              right={<span className="shrink-0 text-xs text-text-tertiary">{expiredLabel(m.daysSinceExpiry ?? 0)}</span>}
            />
          </li>
        ))}
      </ul>
    ) : (
      <Empty>No recent lapses.</Empty>
    ),
  "latest-checkins": ({ data }: { data: { items: FeedItem[] } }) => <CheckInFeed items={data.items} />,
  "top-visitors": ({ data }: { data: { rows: { member: MemberListRow; visits: number }[] } }) =>
    data.rows.length ? (
      <ul className="-mx-2">
        {data.rows.map(({ member, visits }) => (
          <li key={member.id}>
            <MemberRow m={member} right={<span className="tabular shrink-0 text-sm font-semibold">{visits} visits</span>} />
          </li>
        ))}
      </ul>
    ) : (
      <Empty>No visits in the last 30 days.</Empty>
    ),
  birthdays: ({ data }: { data: { rows: { id: string; name: string; phone: string | null; date: string; inDays: number; age: number }[]; today: string } }) =>
    data.rows.length ? (
      <ul className="divide-y divide-hairline">
        {data.rows.map((b) => (
          <li key={b.id}>
            <Link href={`/admin/members/${b.id}`} className="flex min-h-14 items-center gap-3 hover:text-white">
              <MemberAvatar name={b.name} className="size-9 text-sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{b.name}</span>
                <span className="block text-xs text-text-secondary">Turns {b.age} · {formatDate(b.date, data.today)}</span>
              </span>
              <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", b.inDays === 0 ? "text-red-text" : "text-text-secondary")}>
                <Cake className="size-3.5" aria-hidden />
                {b.inDays === 0 ? "Today" : b.inDays === 1 ? "Tomorrow" : `In ${b.inDays} days`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <Empty>No birthdays this week. Add birthdays on member profiles to see them here.</Empty>
    ),
  "recent-sales": ({ data }: { data: { rows: { id: string; at: string; amount: number; description: string | null; externalId: string | null }[] } }) =>
    data.rows.length ? (
      <ul className="divide-y divide-hairline">
        {data.rows.map((s) => (
          <li key={s.id} className="flex min-h-11 items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{s.description ?? s.externalId}</span>
            <span className="shrink-0 text-xs text-text-tertiary">{formatMoment(new Date(s.at))}</span>
            <span className="tabular w-20 shrink-0 text-right font-semibold">{formatTHB(s.amount)}</span>
          </li>
        ))}
      </ul>
    ) : (
      noSales
    ),

  "kpi-profit-month": Kpi("kpi-profit-month"),
  "kpi-costs-month": Kpi("kpi-costs-month"),
  "kpi-renewal-rate": Kpi("kpi-renewal-rate"),
  "kpi-churn": Kpi("kpi-churn"),
  "kpi-open-leads": Kpi("kpi-open-leads"),
  "kpi-cafe-orders": Kpi("kpi-cafe-orders"),
  "kpi-pt-month": Kpi("kpi-pt-month"),
  targets: ({ data }: { data: { rows: { label: string; value: number; target: number | null; money: boolean }[] } }) =>
    data.rows.length ? (
      <div className="grid gap-4 sm:grid-cols-2">
        {data.rows.map((r) => {
          const share = Math.min(1, r.value / (r.target ?? 1));
          const f = (n: number) => (r.money ? formatTHB(n) : String(Math.round(n)));
          return (
            <div key={r.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-text-secondary">{r.label}</span>
                <span className="tabular">
                  <span className="font-semibold">{f(r.value)}</span>
                  <span className="text-text-tertiary"> / {f(r.target ?? 0)}</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={cn("h-full rounded-full", share >= 1 ? "bg-success" : "bg-white/80")} style={{ width: `${share * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <Empty>
        No targets yet. <Link href="/admin/performance" className="text-white underline underline-offset-4">Set them on Performance</Link>.
      </Empty>
    ),
  "profit-monthly": ({ data }: { data: Series & { losses: number } }) =>
    data.empty ? (
      noSales
    ) : (
      <>
        <BarChart data={data.series} today={data.today} unit="thb" tickEvery={2} labelFormat="month" />
        {data.losses ? <p className="mt-2 text-xs text-energy">{data.losses} month{data.losses > 1 ? "s" : ""} ran at a loss (shown empty).</p> : null}
      </>
    ),
  "at-risk": ({ data }: { data: Members }) =>
    data.rows.length ? (
      <ul className="-mx-2">
        {data.rows.slice(0, 7).map((m) => (
          <li key={m.id}>
            <MemberRow
              m={m}
              sub={m.phone ? formatPhone(m.phone) : (m.email ?? m.plan)}
              right={<span className="shrink-0 text-xs text-energy">{m.lastVisit ? `Last in ${formatDate(localDate(new Date(m.lastVisit)), data.today)}` : "Never visited"}</span>}
            />
          </li>
        ))}
      </ul>
    ) : (
      <Empty>Every active member has been in during the last 2 weeks.</Empty>
    ),
  "follow-ups": ({ data }: { data: { rows: { id: string; name: string; phone: string | null; source: string; next: string | null }[]; today: string } }) =>
    data.rows.length ? (
      <ul className="divide-y divide-hairline">
        {data.rows.map((l) => (
          <li key={l.id}>
            <Link href="/admin/leads" className="flex min-h-12 items-center gap-3 text-sm hover:text-white">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{l.name}</span>
                <span className="block text-xs text-text-secondary">{l.phone ? formatPhone(l.phone) : l.source}</span>
              </span>
              <span className={cn("shrink-0 text-xs font-semibold", l.next && l.next < data.today ? "text-energy" : "text-text-secondary")}>
                {l.next === data.today ? "Today" : l.next ? `Overdue · ${formatDate(l.next, data.today)}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <Empty>No follow-ups due.</Empty>
    ),
  "on-shift": ({ data }: { data: { rows: { id: string; name: string; role: string; color: string | null; shifts: string[]; clockedInAt: string | null; hours: number }[] } }) =>
    data.rows.length ? (
      <ul className="divide-y divide-hairline">
        {data.rows.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/staff/${p.id}`} className="flex min-h-12 items-center gap-3 text-sm hover:text-white">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? "#fff" }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs text-text-secondary capitalize">
                  {p.role}
                  {p.shifts.length ? ` · ${p.shifts.join(", ")}` : ""}
                </span>
              </span>
              <span className={cn("shrink-0 text-xs font-semibold", p.clockedInAt ? "text-success" : "text-text-tertiary")}>
                {p.clockedInAt ? `In since ${formatMoment(new Date(p.clockedInAt)).split(" ").pop()}` : p.hours ? `${p.hours} h today` : "Not in yet"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <Empty>Nobody on the rota today.</Empty>
    ),
};

