import pricing from "./pricing.json";
import type { Category, CategoryId, MenuItem, RecipeLine, Tag } from "./types";

/*
 * Cafe menu. Names, descriptions and prices come from content/pricing.json (owner-supplied).
 * Recipes, tints and option groups below are placeholders.
 * TODO: confirm with cafe (real recipes, gram weights, which add-ons per drink)
 */

type PricedProduct = {
  name: string;
  description?: string;
  ingredients?: string[];
  price?: number;
  price_from?: number;
};

const cafe = pricing.sections.cafe.categories;

export const categories: Category[] = [
  { id: "smoothies", title: cafe.smoothies.title, blurb: "Blended to order with real protein." },
  { id: "juices", title: cafe.juices.title, blurb: "Cold pressed, nothing added." },
  { id: "coffee", title: cafe.coffee.title, blurb: "Double shot, your way." },
  {
    id: "performance",
    title: cafe.performance.title,
    blurb: "Pre-workout, recovery and supplements.",
    status: cafe.performance.status,
  },
];

type Recipe = {
  recipe: RecipeLine[];
  tint: string;
  vessel?: MenuItem["vessel"];
  tags?: Tag[];
  badges?: string[];
  optionGroups: string[];
  defaults?: Record<string, string[]>;
};

const SMOOTHIE_GROUPS = ["size-smoothie", "smoothie-base", "smoothie-addons"];
const JUICE_GROUPS = ["size-juice", "juice-boost"];
const MILK_COFFEE_GROUPS = ["temperature", "coffee-milk", "sweetness", "coffee-extras"];

// TODO: confirm with cafe (every recipe below is a realistic placeholder)
const recipes: Record<string, Recipe> = {
  // Smoothies
  "Berry Hype": {
    recipe: [
      { ingredientId: "mixed-berries", grams: 150 },
      { ingredientId: "banana", grams: 60, removable: true },
      { ingredientId: "whey-vanilla", grams: 30 },
      { ingredientId: "honey", grams: 10, removable: true },
    ],
    tint: "#7b1f4b",
    tags: ["high-protein"],
    optionGroups: SMOOTHIE_GROUPS,
  },
  "Espresso Max": {
    recipe: [
      { ingredientId: "espresso", grams: 60 },
      { ingredientId: "whey-vanilla", grams: 30 },
      { ingredientId: "banana", grams: 80, removable: true },
      { ingredientId: "cacao", grams: 5, removable: true },
    ],
    tint: "#6b4630",
    tags: ["high-protein", "caffeine"],
    optionGroups: SMOOTHIE_GROUPS,
    defaults: { "smoothie-base": ["oat"] },
  },
  "Skinny & Rich": {
    recipe: [
      { ingredientId: "whey-chocolate", grams: 30 },
      { ingredientId: "cacao", grams: 10 },
    ],
    tint: "#4a2c22",
    tags: ["high-protein", "low-cal"],
    badges: ["Under 200 kcal"],
    optionGroups: SMOOTHIE_GROUPS,
  },
  "Banana Bam Bam": {
    recipe: [
      { ingredientId: "banana", grams: 120 },
      { ingredientId: "oats", grams: 30, removable: true },
      { ingredientId: "whey-vanilla", grams: 30 },
      { ingredientId: "honey", grams: 10, removable: true },
    ],
    tint: "#d8b25a",
    tags: ["high-protein"],
    optionGroups: SMOOTHIE_GROUPS,
    defaults: { "smoothie-base": ["fresh"] },
  },
  "Strong Vibes": {
    recipe: [
      { ingredientId: "peanut-butter", grams: 20 },
      { ingredientId: "banana", grams: 80, removable: true },
      { ingredientId: "whey-vanilla", grams: 30 },
      { ingredientId: "honey", grams: 10, removable: true },
    ],
    tint: "#a8723d",
    tags: ["high-protein"],
    optionGroups: SMOOTHIE_GROUPS,
    defaults: { "smoothie-base": ["fresh"] },
  },
  Thick: {
    recipe: [
      { ingredientId: "oats", grams: 60 },
      { ingredientId: "banana", grams: 120, removable: true },
      { ingredientId: "peanut-butter", grams: 30, removable: true },
      { ingredientId: "whey-vanilla", grams: 60 },
      { ingredientId: "honey", grams: 15, removable: true },
    ],
    tint: "#c9a77c",
    tags: ["high-protein"],
    badges: ["Mass gainer"],
    optionGroups: SMOOTHIE_GROUPS,
    defaults: { "smoothie-base": ["fresh"] },
  },

  // Juices
  "Bangkok Beat": {
    recipe: [
      { ingredientId: "orange-juice", grams: 150 },
      { ingredientId: "pineapple-juice", grams: 120 },
      { ingredientId: "banana", grams: 60, removable: true },
      { ingredientId: "ginger", grams: 5, removable: true },
    ],
    tint: "#f2a227",
    tags: ["vegan"],
    optionGroups: JUICE_GROUPS,
  },
  "Blow My Head Off": {
    recipe: [
      { ingredientId: "orange-juice", grams: 170 },
      { ingredientId: "carrot-juice", grams: 150 },
      { ingredientId: "ginger", grams: 10, removable: true },
      { ingredientId: "turmeric", grams: 3, removable: true },
      { ingredientId: "cayenne", grams: 0.5, removable: true },
    ],
    tint: "#e4572e",
    tags: ["vegan", "low-cal"],
    badges: ["Spicy"],
    optionGroups: JUICE_GROUPS,
  },
  A5: {
    recipe: [
      { ingredientId: "apple-juice", grams: 200 },
      { ingredientId: "pineapple-juice", grams: 120 },
      { ingredientId: "spinach", grams: 40, removable: true },
    ],
    tint: "#8dbf3f",
    tags: ["vegan", "low-cal"],
    optionGroups: JUICE_GROUPS,
  },
  "OJ Classic": {
    recipe: [{ ingredientId: "orange-juice", grams: 350 }],
    tint: "#f7941d",
    tags: ["vegan"],
    optionGroups: JUICE_GROUPS,
  },

  // Coffee
  Espresso: {
    recipe: [{ ingredientId: "espresso", grams: 30 }],
    tint: "#3b2417",
    vessel: "small",
    tags: ["caffeine", "low-cal", "vegan"],
    optionGroups: ["shots"],
  },
  Americano: {
    recipe: [
      { ingredientId: "espresso", grams: 60 },
      { ingredientId: "water", grams: 200 },
    ],
    tint: "#2e1c12",
    vessel: "cup",
    tags: ["caffeine", "low-cal", "vegan"],
    optionGroups: ["temperature", "sweetness", "coffee-extras"],
  },
  Latte: {
    recipe: [
      { ingredientId: "espresso", grams: 60 },
      { ingredientId: "fresh-milk", grams: 220 },
    ],
    tint: "#b88b62",
    vessel: "cup",
    tags: ["caffeine"],
    optionGroups: MILK_COFFEE_GROUPS,
  },
  Cappuccino: {
    recipe: [
      { ingredientId: "espresso", grams: 60 },
      { ingredientId: "fresh-milk", grams: 150 },
    ],
    tint: "#a37650",
    vessel: "cup",
    tags: ["caffeine"],
    optionGroups: MILK_COFFEE_GROUPS,
    defaults: { temperature: ["hot"] },
  },
  "Matcha Latte": {
    recipe: [
      { ingredientId: "matcha", grams: 4 },
      { ingredientId: "fresh-milk", grams: 220 },
    ],
    tint: "#7fa34a",
    vessel: "cup",
    tags: ["caffeine"],
    optionGroups: MILK_COFFEE_GROUPS,
  },
  Mocha: {
    recipe: [
      { ingredientId: "espresso", grams: 60 },
      { ingredientId: "cacao", grams: 10 },
      { ingredientId: "fresh-milk", grams: 200 },
    ],
    tint: "#5a3a28",
    vessel: "cup",
    tags: ["caffeine"],
    optionGroups: MILK_COFFEE_GROUPS,
    defaults: { sweetness: ["50"] },
  },
};

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function describe(p: PricedProduct) {
  if (p.description) return p.description;
  if (p.ingredients) return p.ingredients.join(", ");
  return undefined;
}

function build(category: CategoryId, products: PricedProduct[]): MenuItem[] {
  return products.map((p) => {
    const r = recipes[p.name];
    if (!r) throw new Error(`No recipe for menu item "${p.name}"`);
    const slug = slugify(p.name);
    return {
      id: slug,
      slug,
      category,
      name: p.name,
      description: describe(p),
      basePrice: p.price ?? p.price_from ?? 0,
      priceIsFrom: p.price_from !== undefined,
      recipe: r.recipe,
      tint: r.tint,
      vessel: r.vessel ?? "glass",
      tags: r.tags,
      badges: r.badges,
      optionGroups: r.optionGroups,
      defaults: r.defaults,
      available: true,
    };
  });
}

export const menu: MenuItem[] = [
  ...build("smoothies", cafe.smoothies.products),
  ...build("juices", cafe.juices.products),
  ...build("coffee", cafe.coffee.products),
  ...build("performance", cafe.performance.products as PricedProduct[]),
];

export const menuById: Record<string, MenuItem> = Object.fromEntries(menu.map((m) => [m.id, m]));

export function getMenuItem(slug: string): MenuItem | undefined {
  return menuById[slug];
}

export function itemsInCategory(id: CategoryId) {
  return menu.filter((m) => m.category === id);
}
