"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, ChevronUp, Plus, Search, Settings2, X } from "lucide-react";
import { DrinkArt } from "@/components/cafe/drink-art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemTag, TAG_META } from "@/components/ui/tag";
import type { Category, Ingredient, MenuItem, OptionGroup, RecipeLine, Tag } from "@/content/types";
import { TAGS, VESSELS } from "@/lib/catalog/validate";
import { formatTHB } from "@/lib/format";
import { itemDefaults, itemPrice, roundMacros } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { Chips, EditorDrawer, EditorSection, ImageUpload, NumberField, SaveFooter, Switch, TextField, useSectionSave } from "./kit";

const blank = (category: string): MenuItem => ({
  id: "",
  slug: "",
  category,
  name: "",
  description: "",
  recipe: [],
  basePrice: 0,
  tint: "#3a3a3a",
  vessel: "glass",
  tags: [],
  badges: [],
  optionGroups: [],
  available: true,
});

export function MenuEditor({ menu, categories, groups, ingredients }: { menu: MenuItem[]; categories: Category[]; groups: OptionGroup[]; ingredients: Ingredient[] }) {
  const [cat, setCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ item: MenuItem; index: number } | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const quick = useSectionSave("menu");

  const shown = menu
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => (cat === "all" || item.category === cat) && (!query.trim() || item.name.toLowerCase().includes(query.trim().toLowerCase())));

  function toggleAvailable(index: number) {
    quick.save(menu.map((m, i) => (i === index ? { ...m, available: m.available === false } : m)));
  }

  return (
    <div className="px-4 pb-28 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-tertiary" aria-hidden />
          <Input aria-label="Search the menu" placeholder="Search items" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-11" />
        </div>
        <Button variant="ghost" onClick={() => setCatsOpen(true)}>
          <Settings2 className="size-4" aria-hidden />
          Categories
        </Button>
        <Button variant="inverse" onClick={() => setEditing({ item: blank(cat === "all" ? (categories[0]?.id ?? "") : cat), index: -1 })}>
          <Plus className="size-4" aria-hidden />
          Add item
        </Button>
      </div>

      <div role="tablist" aria-label="Categories" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {[{ id: "all", title: "All" }, ...categories].map((c) => {
          const n = c.id === "all" ? menu.length : menu.filter((m) => m.category === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              onClick={() => setCat(c.id)}
              className={cn("tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium", cat === c.id ? "bg-white text-black" : "glass text-text-secondary hover:text-white")}
            >
              {c.title}
              <span className={cn("tabular text-xs", cat === c.id ? "text-black/60" : "text-text-tertiary")}>{n}</span>
            </button>
          );
        })}
      </div>

      {quick.error ? (
        <p role="alert" className="mt-3 text-sm text-red-text">
          {quick.error}
        </p>
      ) : null}

      <ul className="mt-5 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {shown.map(({ item, index }) => {
          const { macros } = itemDefaults(item);
          const m = roundMacros(macros);
          const soldOut = item.available === false;
          return (
            <li key={item.id} className={cn("flex items-center gap-3 rounded-[22px] border border-hairline bg-surface-1 p-2.5 pr-3 transition-opacity", soldOut && "opacity-60")}>
              <button type="button" onClick={() => setEditing({ item, index })} className="tap flex min-w-0 flex-1 items-center gap-3 text-left">
                <DrinkArt item={item} className="size-16 shrink-0 rounded-2xl" sizes="64px" />
                <span className="min-w-0">
                  <span className="block truncate font-display text-xl uppercase">{item.name}</span>
                  <span className="tabular block truncate text-xs text-text-secondary">
                    {item.priceIsFrom ? "from " : ""}
                    {formatTHB(item.basePrice)} · {m.kcal} kcal · {m.protein} g protein
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                    {(item.optionGroups?.length ?? 0) > 0 ? `${item.optionGroups!.length} add-on groups` : "No add-ons"}
                    {soldOut ? " · Sold out" : ""}
                  </span>
                </span>
              </button>
              <label className="flex shrink-0 flex-col items-center gap-1">
                <span className="sr-only">{item.name} on sale</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!soldOut}
                  aria-label={`${item.name}: ${soldOut ? "sold out" : "on sale"}`}
                  disabled={quick.pending}
                  onClick={() => toggleAvailable(index)}
                  className={cn("relative h-7 w-12 rounded-full transition-colors", soldOut ? "bg-surface-4" : "bg-success")}
                >
                  <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform", !soldOut && "translate-x-5")} />
                </button>
                <span className="text-[10px] font-semibold tracking-wide text-text-tertiary uppercase">{soldOut ? "Sold out" : "On sale"}</span>
              </label>
            </li>
          );
        })}
      </ul>

      {editing ? (
        <ItemEditor
          key={editing.index + editing.item.id}
          initial={editing.item}
          isNew={editing.index < 0}
          menu={menu}
          index={editing.index}
          categories={categories}
          groups={groups}
          ingredients={ingredients}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {catsOpen ? <CategoriesEditor categories={categories} onClose={() => setCatsOpen(false)} /> : null}
    </div>
  );
}

function ItemEditor({
  initial,
  isNew,
  menu,
  index,
  categories,
  groups,
  ingredients,
  onClose,
}: {
  initial: MenuItem;
  isNew: boolean;
  menu: MenuItem[];
  index: number;
  categories: Category[];
  groups: OptionGroup[];
  ingredients: Ingredient[];
  onClose: () => void;
}) {
  const [item, setItem] = useState<MenuItem>(initial);
  const { save, pending, error, saved } = useSectionSave("menu");
  const set = <K extends keyof MenuItem>(k: K, v: MenuItem[K]) => setItem((s) => ({ ...s, [k]: v }));

  const preview = useMemo(() => {
    try {
      const d = itemDefaults(item);
      return { price: itemPrice(item, d.selections), m: roundMacros(d.macros) };
    } catch {
      return null;
    }
  }, [item]);

  function commit() {
    const next = isNew ? [...menu, item] : menu.map((m, i) => (i === index ? item : m));
    save(next, onClose);
  }

  function remove() {
    save(
      menu.filter((_, i) => i !== index),
      onClose,
    );
  }

  const setLine = (i: number, patch: Partial<RecipeLine>) => set("recipe", item.recipe.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <EditorDrawer
      open
      onClose={onClose}
      title={isNew ? "New item" : item.name || "Item"}
      description={isNew ? "Shows on the website and the till as soon as you save." : "Changes go live on the website and the till when you save."}
      footer={<SaveFooter onSave={commit} onDelete={isNew ? undefined : remove} pending={pending} error={error} saved={saved} disabled={!item.name.trim()} />}
    >
      {/* live mirror of the product card */}
      <div className="flex items-center gap-4 rounded-3xl bg-surface-2 p-3">
        <DrinkArt item={{ ...item, slug: item.slug || "preview", name: item.name || "New item" }} className="size-24 shrink-0 rounded-2xl" sizes="96px" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.16em] text-text-tertiary uppercase">Live preview</p>
          <p className="truncate font-display text-2xl uppercase">{item.name || "New item"}</p>
          {item.tags?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.tags.slice(0, 2).map((t) => (
                <ItemTag key={t} tag={t} />
              ))}
            </div>
          ) : null}
          {preview ? (
            <p className="tabular mt-1 text-sm text-text-secondary">
              <span className="font-semibold text-white">{formatTHB(preview.price)}</span> · {preview.m.kcal} kcal · <span className="text-red-text">{preview.m.protein} g</span> protein
            </p>
          ) : null}
        </div>
      </div>

      <EditorSection title="Basics">
        <ImageUpload label="Photo" alt={item.name} value={item.image} onChange={(v) => set("image", v)} />
        <TextField label="Name" value={item.name} onChange={(v) => set("name", v)} maxLength={60} />
        <TextField label="Description" value={item.description ?? ""} onChange={(v) => set("description", v)} multiline maxLength={220} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Price" prefix="฿" value={item.basePrice} onChange={(v) => set("basePrice", v ?? 0)} />
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Category</p>
            <select
              aria-label="Category"
              value={item.category}
              onChange={(e) => set("category", e.target.value)}
              className="h-12 w-full rounded-2xl border border-hairline-strong bg-surface-2 px-4 text-base text-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Switch label="Show as “from” price" description="When add-ons or sizes change the price" checked={!!item.priceIsFrom} onChange={(v) => set("priceIsFrom", v || undefined)} />
        <Switch label="On sale" description="Off = sold out on the website and the till" checked={item.available !== false} onChange={(v) => set("available", v)} />
        <Chips label="Tags" options={TAGS.map((t) => ({ id: t, label: TAG_META[t].label }))} value={item.tags ?? []} onChange={(v) => set("tags", v as Tag[])} />
        <TextField label="Badge" hint="Optional, e.g. Under 200 kcal" value={item.badges?.[0] ?? ""} onChange={(v) => set("badges", v ? [v] : [])} maxLength={24} />
      </EditorSection>

      <EditorSection
        title="Recipe"
        action={
          <Button type="button" variant="ghost" size="sm" onClick={() => set("recipe", [...item.recipe, { ingredientId: ingredients[0]?.id ?? "", grams: 30 }])}>
            <Plus className="size-4" aria-hidden /> Ingredient
          </Button>
        }
      >
        {item.recipe.length === 0 ? <p className="text-sm text-text-tertiary">No ingredients yet. Macros are worked out from these.</p> : null}
        <ul className="space-y-2">
          {item.recipe.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-2">
              <select
                aria-label="Ingredient"
                value={r.ingredientId}
                onChange={(e) => setLine(i, { ingredientId: e.target.value })}
                className="h-11 min-w-0 flex-1 rounded-xl border border-hairline-strong bg-surface-3 px-3 text-sm text-white"
              >
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                  </option>
                ))}
              </select>
              <div className="relative w-24">
                <Input
                  aria-label="Grams"
                  inputMode="decimal"
                  value={String(r.grams)}
                  onChange={(e) => setLine(i, { grams: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                  className="tabular h-11 pr-8"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-tertiary">g</span>
              </div>
              <button
                type="button"
                aria-pressed={!!r.removable}
                onClick={() => setLine(i, { removable: !r.removable || undefined })}
                className={cn("tap h-11 rounded-xl px-3 text-xs font-semibold", r.removable ? "bg-white text-black" : "bg-surface-3 text-text-secondary")}
                title="Customers can leave this out"
              >
                Can remove
              </button>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove ingredient" onClick={() => set("recipe", item.recipe.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </EditorSection>

      <EditorSection title="Add-ons & options">
        <p className="-mt-2 text-sm text-text-tertiary">Pick the groups customers can choose from. Edit the groups themselves in the Add-ons tab.</p>
        <ul className="space-y-2">
          {groups.map((g) => {
            const on = item.optionGroups?.includes(g.id) ?? false;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("optionGroups", on ? item.optionGroups!.filter((x) => x !== g.id) : [...(item.optionGroups ?? []), g.id])}
                  className={cn("tap flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left", on ? "bg-white text-black" : "bg-surface-2 hover:bg-surface-3")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">
                      {g.title} <span className={cn("text-xs font-normal", on ? "text-black/50" : "text-text-tertiary")}>{g.id}</span>
                    </span>
                    <span className={cn("block truncate text-xs", on ? "text-black/60" : "text-text-tertiary")}>{g.options.map((o) => o.label).join(" · ")}</span>
                  </span>
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", on ? "bg-black text-white" : "ring-1 ring-hairline-strong")}>
                    {on ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </EditorSection>

      <EditorSection title="Look">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Colour</p>
            <label className="flex h-12 items-center gap-3 rounded-2xl border border-hairline-strong bg-surface-2 px-3">
              <input type="color" value={item.tint} onChange={(e) => set("tint", e.target.value)} className="size-7 cursor-pointer rounded-md bg-transparent" aria-label="Colour" />
              <span className="tabular font-mono text-sm uppercase">{item.tint}</span>
            </label>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Served in</p>
            <select
              aria-label="Served in"
              value={item.vessel ?? "glass"}
              onChange={(e) => set("vessel", e.target.value as MenuItem["vessel"])}
              className="h-12 w-full rounded-2xl border border-hairline-strong bg-surface-2 px-4 text-base text-white"
            >
              {VESSELS.map((v) => (
                <option key={v} value={v}>
                  {v === "glass" ? "Tall glass" : v === "cup" ? "Cup" : "Espresso cup"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-text-tertiary">Used until there&apos;s a photo.</p>
      </EditorSection>

      {!isNew ? (
        <Link href={`/cafe/${item.slug}`} target="_blank" className="tap inline-flex items-center gap-1.5 text-sm text-text-secondary underline-offset-4 hover:text-white hover:underline">
          View on the website <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </EditorDrawer>
  );
}

function CategoriesEditor({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const [rows, setRows] = useState<Category[]>(categories);
  const { save, pending, error, saved } = useSectionSave("categories");
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };
  return (
    <EditorDrawer
      open
      onClose={onClose}
      title="Categories"
      description="Order here is the order on the menu."
      footer={<SaveFooter onSave={() => save(rows, onClose)} pending={pending} error={error} saved={saved} />}
    >
      <ul className="space-y-3">
        {rows.map((c, i) => (
          <li key={i} className="space-y-3 rounded-2xl bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <Input aria-label="Category name" value={c.title} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)))} className="flex-1" />
              <Button type="button" variant="ghost" size="icon" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                <ChevronUp className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                <ChevronDown className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove category" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </Button>
            </div>
            <Input aria-label="Category blurb" placeholder="One line under the title" value={c.blurb} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, blurb: e.target.value } : r)))} />
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" onClick={() => setRows([...rows, { id: "", title: "", blurb: "" }])}>
        <Plus className="size-4" aria-hidden /> Add category
      </Button>
    </EditorDrawer>
  );
}
