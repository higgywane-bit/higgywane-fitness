import { BarChart, BarList, LabeledBars } from "@/components/admin/charts";
import { Panel } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { formatTHB } from "@/lib/format";
import type { Analysis, Kpi } from "@/lib/reports/analyze";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmt(k: Kpi) {
  if (typeof k.value === "string") return k.value;
  if (k.format === "thb") return formatTHB(k.value);
  if (k.format === "decimal") return k.value.toFixed(1);
  if (k.format === "pct") return `${k.value}%`;
  return Math.round(k.value).toLocaleString("en-US");
}

/** The figures for one analysed report (or several combined). */
export function ReportView({ a, headers, today, measure }: { a: Analysis; headers: string[]; today: string; measure: string }) {
  const unit = a.valueIsMoney ? "thb" : "count";
  const total = a.groups.reduce((s, g) => s + g.value, 0);
  const money = (n: number) => (a.valueIsMoney ? formatTHB(n) : Math.round(n).toLocaleString("en-US"));
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {a.kpis.slice(0, 4).map((k) => (
          <StatTile key={k.label} label={k.label} value={fmt(k)} />
        ))}
      </div>

      {a.monthly.length ? (
        <Panel title={`${measure} by month`}>
          <BarChart data={a.monthly.map((m) => ({ date: m.date, value: m.value }))} today={today} unit={unit} labelFormat="month" tickEvery={a.monthly.length > 12 ? 3 : 2} highlightLast={false} />
        </Panel>
      ) : (
        <Panel title="By month">
          <p className="text-sm text-text-tertiary">Pick a date column above to see this report over time.</p>
        </Panel>
      )}

      <div className="grid gap-3 md:gap-4 xl:grid-cols-2">
        {a.dateCol !== null ? (
          <Panel title={`${measure} by weekday`}>
            <LabeledBars items={a.weekday.map((v, i) => ({ label: DAYS[i], value: v }))} unit={unit} />
          </Panel>
        ) : null}
        {a.hours ? (
          <Panel title={`${measure} by hour`}>
            <LabeledBars items={a.hours.slice(5, 23).map((v, i) => ({ label: String(i + 5), value: v }))} unit={unit} labelEvery={3} />
          </Panel>
        ) : null}
      </div>

      {a.groups.length ? (
        <Panel title={`Top ${headers[a.groupCol!]?.toLowerCase() ?? "groups"}`}>
          <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs text-text-tertiary">
                <tr>
                  <th className="pb-2 font-medium">{headers[a.groupCol!]}</th>
                  <th className="pb-2 text-right font-medium">Rows</th>
                  {a.valueCol !== null ? <th className="pb-2 text-right font-medium">{headers[a.valueCol]}</th> : null}
                  <th className="w-[30%] pb-2 pl-4 font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {a.groups.map((g) => (
                  <tr key={g.label}>
                    <td className="max-w-[280px] truncate py-2.5 pr-3 font-medium">{g.label}</td>
                    <td className="tabular py-2.5 text-right text-text-secondary">{g.count.toLocaleString("en-US")}</td>
                    {a.valueCol !== null ? <td className="tabular py-2.5 text-right font-semibold">{money(g.value)}</td> : null}
                    <td className="py-2.5 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-white/[0.06]">
                          <div className="h-full rounded-full bg-white/70" style={{ width: `${total ? (g.value / total) * 100 : 0}%` }} />
                        </div>
                        <span className="tabular w-10 text-right text-xs text-text-tertiary">{total ? Math.round((g.value / total) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {a.breakdowns.length ? (
        <div className="grid gap-3 md:gap-4 xl:grid-cols-2">
          {a.breakdowns.map((b) => (
            <Panel key={b.header} title={`By ${b.header.toLowerCase()}`}>
              <BarList items={b.items.map((i) => ({ label: i.label, value: i.value }))} unit={unit} />
            </Panel>
          ))}
        </div>
      ) : null}
    </div>
  );
}
