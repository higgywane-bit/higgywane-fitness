import { REMOVE_GROUP_ID } from "@/content/options";
import { getIngredient, getOptionGroup } from "@/lib/catalog";
import type { Allergen, CartLine, Macros, MenuItem, Option, OptionGroup, Selections } from "@/content/types";

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fibre: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    sugar: (a.sugar ?? 0) + (b.sugar ?? 0),
    fibre: (a.fibre ?? 0) + (b.fibre ?? 0),
  };
}

export function scaleMacros(m: Macros, k: number): Macros {
  return {
    kcal: m.kcal * k,
    protein: m.protein * k,
    carbs: m.carbs * k,
    fat: m.fat * k,
    sugar: (m.sugar ?? 0) * k,
    fibre: (m.fibre ?? 0) * k,
  };
}

export function subtractMacros(a: Macros, b: Macros): Macros {
  return addMacros(a, scaleMacros(b, -1));
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(addMacros, ZERO);
}

export function ingredientMacros(ingredientId: string, grams: number): Macros {
  return scaleMacros(getIngredient(ingredientId).per100, grams / 100);
}

/** Rounded for display: kcal to whole numbers, grams to whole numbers. */
export function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein: Math.round(m.protein),
    carbs: Math.round(m.carbs),
    fat: Math.round(m.fat),
    sugar: Math.round(m.sugar ?? 0),
    fibre: Math.round(m.fibre ?? 0),
  };
}

/* ------------------------------------------------------------------ groups */

/** All option groups for an item, including its generated "remove" group. */
export function itemGroups(item: MenuItem): OptionGroup[] {
  // a group deleted in admin simply drops off the item
  const groups = (item.optionGroups ?? []).map((id) => getOptionGroup(id)).filter((g): g is OptionGroup => !!g);
  const removable = item.recipe.filter((r) => r.removable);
  if (removable.length) {
    groups.push({
      id: REMOVE_GROUP_ID,
      title: "Leave out",
      type: "remove",
      options: removable.map((r) => ({
        id: r.ingredientId,
        label: `No ${getIngredient(r.ingredientId).name.toLowerCase()}`,
        priceDelta: 0,
      })),
    });
  }
  return groups;
}

export function defaultSelections(item: MenuItem): Selections {
  const out: Selections = {};
  for (const g of itemGroups(item)) {
    const override = item.defaults?.[g.id];
    if (override) {
      out[g.id] = [...override];
      continue;
    }
    const defs = g.options.filter((o) => o.default).map((o) => o.id);
    if (g.type === "single" && g.required && defs.length === 0) out[g.id] = [g.options[0].id];
    else out[g.id] = defs;
  }
  return out;
}

function selectedOptions(group: OptionGroup, selections: Selections): Option[] {
  const ids = selections[group.id] ?? [];
  return group.options.filter((o) => ids.includes(o.id));
}

/** Apply a tap on an option and return the next selections (pure). */
export function toggleOption(
  item: MenuItem,
  selections: Selections,
  groupId: string,
  optionId: string,
): Selections {
  const group = itemGroups(item).find((g) => g.id === groupId);
  if (!group) return selections;
  const current = selections[groupId] ?? [];
  let next: string[];
  if (group.type === "single") {
    if (current[0] === optionId && !group.required) next = [];
    else next = [optionId];
  } else if (current.includes(optionId)) {
    next = current.filter((id) => id !== optionId);
  } else {
    if (group.max && current.length >= group.max) return selections;
    next = [...current, optionId];
  }
  return { ...selections, [groupId]: next };
}

export function isSelectionValid(item: MenuItem, selections: Selections): boolean {
  return itemGroups(item).every((g) => {
    const n = (selections[g.id] ?? []).length;
    if (g.type === "single" && g.required) return n === 1;
    if (g.max) return n <= g.max;
    return true;
  });
}

/* ------------------------------------------------------------------ maths */

function optionMacros(o: Option): Macros {
  if (o.macroDelta) return o.macroDelta;
  if (o.ingredientId && o.grams !== undefined) return ingredientMacros(o.ingredientId, o.grams);
  return ZERO;
}

/**
 * Macros for one unit of an item with the given selections.
 * (recipe − removals, with swaps) + size-scaled groups, × size multiplier, + add-ons.
 */
export function itemMacros(item: MenuItem, selections: Selections): Macros {
  const groups = itemGroups(item);
  const removed = new Set(selections[REMOVE_GROUP_ID] ?? []);
  const chosen = groups.flatMap((g) => selectedOptions(g, selections).map((o) => ({ g, o })));

  const swaps = new Map<string, string>();
  for (const { o } of chosen) if (o.replaces && o.ingredientId) swaps.set(o.replaces, o.ingredientId);

  const multiplier = chosen.reduce((k, { o }) => k * (o.multiplier ?? 1), 1);

  let scaled = sumMacros(
    item.recipe
      .filter((r) => !removed.has(r.ingredientId))
      .map((r) => ingredientMacros(swaps.get(r.ingredientId) ?? r.ingredientId, r.grams)),
  );
  let fixed = ZERO;

  for (const { g, o } of chosen) {
    if (g.type === "remove" || o.replaces) continue;
    if (g.scalesWithSize) scaled = addMacros(scaled, optionMacros(o));
    else fixed = addMacros(fixed, optionMacros(o));
  }

  return addMacros(scaleMacros(scaled, multiplier), fixed);
}

/** Unit price in THB. */
export function itemPrice(item: MenuItem, selections: Selections): number {
  return itemGroups(item).reduce(
    (sum, g) => sum + selectedOptions(g, selections).reduce((s, o) => s + o.priceDelta, 0),
    item.basePrice,
  );
}

/** What a tap would change: used for the "+23 g protein, +฿40" feedback. */
export function optionImpact(item: MenuItem, selections: Selections, groupId: string, optionId: string) {
  const next = toggleOption(item, selections, groupId, optionId);
  return {
    selections: next,
    price: itemPrice(item, next) - itemPrice(item, selections),
    macros: subtractMacros(itemMacros(item, next), itemMacros(item, selections)),
  };
}

/** Lowest-price configuration, for "from ฿149" labels. */
export function itemDefaults(item: MenuItem) {
  const selections = defaultSelections(item);
  return { selections, price: itemPrice(item, selections), macros: itemMacros(item, selections) };
}

/* ------------------------------------------------------------------ cart */

export function cartMacros(lines: Pick<CartLine, "qty" | "unitMacros">[]): Macros {
  return sumMacros(lines.map((l) => scaleMacros(l.unitMacros, l.qty)));
}

export function cartSubtotal(lines: Pick<CartLine, "qty" | "unitPrice">[]): number {
  return lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
}

export function cartCount(lines: Pick<CartLine, "qty">[]): number {
  return lines.reduce((s, l) => s + l.qty, 0);
}

/** Share of energy from protein / carbs / fat (Atwater 4/4/9), summing to 100. */
export function macroSplit(m: Macros) {
  const p = m.protein * 4;
  const c = m.carbs * 4;
  const f = m.fat * 9;
  const total = p + c + f;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  const protein = Math.round((p / total) * 100);
  const carbs = Math.round((c / total) * 100);
  return { protein, carbs, fat: Math.max(0, 100 - protein - carbs) };
}

/* ------------------------------------------------------------------ labels */

/** Human summary of non-default choices, e.g. ["Large", "Oat milk", "+ Whey scoop", "No honey"]. */
export function selectionSummary(item: MenuItem, selections: Selections): string[] {
  const defaults = defaultSelections(item);
  const out: string[] = [];
  for (const g of itemGroups(item)) {
    const picked = selectedOptions(g, selections);
    if (g.type === "single") {
      const same = (defaults[g.id] ?? []).join() === (selections[g.id] ?? []).join();
      if (!same) out.push(...picked.map((o) => o.label));
    } else if (g.type === "multi") {
      out.push(...picked.map((o) => `+ ${o.label}`));
    } else {
      out.push(...picked.map((o) => o.label));
    }
  }
  return out;
}

/** Ingredient ids actually in the drink, after removals, swaps and add-ons. */
function finalIngredientIds(item: MenuItem, selections: Selections): string[] {
  const removed = new Set(selections[REMOVE_GROUP_ID] ?? []);
  const chosen = itemGroups(item).flatMap((g) => (g.type === "remove" ? [] : selectedOptions(g, selections)));
  const swaps = new Map<string, string>();
  for (const o of chosen) if (o.replaces && o.ingredientId) swaps.set(o.replaces, o.ingredientId);
  const ids = item.recipe
    .filter((r) => !removed.has(r.ingredientId))
    .map((r) => swaps.get(r.ingredientId) ?? r.ingredientId);
  for (const o of chosen) {
    if (!o.replaces && o.ingredientId && !ids.includes(o.ingredientId)) ids.push(o.ingredientId);
  }
  return ids;
}

export function ingredientNames(item: MenuItem, selections: Selections): string[] {
  return finalIngredientIds(item, selections)
    .filter((id) => id !== "water")
    .map((id) => getIngredient(id).name);
}

export function allergensFor(item: MenuItem, selections: Selections): Allergen[] {
  const set = new Set<Allergen>();
  for (const id of finalIngredientIds(item, selections)) {
    for (const a of getIngredient(id).allergens ?? []) set.add(a);
  }
  return [...set];
}
