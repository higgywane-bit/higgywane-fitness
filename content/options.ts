import type { OptionGroup } from "./types";

/*
 * Reusable option groups. Attach to menu items by id in content/menu.ts.
 * Every option carries a price delta and (via ingredient + grams, or macroDelta) a macro delta.
 * TODO: confirm with cafe (add-on prices, scoop sizes, which add-ons per category)
 */
const groups: OptionGroup[] = [
  {
    id: "size-smoothie",
    title: "Size",
    type: "single",
    required: true,
    options: [
      { id: "regular", label: "Regular", detail: "450 ml", priceDelta: 0, default: true },
      { id: "large", label: "Large", detail: "650 ml", priceDelta: 40, multiplier: 1.4 },
    ],
  },
  {
    id: "size-juice",
    title: "Size",
    type: "single",
    required: true,
    options: [
      { id: "regular", label: "Regular", detail: "350 ml", priceDelta: 0, default: true },
      { id: "large", label: "Large", detail: "500 ml", priceDelta: 30, multiplier: 1.4 },
    ],
  },
  {
    id: "smoothie-base",
    title: "Base",
    type: "single",
    required: true,
    scalesWithSize: true,
    options: [
      { id: "almond", label: "Almond milk", priceDelta: 0, ingredientId: "almond-milk", grams: 250, default: true },
      { id: "fresh", label: "Fresh milk", priceDelta: 0, ingredientId: "fresh-milk", grams: 250 },
      { id: "oat", label: "Oat milk", priceDelta: 15, ingredientId: "oat-milk", grams: 250 },
      { id: "water", label: "Water", detail: "Lowest calorie", priceDelta: 0, ingredientId: "water", grams: 250 },
    ],
  },
  {
    id: "smoothie-addons",
    title: "Boost it",
    type: "multi",
    max: 4,
    options: [
      { id: "whey", label: "Whey scoop", detail: "30 g", priceDelta: 40, ingredientId: "whey-vanilla", grams: 30 },
      { id: "plant", label: "Plant protein", detail: "30 g", priceDelta: 50, ingredientId: "plant-protein", grams: 30 },
      { id: "pb", label: "Peanut butter", detail: "15 g", priceDelta: 25, ingredientId: "peanut-butter", grams: 15 },
      { id: "oats", label: "Oats", detail: "30 g", priceDelta: 15, ingredientId: "oats", grams: 30 },
      { id: "creatine", label: "Creatine", detail: "5 g monohydrate", priceDelta: 30, ingredientId: "creatine", grams: 5 },
      { id: "collagen", label: "Collagen", detail: "10 g", priceDelta: 40, ingredientId: "collagen", grams: 10 },
      { id: "banana", label: "Banana", detail: "Half", priceDelta: 15, ingredientId: "banana", grams: 60 },
      { id: "honey", label: "Honey", detail: "10 g", priceDelta: 10, ingredientId: "honey", grams: 10 },
      { id: "shot", label: "Espresso shot", detail: "30 ml", priceDelta: 30, ingredientId: "espresso", grams: 30 },
    ],
  },
  {
    id: "juice-boost",
    title: "Boost it",
    type: "multi",
    max: 3,
    options: [
      { id: "ginger-shot", label: "Ginger shot", detail: "Extra fire", priceDelta: 20, ingredientId: "ginger", grams: 10 },
      { id: "chia", label: "Chia seeds", detail: "10 g", priceDelta: 15, ingredientId: "chia", grams: 10 },
      { id: "collagen", label: "Collagen", detail: "10 g", priceDelta: 40, ingredientId: "collagen", grams: 10 },
      { id: "turmeric", label: "Turmeric", detail: "2 g", priceDelta: 15, ingredientId: "turmeric", grams: 2 },
    ],
  },
  {
    id: "temperature",
    title: "Hot or iced",
    type: "single",
    required: true,
    options: [
      { id: "iced", label: "Iced", priceDelta: 10, default: true },
      { id: "hot", label: "Hot", priceDelta: 0 },
    ],
  },
  {
    id: "shots",
    title: "Shots",
    type: "single",
    required: true,
    options: [
      { id: "single", label: "Single", detail: "30 ml", priceDelta: 0, default: true },
      { id: "double", label: "Double", detail: "60 ml", priceDelta: 20, ingredientId: "espresso", grams: 30 },
    ],
  },
  {
    id: "coffee-milk",
    title: "Milk",
    type: "single",
    required: true,
    options: [
      { id: "fresh", label: "Fresh milk", priceDelta: 0, default: true },
      { id: "oat", label: "Oat milk", priceDelta: 20, replaces: "fresh-milk", ingredientId: "oat-milk" },
      { id: "almond", label: "Almond milk", priceDelta: 20, replaces: "fresh-milk", ingredientId: "almond-milk" },
      { id: "soy", label: "Soy milk", priceDelta: 20, replaces: "fresh-milk", ingredientId: "soy-milk" },
    ],
  },
  {
    id: "sweetness",
    title: "Sweetness",
    type: "single",
    required: true,
    scalesWithSize: true,
    options: [
      { id: "0", label: "No sugar", priceDelta: 0, default: true },
      { id: "50", label: "Half sweet", priceDelta: 0, ingredientId: "sugar-syrup", grams: 10 },
      { id: "100", label: "Regular sweet", priceDelta: 0, ingredientId: "sugar-syrup", grams: 20 },
    ],
  },
  {
    id: "coffee-extras",
    title: "Extras",
    type: "multi",
    max: 3,
    options: [
      { id: "shot", label: "Extra shot", detail: "30 ml", priceDelta: 30, ingredientId: "espresso", grams: 30 },
      { id: "whey", label: "Whey scoop", detail: "Protein coffee, 30 g", priceDelta: 40, ingredientId: "whey-vanilla", grams: 30 },
      { id: "collagen", label: "Collagen", detail: "10 g", priceDelta: 40, ingredientId: "collagen", grams: 10 },
      { id: "sf-vanilla", label: "Sugar-free vanilla", priceDelta: 15, ingredientId: "sf-vanilla", grams: 10 },
    ],
  },
];

export const optionGroups: Record<string, OptionGroup> = Object.fromEntries(groups.map((g) => [g.id, g]));

/** The per-item "remove" group, built from the item's removable recipe lines. */
export const REMOVE_GROUP_ID = "remove";
