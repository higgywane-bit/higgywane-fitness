"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { importSalesAction } from "@/app/admin/actions";
import { formatTHB } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SalesImport() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  async function load(file: File) {
    const text = await file.text();
    start(async () => {
      const res = await importSalesAction(text);
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      const d = res.data;
      if (!d.inserted && !d.duplicates) {
        return setMsg({ ok: false, text: d.skipped[0]?.reason ?? "No sales found in that file. It needs a date and a total column." });
      }
      setMsg({
        ok: true,
        text: `${d.inserted} sales added (${formatTHB(d.total)} in file)${d.duplicates ? ` · ${d.duplicates} already imported` : ""}${d.skippedCount ? ` · ${d.skippedCount} rows skipped (voids/refunds/unreadable)` : ""}.`,
      });
      router.refresh();
    });
  }

  return (
    <div>
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
          "flex min-h-32 cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-5 transition-colors",
          dragging ? "border-white bg-white/[0.04]" : "border-hairline-strong hover:border-white/40",
        )}
      >
        <span className="glass grid size-12 shrink-0 place-items-center rounded-xl">
          <FileUp className="size-5" aria-hidden />
        </span>
        <span className="text-sm">
          <span className="block font-semibold">{pending ? "Importing…" : "Drop a Qashier sales export (.csv)"}</span>
          <span className="text-text-secondary">Receipts already imported are skipped, so overlapping exports are fine.</span>
        </span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
      </label>
      {msg ? (
        <p role="status" className={cn("mt-3 text-sm font-medium", msg.ok ? "text-success" : "text-red-text")}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
