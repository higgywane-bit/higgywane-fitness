"use client";

import { useState } from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Plan, PlanKind } from "@/content/plans";
import { formatTHB } from "@/lib/format";
import { memberships, ptPackages } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { DirtyBar, useSectionSave } from "./kit";

/** Prices the desk sells at and the Train page shows. Savings are worked out, never typed. */
export function PlansEditor({ plans }: { plans: Plan[] }) {
  const [rows, setRows] = useState(plans);
  const { save, pending, error } = useSectionSave("plans");
  const dirty = JSON.stringify(rows) !== JSON.stringify(plans);
  const set = (i: number, patch: Partial<Plan>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const savings = new Map<string, number>();
  for (const m of memberships(rows.filter((p) => p.kind === "membership" && !p.hidden))) if (m.saving) savings.set(m.id, m.saving);
  for (const p of ptPackages(rows.filter((p) => p.kind === "pt" && !p.hidden).map((p) => ({ id: p.id, name: p.name, sessions: p.sessions ?? 1, price: p.price })))) if (p.saving) savings.set(p.id, p.saving);

  const add = (kind: PlanKind) =>
    setRows([...rows, kind === "pt" ? { id: "", name: "", kind, price: 0, duration: { months: 3 }, sessions: 5 } : { id: "", name: "", kind, price: 0, duration: { months: 1 } }]);

  return (
    <div className="space-y-8 px-4 pb-32 md:px-8">
      {(["membership", "pt"] as const).map((kind) => (
        <section key={kind}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl uppercase">{kind === "pt" ? "Personal training" : "Memberships"}</h2>
            <Button variant="ghost" size="sm" onClick={() => add(kind)}>
              <Plus className="size-4" aria-hidden /> Add
            </Button>
          </div>
          <ul className="space-y-2">
            {rows.map((p, i) =>
              p.kind !== kind ? null : (
                <li key={i} className={cn("grid grid-cols-2 items-end gap-2 rounded-[22px] border border-hairline bg-surface-1 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_17.5rem_9.5rem] md:gap-3", p.hidden && "opacity-55")}>
                  <label className="col-span-2 sm:col-span-1">
                    <span className="mb-1.5 block text-xs text-text-tertiary">Name</span>
                    <Input value={p.name} onChange={(e) => set(i, { name: e.target.value })} className="h-11" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs text-text-tertiary">Price</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary">฿</span>
                      <Input inputMode="numeric" value={String(p.price)} onChange={(e) => set(i, { price: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="tabular h-11 pl-8" />
                    </div>
                  </label>
                  <div className="col-span-2 flex gap-2 max-sm:order-1 sm:col-span-1">
                    {kind === "pt" ? (
                      <label className="w-[4.5rem] shrink-0">
                        <span className="mb-1.5 block text-xs text-text-tertiary">Sessions</span>
                        <Input inputMode="numeric" value={String(p.sessions ?? "")} onChange={(e) => set(i, { sessions: Number(e.target.value.replace(/\D/g, "")) || undefined })} className="tabular h-11" />
                      </label>
                    ) : null}
                    <label className="w-[4.5rem] shrink-0">
                      <span className="mb-1.5 block text-xs text-text-tertiary">{kind === "pt" ? "Valid" : "Length"}</span>
                      <Input
                        inputMode="numeric"
                        value={String("months" in p.duration ? p.duration.months : p.duration.days)}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/\D/g, "")) || 1;
                          set(i, { duration: "months" in p.duration ? { months: n } : { days: n } });
                        }}
                        className="tabular h-11"
                      />
                    </label>
                    <label className="min-w-[6.5rem] flex-1">
                      <span className="mb-1.5 block text-xs text-text-tertiary">&nbsp;</span>
                      <select
                        aria-label="Unit"
                        value={"months" in p.duration ? "months" : "days"}
                        onChange={(e) => {
                          const n = "months" in p.duration ? p.duration.months : p.duration.days;
                          set(i, { duration: e.target.value === "months" ? { months: n } : { days: n } });
                        }}
                        className="h-11 w-full rounded-2xl border border-hairline-strong bg-surface-2 px-3 text-sm text-white"
                      >
                        <option value="days">days</option>
                        <option value="months">months</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {savings.get(p.id) ? <span className="tabular rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">Save {formatTHB(savings.get(p.id)!)}</span> : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={p.hidden ? `Show ${p.name}` : `Hide ${p.name}`}
                      aria-pressed={!p.hidden}
                      onClick={() => set(i, { hidden: p.hidden ? undefined : true })}
                    >
                      {p.hidden ? <EyeOff className="size-5 text-text-tertiary" /> : <Eye className="size-5" />}
                    </Button>
                  </div>
                  <label className="col-span-2 grid gap-2 max-sm:order-2 sm:col-span-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <Input aria-label="Description" placeholder="Short line, e.g. 30 days unlimited" value={p.description ?? ""} onChange={(e) => set(i, { description: e.target.value || undefined })} className="h-10 text-sm" />
                    <Input aria-label="Badge" placeholder="Badge, e.g. Best value" value={p.badge ?? ""} onChange={(e) => set(i, { badge: e.target.value || undefined })} className="h-10 text-sm" />
                  </label>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
      <p className="text-xs text-text-tertiary">Plans that have been sold can be hidden but not deleted, so old memberships keep their names.</p>
      <DirtyBar dirty={dirty} onSave={() => save(rows, (clean) => setRows(clean))} onDiscard={() => setRows(plans)} pending={pending} error={error} />
    </div>
  );
}
