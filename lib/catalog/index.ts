import { DEFAULT_BUSINESS, type Business } from "@/content/business";
import { coaches as DEFAULT_COACHES, specialties } from "@/content/coaches";
import { ingredients as DEFAULT_INGREDIENTS } from "@/content/ingredients";
import { categories as DEFAULT_CATEGORIES, menu as DEFAULT_MENU } from "@/content/menu";
import { optionGroups as DEFAULT_OPTION_GROUPS } from "@/content/options";
import { PLANS as DEFAULT_PLANS, type Plan, type PlanKind } from "@/content/plans";
import type { Category, CategoryId, Coach, Ingredient, MenuItem, OptionGroup } from "@/content/types";

/*
 * Everything the owner can edit in Admin → Site & content: menu, add-ons,
 * ingredients, coaches, plans and business details. The files in content/ are
 * the defaults; edits are stored in the database (lib/catalog/server.ts) and win.
 *
 * Server code loads the live catalog once per request (getCatalog); client code
 * receives it through <CatalogProvider>. Both then read it with the accessors below,
 * so pricing, macros and plans come from one place everywhere.
 */

export type Catalog = {
  categories: Category[];
  menu: MenuItem[];
  optionGroups: OptionGroup[];
  ingredients: Ingredient[];
  coaches: Coach[];
  plans: Plan[];
  business: Business;
};

export type CatalogSection = keyof Catalog;
export const CATALOG_SECTIONS: CatalogSection[] = ["categories", "menu", "optionGroups", "ingredients", "coaches", "plans", "business"];

export const DEFAULT_CATALOG: Catalog = {
  categories: DEFAULT_CATEGORIES,
  menu: DEFAULT_MENU,
  optionGroups: Object.values(DEFAULT_OPTION_GROUPS),
  ingredients: Object.values(DEFAULT_INGREDIENTS),
  coaches: DEFAULT_COACHES,
  plans: DEFAULT_PLANS,
  business: DEFAULT_BUSINESS,
};

type Indexed = Catalog & {
  menuBySlug: Map<string, MenuItem>;
  groupsById: Map<string, OptionGroup>;
  ingredientsById: Map<string, Ingredient>;
  plansById: Map<string, Plan>;
};

function index(c: Catalog): Indexed {
  return {
    ...c,
    menuBySlug: new Map(c.menu.map((m) => [m.slug, m])),
    groupsById: new Map(c.optionGroups.map((g) => [g.id, g])),
    ingredientsById: new Map(c.ingredients.map((i) => [i.id, i])),
    plansById: new Map(c.plans.map((p) => [p.id, p])),
  };
}

let source: Catalog = DEFAULT_CATALOG;
let current: Indexed = index(DEFAULT_CATALOG);

/** Make `c` the catalog every accessor reads. Idempotent for the same object. */
export function setCatalog(c: Catalog) {
  if (c === source) return;
  source = c;
  current = index(c);
}

export function catalog(): Catalog {
  return current;
}

/* ── menu ─────────────────────────────────────────────────── */

export function menuItems(opts: { includeHidden?: boolean } = {}): MenuItem[] {
  return opts.includeHidden ? current.menu : current.menu.filter((m) => m.available !== false);
}

export function menuCategories(): Category[] {
  return current.categories;
}

export function itemsInCategory(id: CategoryId): MenuItem[] {
  return menuItems().filter((m) => m.category === id);
}

/** By slug (menu ids and slugs are the same). Sold-out items still resolve: carts and orders keep working. */
export function getMenuItem(slug: string): MenuItem | undefined {
  return current.menuBySlug.get(slug);
}

export function getOptionGroup(id: string): OptionGroup | undefined {
  return current.groupsById.get(id);
}

export function getIngredient(id: string): Ingredient {
  const ing = current.ingredientsById.get(id);
  if (!ing) throw new Error(`Unknown ingredient: ${id}`);
  return ing;
}

export function findIngredient(id: string): Ingredient | undefined {
  return current.ingredientsById.get(id);
}

/* ── coaches ──────────────────────────────────────────────── */

export { specialties };

export function coachList(opts: { includeHidden?: boolean } = {}): Coach[] {
  return opts.includeHidden ? current.coaches : current.coaches.filter((c) => !c.hidden);
}

export function getCoach(slug: string): Coach | undefined {
  return current.coaches.find((c) => c.slug === slug);
}

/* ── plans ────────────────────────────────────────────────── */

export function planList(kind?: PlanKind, opts: { includeHidden?: boolean } = {}): Plan[] {
  return current.plans.filter((p) => (!kind || p.kind === kind) && (opts.includeHidden || !p.hidden));
}

/** Hidden plans still resolve, so old memberships and imports keep their names. */
export function getPlan(id: string): Plan | undefined {
  return current.plansById.get(id);
}

/* ── business ─────────────────────────────────────────────── */

export function business(): Business {
  return current.business;
}
