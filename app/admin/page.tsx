import Link from "next/link";
import { ScanLine, UserPlus } from "lucide-react";
import { BarChart, BarList, Heatmap } from "@/components/admin/charts";
import { CheckInFeed } from "@/components/admin/check-in-feed";
import { MemberRow } from "@/components/admin/member-row";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { Button } from "@/components/ui/button";
import { GYM } from "@/content/gym";
import { dashboardData } from "@/lib/admin/queries";
import { formatPhone, formatTHB } from "@/lib/format";
import { daysLeftLabel, expiredLabel } from "@/lib/membership/access";
import { formatDate } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const CATEGORY: Record<string, string> = { membership: "Memberships", pt: "Personal training", cafe: "Cafe", retail: "Retail", other: "Other" };

function greeting(now = new Date()) {
  const h = (now.getUTCHours() + GYM.utcOffsetHours) % 24;
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const d = await dashboardData();

  return (
    <div className="pb-12">
      <PageHeader eyebrow={`${greeting()} · ${formatDate(d.today)}`} title="Dashboard">
        <Button asChild variant="outline">
          <Link href="/admin/members/new">
            <UserPlus className="size-4" aria-hidden />
            New member
          </Link>
        </Button>
        <Button asChild>
          <Link href="/admin/check-in">
            <ScanLine className="size-4" aria-hidden />
            Open check-in
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile
            label="Active members"
            value={d.kpi.active}
            sub={`+${d.kpi.newThisMonth} new this month`}
            href="/admin/members?status=active"
          />
          <StatTile label="In today" value={d.kpi.inToday} change={d.kpi.inTodayChange} sub={d.kpi.inTodayChange != null ? "vs last week" : "Members checked in"} href="/admin/check-in" />
          <StatTile
            label={`Expiring ≤ ${GYM.expiringSoonDays} days`}
            value={d.kpi.expiring}
            tone={d.kpi.expiring ? "warn" : undefined}
            sub={d.kpi.frozen ? `${d.kpi.frozen} paused` : "Renewals to chase"}
            href="/admin/members?status=expiring"
          />
          <StatTile
            label="Sales this month"
            value={d.kpi.hasSales ? formatTHB(d.kpi.revenueMonth) : "—"}
            change={d.kpi.revenueChange}
            sub={d.kpi.hasSales ? "vs last month" : "Import Qashier sales"}
            href="/admin/sales"
          />
        </div>

        <div className="grid gap-3 md:gap-4 xl:grid-cols-3">
          <Panel title="Visits · last 30 days" className="xl:col-span-2">
            <BarChart data={d.visitsDaily} today={d.today} unit="visits" />
          </Panel>
          <Panel title="Busiest hours · last 8 weeks">
            <Heatmap grid={d.heatmap} open={GYM.hours.open} />
          </Panel>
        </div>

        <div className="grid gap-3 md:gap-4 xl:grid-cols-3">
          <Panel
            title={
              <span className="flex items-center gap-2">
                Expiring soon
                <span className="tabular rounded-full bg-surface-3 px-2 py-0.5 text-xs text-text-secondary">{d.expiring.length}</span>
              </span>
            }
            action={
              <Link href="/admin/members?status=expiring" className="text-sm text-text-secondary hover:text-white">
                See all
              </Link>
            }
          >
            {d.expiring.length ? (
              <ul className="-mx-2">
                {d.expiring.slice(0, 7).map((m) => (
                  <li key={m.id}>
                    <MemberRow
                      m={m}
                      sub={`${m.plan} · ends ${formatDate(m.coverEnds!, d.today)}`}
                      right={
                        <span className={cn("tabular shrink-0 text-xs font-semibold", (m.daysLeft ?? 0) <= 1 ? "text-red-text" : "text-energy")}>
                          {daysLeftLabel(m.daysLeft ?? 0)}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-tertiary">Nobody runs out in the next {GYM.expiringSoonDays} days.</p>
            )}
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                Win back
                <span className="tabular rounded-full bg-surface-3 px-2 py-0.5 text-xs text-text-secondary">{d.lapsed.length}</span>
              </span>
            }
            action={<span className="text-xs text-text-tertiary">Expired in the last 30 days</span>}
          >
            {d.lapsed.length ? (
              <ul className="-mx-2">
                {d.lapsed.slice(0, 7).map((m) => (
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
              <p className="text-sm text-text-tertiary">No recent lapses.</p>
            )}
          </Panel>

          <Panel
            title="Latest check-ins"
            action={
              <Link href="/admin/check-in" className="text-sm text-text-secondary hover:text-white">
                Front desk
              </Link>
            }
          >
            <CheckInFeed items={d.feed} />
          </Panel>
        </div>

        <div className="grid gap-3 md:gap-4 xl:grid-cols-3">
          <Panel title="Sales · last 30 days" className="xl:col-span-2">
            {d.kpi.hasSales ? (
              <BarChart data={d.revenueDaily} today={d.today} unit="thb" />
            ) : (
              <p className="text-sm text-text-tertiary">
                No sales yet. <Link href="/admin/sales" className="text-white underline underline-offset-4">Import a Qashier export</Link>.
              </p>
            )}
          </Panel>
          <Panel title="This month by type">
            <BarList items={d.byCategory.filter((c) => c.value > 0).map((c) => ({ label: CATEGORY[c.category], value: c.value }))} unit="thb" />
            <div className="mt-6 border-t border-hairline pt-4">
              <h3 className="mb-3 text-[13px] font-medium text-text-secondary">Active members by plan</h3>
              <BarList items={d.mix.map((m) => ({ label: m.plan, value: m.n }))} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
