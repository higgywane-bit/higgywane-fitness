"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Allergen, Ingredient, Macros } from "@/content/types";
import { ALLERGENS } from "@/lib/catalog/validate";
import { ALLERGEN_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DirtyBar, useSectionSave } from "./kit";

const MACROS: { key: keyof Macros; label: string }[] = [
  { key: "kcal", label: "kcal" },
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbs" },
  { key: "fat", label: "Fat" },
  { key: "sugar", label: "Sugar" },
  { key: "fibre", label: "Fibre" },
];

/** Nutrition per 100 g / 100 ml. Every recipe and add-on works its macros out from here. */
export function IngredientsEditor({ ingredients }: { ingredients: Ingredient[] }) {
  const [rows, setRows] = useState(ingredients);
  const [query, setQuery] = useState("");
  const { save, pending, error } = useSectionSave("ingredients");
  const dirty = JSON.stringify(rows) !== JSON.stringify(ingredients);
  const set = (i: number, patch: Partial<Ingredient>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const needle = query.trim().toLowerCase();

  return (
    <div className="px-4 pb-32 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Search ingredients" placeholder="Search ingredients" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs flex-1" />
        <Button variant="inverse" onClick={() => setRows([...rows, { id: "", name: "", per100: { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fibre: 0 } }])}>
          <Plus className="size-4" aria-hidden /> Add ingredient
        </Button>
        <p className="w-full text-xs text-text-tertiary">Values per 100 g (or 100 ml for liquids).</p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-3xl border border-hairline">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-surface-1 text-left text-xs text-text-tertiary">
            <tr>
              <th className="px-3 py-3 font-medium">Ingredient</th>
              {MACROS.map((m) => (
                <th key={m.key} className="w-20 px-1 py-3 text-right font-medium">
                  {m.label}
                </th>
              ))}
              <th className="px-3 py-3 font-medium">Allergens</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((r, i) =>
              needle && !r.name.toLowerCase().includes(needle) ? null : (
                <tr key={i} className="align-middle">
                  <td className="px-2 py-1.5">
                    <Input aria-label="Ingredient name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} className="h-10 rounded-xl" />
                  </td>
                  {MACROS.map((m) => (
                    <td key={m.key} className="px-1 py-1.5">
                      <Input
                        aria-label={`${r.name} ${m.label}`}
                        inputMode="decimal"
                        value={String(r.per100[m.key] ?? 0)}
                        onChange={(e) => set(i, { per100: { ...r.per100, [m.key]: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } })}
                        className="tabular h-10 rounded-xl px-2 text-right"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {ALLERGENS.map((a) => {
                        const on = r.allergens?.includes(a) ?? false;
                        return (
                          <button
                            key={a}
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              const next = on ? r.allergens!.filter((x) => x !== a) : [...(r.allergens ?? []), a as Allergen];
                              set(i, { allergens: next.length ? next : undefined });
                            }}
                            className={cn("tap h-8 rounded-full px-2.5 text-[11px] font-semibold", on ? "bg-energy text-black" : "bg-surface-3 text-text-tertiary hover:text-white")}
                          >
                            {ALLERGEN_LABEL[a]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${r.name}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      <X className="size-4" />
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <DirtyBar dirty={dirty} onSave={() => save(rows, (clean) => setRows(clean))} onDiscard={() => setRows(ingredients)} pending={pending} error={error} />
    </div>
  );
}
