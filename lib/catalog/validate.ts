import type { Business } from "@/content/business";
import { specialties } from "@/content/coaches";
import type { Plan, PlanDuration } from "@/content/plans";
import type { Allergen, Category, Coach, Ingredient, Macros, MenuItem, Option, OptionGroup, RecipeLine, SpecialtyId, Tag } from "@/content/types";
import { ServiceError } from "@/lib/errors";
import type { Catalog, CatalogSection } from "./index";

/*
 * Everything saved from Admin → Site & content passes through here: types are
 * coerced, lengths capped, and nothing can be deleted while something still uses it.
 */

export const TAGS: Tag[] = ["high-protein", "low-cal", "vegan", "caffeine", "recovery", "energy", "pre-workout", "post-workout", "best-seller", "high-caffeine", "limited-edition"];
export const ALLERGENS: Allergen[] = ["milk", "peanuts", "tree-nuts", "soy", "gluten"];
export const VESSELS = ["glass", "cup", "small"] as const;

type Obj = Record<string, unknown>;

const fail = (msg: string): never => {
  throw new ServiceError(msg);
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function obj(v: unknown, what: string): Obj {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : fail(`${what} is malformed.`);
}

function list(v: unknown, what: string, max = 500): unknown[] {
  if (!Array.isArray(v)) fail(`${what} must be a list.`);
  const arr = v as unknown[];
  if (arr.length > max) fail(`Too many ${what} (max ${max}).`);
  return arr;
}

function str(v: unknown, what: string, max: number, required = false): string {
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  if (required && !s) fail(`${what} is required.`);
  if (s.length > max) fail(`${what} is too long (max ${max} characters).`);
  return s;
}

function optStr(v: unknown, what: string, max: number): string | undefined {
  return str(v, what, max) || undefined;
}

function num(v: unknown, what: string, min: number, max: number, fallback?: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback !== undefined ? fallback : fail(`${what} must be a number.`);
  if (n < min || n > max) fail(`${what} must be between ${min} and ${max}.`);
  return n;
}

const int = (v: unknown, what: string, min: number, max: number, fallback?: number) => Math.round(num(v, what, min, max, fallback));
const bool = (v: unknown) => v === true || v === "true";

function image(v: unknown, what: string): string | undefined {
  const s = str(v, what, 500);
  if (!s) return undefined;
  if (!s.startsWith("/media/") && !s.startsWith("/images/")) fail(`${what} must be an uploaded photo.`);
  return s;
}

function uniqueIds<T extends { id: string }>(rows: T[], what: string): T[] {
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.id) fail(`Every ${what} needs a name.`);
    if (seen.has(r.id)) fail(`Two ${what}s are called "${r.id}". Names must be different.`);
    seen.add(r.id);
  }
  return rows;
}

/* ── sections ─────────────────────────────────────────────── */

function categories(v: unknown, c: Catalog): Category[] {
  const out = uniqueIds(
    list(v, "categories", 30).map((raw) => {
      const o = obj(raw, "Category");
      const title = str(o.title, "Category name", 40, true);
      return { id: str(o.id, "id", 60) || slugify(title), title, blurb: str(o.blurb, "Category blurb", 160), status: optStr(o.status, "Status", 60) };
    }),
    "category",
  );
  const ids = new Set(out.map((x) => x.id));
  const orphan = c.menu.find((m) => !ids.has(m.category));
  if (orphan) fail(`"${orphan.name}" is still in that category. Move it first.`);
  return out;
}

function recipeLine(raw: unknown, ing: Set<string>): RecipeLine {
  const o = obj(raw, "Recipe line");
  const ingredientId = str(o.ingredientId, "Ingredient", 60, true);
  if (!ing.has(ingredientId)) fail(`Unknown ingredient "${ingredientId}".`);
  return { ingredientId, grams: num(o.grams, "Grams", 0.1, 2000), ...(bool(o.removable) ? { removable: true } : {}) };
}

function menu(v: unknown, c: Catalog): MenuItem[] {
  const cats = new Set(c.categories.map((x) => x.id));
  const groups = new Map(c.optionGroups.map((g) => [g.id, g]));
  const ing = new Set(c.ingredients.map((i) => i.id));
  return uniqueIds(
    list(v, "menu items").map((raw) => {
      const o = obj(raw, "Menu item");
      const name = str(o.name, "Item name", 60, true);
      const id = str(o.id, "id", 60) || slugify(name);
      const category = str(o.category, "Category", 60, true);
      if (!cats.has(category)) fail(`"${name}": pick a category.`);
      const optionGroups = list(o.optionGroups ?? [], "add-on groups", 12).map((g) => str(g, "Add-on group", 60));
      for (const g of optionGroups) if (!groups.has(g)) fail(`"${name}": add-on group "${g}" doesn't exist.`);
      const defaults: Record<string, string[]> = {};
      for (const [gid, sel] of Object.entries(obj(o.defaults ?? {}, "Defaults"))) {
        const g = groups.get(gid);
        if (!g || !optionGroups.includes(gid) || !Array.isArray(sel)) continue;
        const valid = sel.filter((s): s is string => typeof s === "string" && g.options.some((op) => op.id === s));
        if (valid.length) defaults[gid] = valid;
      }
      const tint = str(o.tint, "Colour", 9) || "#1c1c1c";
      if (!/^#[0-9a-f]{6}$/i.test(tint)) fail(`"${name}": colour must look like #e11d48.`);
      const vessel = VESSELS.includes(o.vessel as (typeof VESSELS)[number]) ? (o.vessel as MenuItem["vessel"]) : "glass";
      return {
        id,
        slug: id,
        category,
        name,
        description: optStr(o.description, "Description", 220),
        recipe: list(o.recipe ?? [], "recipe lines", 20).map((r) => recipeLine(r, ing)),
        basePrice: int(o.basePrice, `"${name}" price`, 0, 100_000),
        priceIsFrom: bool(o.priceIsFrom) || undefined,
        image: image(o.image, "Photo"),
        tint,
        vessel,
        badges: list(o.badges ?? [], "badges", 3).map((b) => str(b, "Badge", 24)).filter(Boolean),
        tags: list(o.tags ?? [], "tags", 6).filter((t): t is Tag => TAGS.includes(t as Tag)),
        optionGroups,
        defaults: Object.keys(defaults).length ? defaults : undefined,
        available: o.available !== false && o.available !== "false",
      } satisfies MenuItem;
    }),
    "menu item",
  );
}

function macros(v: unknown, what: string): Macros {
  const o = obj(v, what);
  return {
    kcal: num(o.kcal, `${what} kcal`, 0, 900, 0),
    protein: num(o.protein, `${what} protein`, 0, 100, 0),
    carbs: num(o.carbs, `${what} carbs`, 0, 100, 0),
    fat: num(o.fat, `${what} fat`, 0, 100, 0),
    sugar: num(o.sugar, `${what} sugar`, 0, 100, 0),
    fibre: num(o.fibre, `${what} fibre`, 0, 100, 0),
  };
}

function ingredients(v: unknown, c: Catalog): Ingredient[] {
  const out = uniqueIds(
    list(v, "ingredients").map((raw) => {
      const o = obj(raw, "Ingredient");
      const name = str(o.name, "Ingredient name", 60, true);
      const allergens = list(o.allergens ?? [], "allergens", 5).filter((a): a is Allergen => ALLERGENS.includes(a as Allergen));
      return { id: str(o.id, "id", 60) || slugify(name), name, per100: macros(o.per100 ?? {}, name), ...(allergens.length ? { allergens } : {}) };
    }),
    "ingredient",
  );
  const ids = new Set(out.map((i) => i.id));
  for (const m of c.menu) for (const r of m.recipe) if (!ids.has(r.ingredientId)) fail(`"${m.name}" uses that ingredient. Take it out of the recipe first.`);
  for (const g of c.optionGroups)
    for (const o of g.options)
      for (const ref of [o.ingredientId, o.replaces]) if (ref && !ids.has(ref)) fail(`Add-on "${o.label}" in "${g.title}" uses that ingredient. Change it first.`);
  return out;
}

function option(raw: unknown, ing: Set<string>, group: string): Option {
  const o = obj(raw, "Option");
  const label = str(o.label, "Option name", 40, true);
  const ingredientId = optStr(o.ingredientId, "Ingredient", 60);
  const replaces = optStr(o.replaces, "Replaces", 60);
  for (const ref of [ingredientId, replaces]) if (ref && !ing.has(ref)) fail(`${group} → ${label}: unknown ingredient "${ref}".`);
  const grams = o.grams === undefined || o.grams === "" || o.grams === null ? undefined : num(o.grams, `${label} grams`, 0, 2000);
  const multiplier = o.multiplier === undefined || o.multiplier === "" || o.multiplier === null ? undefined : num(o.multiplier, `${label} size multiplier`, 0.1, 5);
  return {
    id: str(o.id, "id", 40) || slugify(label),
    label,
    detail: optStr(o.detail, "Option detail", 40),
    priceDelta: int(o.priceDelta, `${label} price`, -10_000, 10_000, 0),
    ...(ingredientId ? { ingredientId } : {}),
    ...(grams !== undefined && !replaces ? { grams } : {}),
    ...(replaces ? { replaces } : {}),
    ...(multiplier !== undefined ? { multiplier } : {}),
    ...(o.macroDelta ? { macroDelta: macros(o.macroDelta, label) } : {}),
    ...(bool(o.default) ? { default: true } : {}),
  };
}

function optionGroups(v: unknown, c: Catalog): OptionGroup[] {
  const ing = new Set(c.ingredients.map((i) => i.id));
  const out = uniqueIds(
    list(v, "add-on groups", 60).map((raw) => {
      const o = obj(raw, "Add-on group");
      const title = str(o.title, "Group name", 40, true);
      const type = o.type === "single" || o.type === "multi" ? o.type : fail(`"${title}": pick one or many.`);
      const options = uniqueIds(
        list(o.options ?? [], "options", 30).map((x) => option(x, ing, title)),
        "option",
      );
      if (!options.length) fail(`"${title}" needs at least one option.`);
      if (type === "single" && options.filter((x) => x.default).length > 1) fail(`"${title}": only one option can be the default.`);
      const max = o.max === undefined || o.max === "" || o.max === null ? undefined : int(o.max, `${title} max`, 1, 30);
      return {
        id: str(o.id, "id", 60) || slugify(title),
        title,
        type,
        ...(bool(o.required) ? { required: true } : {}),
        ...(max && type === "multi" ? { max } : {}),
        ...(bool(o.scalesWithSize) ? { scalesWithSize: true } : {}),
        options,
      } satisfies OptionGroup;
    }),
    "add-on group",
  );
  const ids = new Set(out.map((g) => g.id));
  for (const m of c.menu) for (const g of m.optionGroups ?? []) if (!ids.has(g)) fail(`"${m.name}" uses that add-on group. Remove it from the item first.`);
  return out;
}

const SPECIALTIES = Object.keys(specialties) as SpecialtyId[];

function coaches(v: unknown, c: Catalog): Coach[] {
  const rows = list(v, "coaches", 40).map((raw) => {
    const o = obj(raw, "Coach");
    const name = str(o.name, "Coach name", 40, true);
    const slots = list(o.slots ?? [], "session times", 24).map((s) => str(s, "Time", 5));
    for (const s of slots) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail(`${name}: times look like 07:00.`);
    const contact = obj(o.contact ?? {}, "Contact");
    const line = optStr(contact.line, "LINE", 60);
    const instagram = optStr(contact.instagram, "Instagram", 60)?.replace(/^@/, "");
    return {
      id: str(o.slug, "slug", 40) || slugify(name),
      coach: {
        slug: str(o.slug, "slug", 40) || slugify(name),
        name,
        title: str(o.title, `${name} title`, 60, true),
        tagline: str(o.tagline, `${name} tagline`, 80),
        specialties: list(o.specialties ?? [], "specialties", 6).filter((s): s is SpecialtyId => SPECIALTIES.includes(s as SpecialtyId)),
        about: list(o.about ?? [], "about paragraphs", 6).map((p) => str(p, "Paragraph", 600)).filter(Boolean),
        approach: list(o.approach ?? [], "approach steps", 6).map((x) => {
          const a = obj(x, "Step");
          return { title: str(a.title, "Step title", 40, true), body: str(a.body, "Step text", 240) };
        }),
        weekdays: [...new Set(list(o.weekdays ?? [], "weekdays", 7).map((d) => int(d, "Weekday", 1, 7)))].sort(),
        slots: [...new Set(slots)].sort(),
        ...(line || instagram ? { contact: { ...(line ? { line } : {}), ...(instagram ? { instagram } : {}) } } : {}),
        ...(image(o.photo, "Photo") ? { photo: image(o.photo, "Photo") } : {}),
        ...(bool(o.hidden) ? { hidden: true } : {}),
      } satisfies Coach,
    };
  });
  const out = uniqueIds(rows, "coach").map((r) => r.coach);
  const slugs = new Set(out.map((x) => x.slug));
  const gone = c.coaches.find((x) => !slugs.has(x.slug));
  if (gone) fail(`${gone.name} has bookings and history, so can't be deleted. Hide them instead.`);
  return out;
}

function duration(v: unknown, name: string): PlanDuration {
  const o = obj(v, "Length");
  if (o.months !== undefined && o.months !== "") return { months: int(o.months, `${name} months`, 1, 36) };
  return { days: int(o.days, `${name} days`, 1, 1000) };
}

function plans(v: unknown, c: Catalog): Plan[] {
  const out = uniqueIds(
    list(v, "plans", 60).map((raw) => {
      const o = obj(raw, "Plan");
      const name = str(o.name, "Plan name", 40, true);
      const kind = o.kind === "pt" ? "pt" : "membership";
      return {
        id: str(o.id, "id", 60) || (kind === "pt" ? `pt-${slugify(name)}` : slugify(name)),
        name,
        kind,
        price: int(o.price, `${name} price`, 0, 1_000_000),
        duration: duration(o.duration ?? {}, name),
        ...(kind === "pt" ? { sessions: int(o.sessions, `${name} sessions`, 1, 500) } : {}),
        ...(optStr(o.badge, "Badge", 24) ? { badge: optStr(o.badge, "Badge", 24) } : {}),
        ...(optStr(o.description, "Description", 80) ? { description: optStr(o.description, "Description", 80) } : {}),
        ...(bool(o.hidden) ? { hidden: true } : {}),
      } satisfies Plan;
    }),
    "plan",
  );
  const ids = new Set(out.map((p) => p.id));
  const gone = c.plans.find((p) => !ids.has(p.id));
  if (gone) fail(`"${gone.name}" has been sold before, so it can't be deleted. Hide it instead.`);
  return out;
}

function business(v: unknown): Business {
  const o = obj(v, "Business");
  const promptPayId = str(o.promptPayId, "PromptPay", 20).replace(/[\s-]/g, "");
  if (promptPayId && !/^(\d{10}|\d{13})$/.test(promptPayId)) fail("PromptPay must be a 10-digit phone number or a 13-digit tax ID.");
  return {
    name: str(o.name, "Name", 60, true),
    promptPayId,
    phone: str(o.phone, "Phone", 30),
    email: str(o.email, "Email", 80),
    line: str(o.line, "LINE", 60),
    instagram: str(o.instagram, "Instagram", 60).replace(/^@/, ""),
    address: str(o.address, "Address", 200),
    hours: str(o.hours, "Opening hours", 120),
    tagline: str(o.tagline, "Tagline", 140),
  };
}

export function validateSection<S extends CatalogSection>(section: S, value: unknown, current: Catalog): Catalog[S] {
  const run: { [K in CatalogSection]: (v: unknown, c: Catalog) => Catalog[K] } = {
    categories,
    menu,
    ingredients,
    optionGroups,
    coaches,
    plans,
    business: (v) => business(v),
  };
  return run[section](value, current) as Catalog[S];
}
