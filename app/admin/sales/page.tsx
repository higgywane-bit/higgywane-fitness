import { BarChart, BarList } from "@/components/admin/charts";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { SalesImport } from "@/components/admin/sales-import";
import { StatTile } from "@/components/admin/stat-tile";
import { salesData } from "@/lib/admin/queries";
import { formatTHB } from "@/lib/format";
import { formatMoment, localDate } from "@/lib/membership/dates";

export const metadata = { title: "Sales" };

const CATEGORY: Record<string, string> = { membership: "Memberships", pt: "Personal training", cafe: "Cafe", retail: "Retail", other: "Other" };

export default async function SalesPage() {
  const d = await salesData();
  const today = localDate();
  const connected = !!process.env.QASHIER_WEBHOOK_SECRET;
  return (
    <div className="pb-12">
      <PageHeader eyebrow="From Qashier" title="Sales" />
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Today" value={formatTHB(d.today)} />
          <StatTile label="Last 7 days" value={formatTHB(d.week)} />
          <StatTile label="This month" value={formatTHB(d.month)} change={d.monthChange} sub={d.monthChange != null ? "vs last month" : undefined} />
          <StatTile
            label="Qashier receipts"
            value={d.qashier.imported}
            sub={d.qashier.lastSale ? `Latest ${formatMoment(new Date(d.qashier.lastSale))}` : "None imported yet"}
          />
        </div>

        <div className="grid gap-3 md:gap-4 xl:grid-cols-3">
          <Panel title="Sales · last 30 days" className="xl:col-span-2">
            <BarChart data={d.daily} today={today} unit="thb" />
          </Panel>
          <Panel title="This month by type">
            <BarList items={d.byCategory.filter((c) => c.value > 0).map((c) => ({ label: CATEGORY[c.category], value: c.value }))} unit="thb" />
          </Panel>
        </div>

        <div className="grid gap-3 md:gap-4 xl:grid-cols-3">
          <Panel title="Recent sales" className="xl:col-span-2">
            {d.recent.length ? (
              <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs text-text-tertiary">
                    <tr>
                      <th className="pb-2 font-medium">When</th>
                      <th className="pb-2 font-medium">What</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {d.recent.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-text-secondary">{formatMoment(new Date(s.occurredAt))}</td>
                        <td className="max-w-[260px] truncate py-2.5 pr-3">{s.description ?? s.externalId}</td>
                        <td className="py-2.5 pr-3 text-text-secondary">{CATEGORY[s.category]}</td>
                        <td className="tabular py-2.5 text-right font-semibold">{formatTHB(s.amountSatang / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">No sales yet.</p>
            )}
          </Panel>

          <div className="space-y-3 md:space-y-4">
            <Panel title="Import from Qashier">
              <SalesImport />
              <p className="mt-4 text-xs text-text-tertiary">
                Qashier back office → Reports → Transactions → Export CSV. Line-item exports are fine: lines with the same receipt number are added up.
              </p>
            </Panel>
            <Panel title="Live connection">
              <div className="flex items-center gap-2 text-sm">
                <span aria-hidden className={connected ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-white/30"} />
                <span className="font-semibold">{connected ? "Webhook ready" : "Not connected yet"}</span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                Once Qashier grants API access, sales post straight to <code className="rounded bg-surface-3 px-1.5 py-0.5 text-xs">/api/qashier/webhook</code> and this page updates by itself. Until then, a CSV export once a week keeps the numbers right.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
