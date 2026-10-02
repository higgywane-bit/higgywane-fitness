"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { uploadReportAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export function ReportUpload() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function upload(files: FileList | File[]) {
    const list = [...files].filter((f) => /\.csv$/i.test(f.name) || f.type === "text/csv");
    if (!list.length) return setMsg({ ok: false, text: "Upload CSV files. In Glofox, choose Download / Export as CSV." });
    setMsg(null);
    start(async () => {
      const ids: string[] = [];
      for (const f of list) {
        const res = await uploadReportAction(await f.text(), f.name);
        if (!res.ok) return setMsg({ ok: false, text: `${f.name}: ${res.error}` });
        ids.push(res.data);
      }
      if (ids.length === 1) router.push(`/admin/insights/${ids[0]}`);
      else {
        setMsg({ ok: true, text: `${ids.length} reports added.` });
        router.refresh();
      }
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
          upload(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-white bg-white/[0.04]" : "border-hairline-strong hover:border-white/40",
        )}
      >
        <span className="glass grid size-14 place-items-center rounded-2xl">
          <FileUp className="size-6" aria-hidden />
        </span>
        <span>
          <span className="block text-lg font-semibold">{pending ? "Reading…" : "Drop Glofox reports here"}</span>
          <span className="mt-1 block text-sm text-text-secondary">Any CSV export: transactions, attendance, members. Drop several at once.</span>
        </span>
        <input type="file" accept=".csv,text/csv" multiple className="sr-only" onChange={(e) => e.target.files && upload(e.target.files)} />
      </label>
      {msg ? (
        <p role="status" className={cn("mt-3 text-sm font-medium", msg.ok ? "text-success" : "text-red-text")}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
