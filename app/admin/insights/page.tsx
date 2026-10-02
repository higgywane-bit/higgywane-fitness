import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BarChart } from "@/components/admin/charts";
import { ReportUpload } from "@/components/admin/insights/report-upload";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { formatTHB } from "@/lib/format";
import { getDb } from "@/lib/db";
import { formatDate, formatMoment, localDate } from "@/lib/membership/dates";
import { analyze, combineRows, KIND_LABEL, type ReportKind } from "@/lib/reports/analyze";
import { getReport, listReports } from "@/lib/reports/service";

export const metadata = { title: "Insights" };

const ORDER: ReportKind[] = ["transactions", "attendance", "members", "memberships", "generic"];

export default async function InsightsPage() {
  const db = await getDb();
  const today = localDate();
  const reports = await listReports(db);

  // One summary per report type: every upload with the same columns as the latest, read together.
  const summaries = (
    await Promise.all(
      ORDER.map(async (kind) => {
        const ofKind = reports.filter((r) => r.kind === kind);
        if (!ofKind.length) return null;
        const sig = ofKind[0].headers.join("|");
        const same = ofKind.filter((r) => r.headers.join("|") === sig);
        const full = (await Promise.all(same.map((r) => getReport(db, r.id)))).filter((r) => !!r);
        const { headers, rows } = combineRows(full.map((r) => ({ headers: r.headers, rows: r.rows })));
        return { kind, latest: ofKind[0], files: same.length, a: analyze(headers, rows, { kind }) };
      }),
    )
  ).filter((s) => !!s);

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Glofox & other reports" title="Insights" />
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <ReportUpload />
          <div className="rounded-3xl border border-hairline bg-surface-1 p-5 text-sm text-text-secondary">
            <h2 className="mb-2 font-semibold text-white">What to export from Glofox</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="text-white">Transactions</span>: Reports → Transactions List → set the dates → Download
              </li>
              <li>
                <span className="text-white">Attendance</span>: Reports → Attendance / Bookings → Download
              </li>
              <li>
                <span className="text-white">Members</span>: Manage → Clients → Actions → Download
              </li>
            </ul>
            <p className="mt-3 text-text-tertiary">Kept separate from the live dashboard. Upload a few exports of the same report (e.g. one per quarter) and they&apos;re read together, with repeated rows counted once.</p>
          </div>
        </div>

        {summaries.map(({ kind, latest, files, a }) => (
          <Panel
            key={kind}
            title={
              <span>
                {KIND_LABEL[kind]}
                <span className="ml-2 text-sm font-normal text-text-tertiary">
                  {a.rows.toLocaleString("en-US")} rows from {files} file{files > 1 ? "s" : ""}
                  {a.range ? ` · ${formatDate(a.range.from, today)} – ${formatDate(a.range.to, today)}` : ""}
                </span>
              </span>
            }
            action={
              <Link href={`/admin/insights/${latest.id}`} className="text-sm text-text-secondary hover:text-white">
                Open latest
              </Link>
            }
          >
            <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
              <dl className="grid grid-cols-2 gap-4 self-start lg:grid-cols-1">
                {a.kpis.slice(0, 3).map((k) => (
                  <div key={k.label}>
                    <dt className="text-[13px] text-text-secondary">{k.label}</dt>
                    <dd className="font-display tabular mt-1 text-[34px] leading-none">
                      {typeof k.value === "string"
                        ? k.value
                        : k.format === "thb"
                          ? formatTHB(k.value)
                          : k.format === "decimal"
                            ? k.value.toFixed(1)
                            : k.format === "pct"
                              ? `${k.value}%`
                              : Math.round(k.value).toLocaleString("en-US")}
                    </dd>
                  </div>
                ))}
              </dl>
              {a.monthly.length > 1 ? (
                <BarChart data={a.monthly.map((m) => ({ date: m.date, value: m.value }))} today={today} unit={a.valueIsMoney ? "thb" : "count"} labelFormat="month" tickEvery={a.monthly.length > 12 ? 3 : 2} highlightLast={false} />
              ) : (
                <p className="text-sm text-text-tertiary">Upload a report covering more than one month to see the trend.</p>
              )}
            </div>
          </Panel>
        ))}

        <Panel title={`Uploaded reports · ${reports.length}`}>
          {reports.length ? (
            <ul className="-mx-2 divide-y divide-hairline">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/insights/${r.id}`} className="tap group flex min-h-16 items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.name}</span>
                      <span className="block truncate text-[13px] text-text-secondary">
                        {KIND_LABEL[r.kind as ReportKind]} · {r.rowCount.toLocaleString("en-US")} rows
                        {r.dateFrom && r.dateTo ? ` · ${formatDate(r.dateFrom, today)} – ${formatDate(r.dateTo, today)}` : ""}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-xs text-text-tertiary sm:block">{formatMoment(r.uploadedAt)}</span>
                    <ChevronRight className="size-4 shrink-0 text-text-tertiary group-hover:text-white" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-tertiary">No reports yet. Drop a Glofox export above to see what&apos;s inside.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
