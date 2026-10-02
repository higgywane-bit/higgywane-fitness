"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { CircleCheck, Download, FileUp, RotateCcw } from "lucide-react";
import { previewImportAction, runImportAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { IMPORT_FIELDS, type ImportField, type ImportMapping } from "@/lib/membership/glofox";
import type { ImportPlan, ImportPlanRow } from "@/lib/membership/import";
import { cn } from "@/lib/utils";

const SAMPLE = [
  "Member ID,First Name,Last Name,Email,Phone,Membership Name,Membership Start Date,Membership Expiry Date,Barcode",
  "gf-1001,Nicha,Srisuk,nicha@example.com,0812345678,3 Months Unlimited,01/09/2026,30/11/2026,100234",
  "gf-1002,James,Walker,james@example.com,0898765432,Monthly,,15/10/2026,100235",
  "gf-1003,Ploy,Wongsa,ploy@example.com,0861112222,10 PT Sessions,,31/12/2026,",
  "gf-1004,Tom,Brown,,0823334444,1 Month,,02/08/2026,100237",
].join("\n");

const ACTION_STYLE: Record<ImportPlanRow["action"], string> = {
  create: "bg-success/15 text-success",
  update: "bg-recovery/15 text-recovery",
  skip: "bg-white/[0.06] text-text-secondary",
};

export function ImportWizard() {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [dayFirst, setDayFirst] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; updated: number; memberships: number; cards: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function preview(text: string, map?: ImportMapping, df = dayFirst) {
    setError(null);
    start(async () => {
      const res = await previewImportAction(text, map, df);
      if (!res.ok) return setError(res.error);
      if (!res.data.headers.length) return setError("That file looks empty.");
      setPlan(res.data);
      setMapping(res.data.mapping);
    });
  }

  async function load(file: File) {
    const text = await file.text();
    setFileName(file.name);
    setCsv(text);
    setDone(null);
    preview(text);
  }

  function setField(field: ImportField, idx: string) {
    const next = { ...mapping };
    if (idx === "") delete next[field];
    else next[field] = Number(idx);
    setMapping(next);
    if (csv) preview(csv, next);
  }

  function run() {
    if (!csv) return;
    start(async () => {
      const res = await runImportAction(csv, mapping, dayFirst);
      if (!res.ok) return setError(res.error);
      setDone(res.data);
    });
  }

  function reset() {
    setCsv(null);
    setPlan(null);
    setDone(null);
    setError(null);
    setFileName("");
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-hairline bg-surface-1 p-6 text-center md:p-10">
        <CircleCheck className="mx-auto size-12 text-success" aria-hidden />
        <h2 className="text-statement mt-4 text-[40px]">Import done</h2>
        <p className="mt-2 text-text-secondary">
          {done.created} new members · {done.updated} updated · {done.memberships} memberships · {done.cards} cards linked
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm text-text-tertiary">
          Everyone got their own QR code. Their old Glofox cards work at the scanner from now on. Re-import a fresh export on switch-over day: it only adds what changed.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link href="/admin/members">View members</Link>
          </Button>
          <Button variant="outline" onClick={reset}>
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!plan ? (
        <>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) load(f);
            }}
            className={cn(
              "flex min-h-64 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-8 text-center transition-colors",
              dragging ? "border-white bg-white/[0.04]" : "border-hairline-strong hover:border-white/40",
            )}
          >
            <span className="glass grid size-16 place-items-center rounded-2xl">
              <FileUp className="size-7" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-semibold">{pending ? "Reading…" : "Drop the Glofox client export here"}</span>
              <span className="mt-1 block text-sm text-text-secondary">or tap to choose a .csv file. Nothing is saved until you confirm.</span>
            </span>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) load(f);
              }}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-hairline bg-surface-1 p-5 text-sm text-text-secondary">
              <h3 className="mb-2 font-semibold text-white">Getting the file from Glofox</h3>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Glofox dashboard → Manage → Clients</li>
                <li>Leave filters off to get everyone (or filter to active members)</li>
                <li>Actions → Download (CSV)</li>
                <li>Check the export includes the membership expiry and barcode columns</li>
              </ol>
            </div>
            <div className="rounded-3xl border border-hairline bg-surface-1 p-5 text-sm text-text-secondary">
              <h3 className="mb-2 font-semibold text-white">What happens</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>Each person becomes a member with their own QR code</li>
                <li>Current memberships carry over with the same end date</li>
                <li>Barcodes are linked, so existing cards keep scanning</li>
                <li>Duplicates (same email, phone or Glofox ID) are skipped; safe to run twice</li>
              </ul>
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}
                download="superfit-sample-import.csv"
                className="mt-3 inline-flex items-center gap-1.5 font-semibold text-white underline-offset-4 hover:underline"
              >
                <Download className="size-4" aria-hidden />
                Sample file
              </a>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-white">{fileName}</span> · {plan.totals.rows} rows
            </p>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden />
              Start over
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["New members", plan.totals.create, "text-success"],
              ["Updates", plan.totals.update, "text-recovery"],
              ["Skipped", plan.totals.skip, ""],
              ["Active plans", plan.totals.activeMemberships, ""],
              ["Cards linked", plan.totals.cards, ""],
            ].map(([label, n, cls]) => (
              <div key={label as string} className="rounded-3xl border border-hairline bg-surface-1 p-4">
                <p className="text-[13px] text-text-secondary">{label}</p>
                <p className={cn("font-display tabular mt-1 text-[40px] leading-none", cls as string)}>{n}</p>
              </div>
            ))}
          </div>

          <details className="group rounded-3xl border border-hairline bg-surface-1 p-4 md:p-5" open={Object.keys(mapping).length < 3}>
            <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between font-semibold">
              Columns
              <span className="text-sm font-normal text-text-secondary group-open:hidden">
                {Object.keys(mapping).length} matched · change
              </span>
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(IMPORT_FIELDS) as ImportField[]).map((f) => (
                <label key={f} className="block text-sm">
                  <span className="mb-1.5 block text-text-secondary">{IMPORT_FIELDS[f]}</span>
                  <select
                    value={mapping[f] ?? ""}
                    onChange={(e) => setField(f, e.target.value)}
                    className="h-11 w-full rounded-xl border border-hairline-strong bg-surface-2 px-3 text-white"
                  >
                    <option value="">— not in file —</option>
                    {plan.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <fieldset className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <legend className="sr-only">Date format</legend>
              <span className="mr-1 text-text-secondary">Dates like 03/10/2026 mean</span>
              {[
                [true, "3 Oct (day first)"],
                [false, "Mar 10 (month first)"],
              ].map(([v, label]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => {
                    setDayFirst(v as boolean);
                    if (csv) preview(csv, mapping, v as boolean);
                  }}
                  className={cn("tap h-9 rounded-full px-3.5 font-medium", dayFirst === v ? "bg-white text-black" : "glass text-text-secondary")}
                >
                  {label as string}
                </button>
              ))}
            </fieldset>
          </details>

          {plan.errors.length ? (
            <div className="rounded-3xl bg-red/10 p-4 text-sm ring-1 ring-red/30 ring-inset">
              <p className="font-semibold text-red-text">{plan.errors.length} rows can&apos;t be imported</p>
              <p className="mt-1 text-text-secondary">
                {plan.errors
                  .slice(0, 12)
                  .map((e) => `Row ${e.row}: ${e.error}`)
                  .join(" · ")}
              </p>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-hairline bg-surface-1">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-hairline text-xs text-text-tertiary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Row</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Membership</th>
                    <th className="px-4 py-3 font-medium">Card</th>
                    <th className="px-4 py-3 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {plan.rows.slice(0, 200).map((r) => (
                    <tr key={r.draft.row} className="align-top">
                      <td className="tabular px-4 py-3 text-text-tertiary">{r.draft.row}</td>
                      <td className="px-4 py-3 font-medium">
                        {r.draft.firstName} {r.draft.lastName}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{r.draft.email ?? r.draft.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.draft.membership ? (
                          <>
                            {r.draft.membership.planName}
                            <span className="tabular block text-xs text-text-tertiary">
                              {r.draft.membership.startsOn} → {r.draft.membership.endsOn}
                              {r.draft.membership.startEstimated ? " (start estimated)" : ""}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="tabular px-4 py-3 font-mono text-text-secondary">{r.draft.cardCode ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold capitalize", ACTION_STYLE[r.action])}>
                          {r.action === "create" ? "New" : r.action}
                        </span>
                        {r.note ? <span className="mt-1 block text-xs text-text-tertiary">{r.matchName ? `${r.matchName}: ` : ""}{r.note}</span> : null}
                        {r.draft.warnings.map((w) => (
                          <span key={w} className="mt-1 block text-xs text-energy">
                            {w}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {plan.rows.length > 200 ? <p className="border-t border-hairline px-4 py-3 text-xs text-text-tertiary">Showing 200 of {plan.rows.length} rows.</p> : null}
          </div>

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-hairline-strong bg-surface-2/90 p-4 backdrop-blur-xl lg:bottom-4">
            <p className="text-sm text-text-secondary">
              {plan.totals.create + plan.totals.update === 0 ? "Nothing new to import." : `${plan.totals.create} new and ${plan.totals.update} updated members will be saved.`}
            </p>
            <Button size="lg" onClick={run} disabled={pending || plan.totals.create + plan.totals.update === 0}>
              {pending ? "Importing…" : "Import members"}
            </Button>
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
