"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Ingredient, MenuItem, Option, OptionGroup } from "@/content/types";
import { formatTHBDelta } from "@/lib/format";
import { ingredientMacros, roundMacros } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { EditorDrawer, EditorSection, NumberField, SaveFooter, Switch, TextField, useSectionSave } from "./kit";

const blankGroup = (): OptionGroup => ({ id: "", title: "", type: "multi", options: [{ id: "", label: "", priceDelta: 0 }] });

export function AddonsEditor({ groups, menu, ingredients }: { groups: OptionGroup[]; menu: MenuItem[]; ingredients: Ingredient[] }) {
  const [editing, setEditing] = useState<{ group: OptionGroup; index: number } | null>(null);
  const usedBy = (id: string) => menu.filter((m) => m.optionGroups?.includes(id));

  return (
    <div className="px-4 pb-28 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-text-secondary">Sizes, milks, protein scoops and extras. Each option carries its price and, through its ingredient, its macros.</p>
        <Button variant="inverse" onClick={() => setEditing({ group: blankGroup(), index: -1 })}>
          <Plus className="size-4" aria-hidden /> Add group
        </Button>
      </div>
      <ul className="mt-5 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {groups.map((g, index) => {
          const used = usedBy(g.id);
          return (
            <li key={g.id}>
              <button type="button" onClick={() => setEditing({ group: g, index })} className="tap flex h-full w-full flex-col rounded-[22px] border border-hairline bg-surface-1 p-4 text-left hover:bg-surface-2">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-xl uppercase">{g.title}</span>
                  <span className="text-xs text-text-tertiary">{g.type === "single" ? "Pick one" : `Pick any${g.max ? ` · max ${g.max}` : ""}`}</span>
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {g.options.map((o) => (
                    <span key={o.id} className="tabular inline-flex h-7 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-xs">
                      {o.label}
                      {o.priceDelta ? <span className="text-text-tertiary">{formatTHBDelta(o.priceDelta)}</span> : null}
                    </span>
                  ))}
                </span>
                <span className="mt-3 text-xs text-text-tertiary">{used.length ? `On ${used.length} item${used.length === 1 ? "" : "s"}: ${used.map((m) => m.name).slice(0, 4).join(", ")}${used.length > 4 ? "…" : ""}` : "Not on any item yet"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {editing ? <GroupEditor key={editing.index} initial={editing.group} index={editing.index} groups={groups} ingredients={ingredients} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function GroupEditor({ initial, index, groups, ingredients, onClose }: { initial: OptionGroup; index: number; groups: OptionGroup[]; ingredients: Ingredient[]; onClose: () => void }) {
  const [g, setG] = useState<OptionGroup>(initial);
  const { save, pending, error, saved } = useSectionSave("optionGroups");
  const isNew = index < 0;
  const set = <K extends keyof OptionGroup>(k: K, v: OptionGroup[K]) => setG((s) => ({ ...s, [k]: v }));
  const setOpt = (i: number, patch: Partial<Option>) => set("options", g.options.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const commit = () => save(isNew ? [...groups, g] : groups.map((x, i) => (i === index ? g : x)), onClose);
  const remove = () => save(groups.filter((_, i) => i !== index), onClose);

  return (
    <EditorDrawer
      open
      onClose={onClose}
      title={isNew ? "New add-on group" : g.title || "Add-ons"}
      description="Prices are added to the item; macros come from the linked ingredient."
      footer={<SaveFooter onSave={commit} onDelete={isNew ? undefined : remove} pending={pending} error={error} saved={saved} disabled={!g.title.trim()} />}
    >
      <EditorSection title="Group">
        <TextField label="Name customers see" value={g.title} onChange={(v) => set("title", v)} placeholder="Boost it" maxLength={40} />
        <div role="radiogroup" aria-label="Choice" className="grid grid-cols-2 gap-2">
          {(["single", "multi"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={g.type === t}
              onClick={() => set("type", t)}
              className={cn("tap h-12 rounded-2xl text-sm font-semibold", g.type === t ? "bg-white text-black" : "bg-surface-2 text-text-secondary ring-1 ring-hairline-strong ring-inset")}
            >
              {t === "single" ? "Pick one" : "Pick any"}
            </button>
          ))}
        </div>
        {g.type === "single" ? (
          <Switch label="Required" description="Customer must choose one (e.g. size, milk)" checked={!!g.required} onChange={(v) => set("required", v || undefined)} />
        ) : (
          <NumberField label="Most they can pick" hint="Leave empty for no limit" value={g.max} onChange={(v) => set("max", v)} className="max-w-48" />
        )}
        <Switch label="Scales with size" description="Large uses more of this (milk base, syrup)" checked={!!g.scalesWithSize} onChange={(v) => set("scalesWithSize", v || undefined)} />
      </EditorSection>

      <EditorSection
        title="Options"
        action={
          <Button type="button" variant="ghost" size="sm" onClick={() => set("options", [...g.options, { id: "", label: "", priceDelta: 0 }])}>
            <Plus className="size-4" aria-hidden /> Option
          </Button>
        }
      >
        <ul className="space-y-3">
          {g.options.map((o, i) => {
            const m = o.ingredientId && o.grams ? roundMacros(ingredientMacros(o.ingredientId, o.grams)) : null;
            return (
              <li key={i} className="space-y-3 rounded-2xl bg-surface-2 p-3">
                <div className="flex gap-2">
                  <Input aria-label="Option name" placeholder="Whey scoop" value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} className="flex-1" />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove option" onClick={() => set("options", g.options.filter((_, j) => j !== i))} disabled={g.options.length === 1}>
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input aria-label="Detail" placeholder="Detail, e.g. 30 g" value={o.detail ?? ""} onChange={(e) => setOpt(i, { detail: e.target.value || undefined })} />
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-tertiary">฿</span>
                    <Input
                      aria-label="Price change"
                      inputMode="numeric"
                      value={String(o.priceDelta)}
                      onChange={(e) => setOpt(i, { priceDelta: Number(e.target.value.replace(/[^\d-]/g, "")) || 0 })}
                      className="tabular pl-9"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Ingredient (for macros)"
                    value={o.ingredientId ?? ""}
                    onChange={(e) => setOpt(i, { ingredientId: e.target.value || undefined })}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-hairline-strong bg-surface-3 px-3 text-sm text-white"
                  >
                    <option value="">No ingredient</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name}
                      </option>
                    ))}
                  </select>
                  {o.ingredientId && !o.replaces ? (
                    <div className="relative w-24">
                      <Input aria-label="Grams" inputMode="decimal" value={o.grams === undefined ? "" : String(o.grams)} onChange={(e) => setOpt(i, { grams: Number(e.target.value.replace(/[^\d.]/g, "")) || undefined })} className="tabular h-11 pr-8" />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-tertiary">g</span>
                    </div>
                  ) : null}
                  {g.type === "single" ? (
                    <button
                      type="button"
                      aria-pressed={!!o.default}
                      onClick={() => set("options", g.options.map((x, j) => ({ ...x, default: j === i ? !o.default || undefined : undefined })))}
                      className={cn("tap h-11 rounded-xl px-3 text-xs font-semibold", o.default ? "bg-white text-black" : "bg-surface-3 text-text-secondary")}
                    >
                      Default
                    </button>
                  ) : null}
                </div>
                {m ? (
                  <p className="tabular text-xs text-text-tertiary">
                    Adds {m.kcal} kcal · {m.protein} g protein · {m.carbs} g carbs · {m.fat} g fat
                  </p>
                ) : o.replaces ? (
                  <p className="text-xs text-text-tertiary">Swaps the recipe&apos;s {o.replaces.replace(/-/g, " ")} for this.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </EditorSection>
    </EditorDrawer>
  );
}
