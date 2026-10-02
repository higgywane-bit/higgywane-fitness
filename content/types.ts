export type Macros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fibre?: number;
};

export type Allergen = "milk" | "peanuts" | "tree-nuts" | "soy" | "gluten";

export type Ingredient = {
  id: string;
  name: string;
  /** macros per 100 g (or 100 ml for liquids) */
  per100: Macros;
  allergens?: Allergen[];
};

export type Option = {
  id: string;
  label: string;
  /** short helper line under the label, e.g. "30 g scoop" */
  detail?: string;
  /** THB */
  priceDelta: number;
  /** explicit macro delta (may be negative) */
  macroDelta?: Macros;
  /** or derive the delta from an ingredient amount */
  ingredientId?: string;
  grams?: number;
  /** swap a recipe ingredient for `ingredientId` at the same amount (e.g. fresh milk → oat milk) */
  replaces?: string;
  /** scales the base recipe, e.g. Large = 1.4 */
  multiplier?: number;
  default?: boolean;
};

export type OptionGroup = {
  id: string;
  title: string;
  type: "single" | "multi" | "remove";
  required?: boolean;
  max?: number;
  /** when true, this group's macros scale with the size multiplier (milk base, sweetness) */
  scalesWithSize?: boolean;
  options: Option[];
};

export type CategoryId = "smoothies" | "coffee" | "food" | "merchandise";

export type Tag = "high-protein" | "low-cal" | "vegan" | "caffeine" | "recovery" | "energy" | "pre-workout" | "post-workout" | "best-seller" | "high-caffeine" | "limited-edition";

export type RecipeLine = {
  ingredientId: string;
  grams: number;
  /** customers can take this out (powers the "remove" option group) */
  removable?: boolean;
};

export type MenuItem = {
  id: string;
  slug: string;
  category: CategoryId;
  name: string;
  description?: string;
  recipe: RecipeLine[];
  basePrice: number;
  priceIsFrom?: boolean;
  image?: string;
  /** visual fallback until photography exists: the drink's colour */
  tint: string;
  /** "glass" for juices/smoothies, "cup" for hot coffee, "small" for espresso */
  vessel?: "glass" | "cup" | "small";
  badges?: string[];
  tags?: Tag[];
  optionGroups?: string[];
  /** per-item default selections, overriding option.default */
  defaults?: Record<string, string[]>;
  available?: boolean;
};

export type Category = {
  id: CategoryId;
  title: string;
  blurb: string;
  status?: string;
};

/** groupId → selected option ids */
export type Selections = Record<string, string[]>;

export type CartLine = {
  id: string;
  itemId: string;
  qty: number;
  selections: Selections;
  note?: string;
  /** snapshots at add time */
  unitPrice: number;
  unitMacros: Macros;
};

/* ------------------------------------------------------------------ coaches */

export type SpecialtyId =
  | "bodybuilding-prep"
  | "womens-recomp"
  | "glutes"
  | "posing"
  | "fat-loss"
  | "nutrition"
  | "strength"
  | "get-jacked"
  | "mobility"
  | "beginners";

export type Specialty = { id: SpecialtyId; label: string; blurb: string };

export type Coach = {
  slug: string;
  name: string;
  title: string;
  tagline: string;
  specialties: SpecialtyId[];
  about: string[];
  approach: { title: string; body: string }[];
  /** ISO weekdays the coach takes sessions, 1 = Monday … 7 = Sunday */
  weekdays: number[];
  /** session start times, "HH:MM" in Bangkok time */
  slots: string[];
  contact?: { line?: string; instagram?: string };
};
