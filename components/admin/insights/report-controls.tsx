"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteReportAction, updateReportAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { KIND_LABEL, type ReportKind } from "@/lib/reports/analyze";

type Col = { index: number; header: string; type: string };

const selectClass = "h-11 w-full rounded-xl border border-hairline-strong bg-surface-2 px-3 text-sm text-white";

/** Change what the report charts. Choices live in the URL, so a view can be bookmarked or shared. */
export function ReportControls({
  id,
  kind,
  columns,
  dateCol,
  valueCol,
  groupCol,
  dayFirst,
}: {
  id: string;
  kind: ReportKind;
  columns: Col[];
  dateCol: number | null;
  valueCol: number | null;
  groupCol: number | null;
  dayFirst: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <div className="grid gap-3 rounded-3xl border border-hairline bg-surface-1 p-4 sm:grid-cols-2 lg:grid-cols-5 md:p-5">
      <label className="block text-sm">
        <span className="mb-1.5 block text-text-secondary">Report type</span>
        <select
          className={selectClass}
          value={kind}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              await updateReportAction(id, { kind: e.target.value as ReportKind });
              const next = new URLSearchParams(params);
              ["date", "value", "group"].forEach((k) => next.delete(k));
              router.replace(`${pathname}?${next}`, { scroll: false });
              router.refresh();
            })
          }
        >
          {(Object.keys(KIND_LABEL) as ReportKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-text-secondary">Date column</span>
        <select className={selectClass} value={dateCol ?? "none"} onChange={(e) => set("date", e.target.value)}>
          <option value="none">— none —</option>
          {columns.filter((c) => c.type === "date").map((c) => (
            <option key={c.index} value={c.index}>
              {c.header}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-text-secondary">Measure</span>
        <select className={selectClass} value={valueCol ?? "count"} onChange={(e) => set("value", e.target.value)}>
          <option value="count">Number of rows</option>
          {columns.filter((c) => c.type === "money" || c.type === "number").map((c) => (
            <option key={c.index} value={c.index}>
              Sum of {c.header}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-text-secondary">Group by</span>
        <select className={selectClass} value={groupCol ?? "none"} onChange={(e) => set("group", e.target.value)}>
          <option value="none">— none —</option>
          {columns.filter((c) => c.type === "category" || c.type === "text").map((c) => (
            <option key={c.index} value={c.index}>
              {c.header}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-text-secondary">Dates like 03/10</span>
        <select className={selectClass} value={dayFirst ? "1" : "0"} onChange={(e) => set("df", e.target.value)}>
          <option value="1">3 October (day first)</option>
          <option value="0">10 March (month first)</option>
        </select>
      </label>
    </div>
  );
}

export function DeleteReportButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await deleteReportAction(id);
            router.push("/admin/insights");
            router.refresh();
          })
        }
      >
        Delete report
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        Keep
      </Button>
    </div>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} className="text-text-secondary">
      <Trash2 className="size-4" aria-hidden />
      Delete
    </Button>
  );
}
