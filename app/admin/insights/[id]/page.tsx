import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { DeleteReportButton, ReportControls } from "@/components/admin/insights/report-controls";
import { ReportView } from "@/components/admin/insights/report-view";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { getDb } from "@/lib/db";
import { formatDate, formatMoment, localDate } from "@/lib/membership/dates";
import { analyze, KIND_LABEL, type ReportKind } from "@/lib/reports/analyze";
import { getReport } from "@/lib/reports/service";

export const metadata = { title: "Report" };

const TYPE_LABEL: Record<string, string> = { date: "Date", time: "Time", money: "Money", number: "Number", id: "ID", category: "Category", text: "Text", empty: "Empty" };

function col(v: string | undefined, max: number): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === "none" || v === "count") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < max ? n : undefined;
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; value?: string; group?: string; df?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const r = await getReport(await getDb(), id);
  if (!r) notFound();
  const n = r.headers.length;
  const dayFirst = sp.df !== "0";
  const a = analyze(r.headers, r.rows, {
    kind: r.kind as ReportKind,
    dateCol: col(sp.date, n),
    valueCol: col(sp.value, n),
    groupCol: col(sp.group, n),
    dayFirst,
  });
  const today = localDate();
  const measure = a.valueCol === null ? "Rows" : r.headers[a.valueCol];

  return (
    <div className="pb-12">
      <div className="px-4 pt-4 md:px-8 md:pt-6">
        <Link href="/admin/insights" className="tap -ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm text-text-secondary hover:text-white">
          <ChevronLeft className="size-4" aria-hidden />
          Insights
        </Link>
      </div>
      <PageHeader
        eyebrow={`${KIND_LABEL[a.kind]} · ${r.rowCount.toLocaleString("en-US")} rows${a.range ? ` · ${formatDate(a.range.from, today)} – ${formatDate(a.range.to, today)}` : ""}`}
        title={r.name}
        className="pt-2 md:pt-2"
      >
        <span className="text-sm text-text-tertiary">Uploaded {formatMoment(r.uploadedAt)}</span>
        <DeleteReportButton id={r.id} />
      </PageHeader>

      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <Suspense>
          <ReportControls
            id={r.id}
            kind={a.kind}
            columns={a.columns.map((c) => ({ index: c.index, header: c.header, type: c.type }))}
            dateCol={a.dateCol}
            valueCol={a.valueCol}
            groupCol={a.groupCol}
            dayFirst={dayFirst}
          />
        </Suspense>

        <ReportView a={a} headers={r.headers} today={today} measure={measure} />

        <Panel title="What's in this file">
          <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-text-tertiary">
                <tr>
                  <th className="pb-2 font-medium">Column</th>
                  <th className="pb-2 font-medium">Read as</th>
                  <th className="pb-2 text-right font-medium">Filled</th>
                  <th className="pb-2 text-right font-medium">Different values</th>
                  <th className="pb-2 pl-4 font-medium">Examples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {a.columns.map((c) => (
                  <tr key={c.index}>
                    <td className="py-2.5 pr-3 font-medium">{c.header}</td>
                    <td className="py-2.5 pr-3 text-text-secondary">{TYPE_LABEL[c.type]}</td>
                    <td className="tabular py-2.5 text-right text-text-secondary">{r.rowCount ? Math.round((c.filled / r.rowCount) * 100) : 0}%</td>
                    <td className="tabular py-2.5 text-right text-text-secondary">{c.distinct.toLocaleString("en-US")}</td>
                    <td className="max-w-[320px] truncate py-2.5 pl-4 text-text-tertiary">{c.sample.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={`First ${Math.min(25, r.rowCount)} rows`}>
          <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
            <table className="w-full text-left text-xs">
              <thead className="text-text-tertiary">
                <tr>
                  {r.headers.map((h, i) => (
                    <th key={i} className="pr-4 pb-2 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {r.rows.slice(0, 25).map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => (
                      <td key={j} className="max-w-[220px] truncate py-2 pr-4 whitespace-nowrap text-text-secondary">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
