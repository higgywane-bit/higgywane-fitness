import type { Ingredient } from "./types";

/*
 * Ingredient nutrition per 100 g / 100 ml, from standard food composition tables.
 * Juices are listed as fresh-pressed juice (most fibre stays in the pulp).
 * TODO: confirm with cafe (exact brands: whey, plant protein, milks, syrups)
 */
const list: Ingredient[] = [
  // fruit & veg
  { id: "banana", name: "Banana", per100: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, sugar: 12.2, fibre: 2.6 } },
  { id: "mixed-berries", name: "Mixed berries", per100: { kcal: 50, protein: 0.7, carbs: 12, fat: 0.3, sugar: 7, fibre: 3 } },
  { id: "spinach", name: "Spinach", per100: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, sugar: 0.4, fibre: 2.2 } },
  { id: "ginger", name: "Ginger", per100: { kcal: 80, protein: 1.8, carbs: 18, fat: 0.8, sugar: 1.7, fibre: 2 } },
  { id: "turmeric", name: "Turmeric", per100: { kcal: 312, protein: 9.7, carbs: 67, fat: 3.3, sugar: 3.2, fibre: 22.7 } },
  { id: "cayenne", name: "Cayenne", per100: { kcal: 318, protein: 12, carbs: 57, fat: 17, sugar: 10, fibre: 27 } },

  // fresh-pressed juices
  { id: "orange-juice", name: "Orange", per100: { kcal: 45, protein: 0.7, carbs: 10.4, fat: 0.2, sugar: 8.4, fibre: 0.2 } },
  { id: "pineapple-juice", name: "Pineapple", per100: { kcal: 50, protein: 0.4, carbs: 12.9, fat: 0.1, sugar: 10, fibre: 0.3 } },
  { id: "apple-juice", name: "Apple", per100: { kcal: 46, protein: 0.1, carbs: 11.3, fat: 0.1, sugar: 9.6, fibre: 0.2 } },
  { id: "carrot-juice", name: "Carrot", per100: { kcal: 40, protein: 0.9, carbs: 9.3, fat: 0.2, sugar: 3.9, fibre: 0.8 } },

  // proteins & performance
  { id: "whey-vanilla", name: "Vanilla whey", per100: { kcal: 400, protein: 78, carbs: 8, fat: 6, sugar: 5, fibre: 0 }, allergens: ["milk"] },
  { id: "whey-chocolate", name: "Chocolate whey", per100: { kcal: 390, protein: 75, carbs: 10, fat: 6, sugar: 5, fibre: 2 }, allergens: ["milk"] },
  { id: "plant-protein", name: "Plant protein", per100: { kcal: 380, protein: 75, carbs: 6, fat: 7, sugar: 1, fibre: 5 } },
  { id: "collagen", name: "Collagen", per100: { kcal: 360, protein: 90, carbs: 0, fat: 0, sugar: 0, fibre: 0 } },
  { id: "creatine", name: "Creatine", per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },

  // pantry
  { id: "peanut-butter", name: "Peanut butter", per100: { kcal: 588, protein: 25, carbs: 20, fat: 50, sugar: 9, fibre: 6 }, allergens: ["peanuts"] },
  { id: "oats", name: "Oats", per100: { kcal: 389, protein: 16.9, carbs: 66, fat: 6.9, sugar: 1, fibre: 10.6 }, allergens: ["gluten"] },
  { id: "honey", name: "Honey", per100: { kcal: 304, protein: 0.3, carbs: 82, fat: 0, sugar: 82, fibre: 0 } },
  { id: "cacao", name: "Raw cacao", per100: { kcal: 228, protein: 19.6, carbs: 58, fat: 13.7, sugar: 1.8, fibre: 37 } },
  { id: "chia", name: "Chia seeds", per100: { kcal: 486, protein: 16.5, carbs: 42, fat: 30.7, sugar: 0, fibre: 34.4 } },
  { id: "matcha", name: "Ceremonial matcha", per100: { kcal: 324, protein: 30, carbs: 39, fat: 5, sugar: 0, fibre: 38 } },
  { id: "sugar-syrup", name: "Cane syrup", per100: { kcal: 260, protein: 0, carbs: 65, fat: 0, sugar: 65, fibre: 0 } },
  { id: "sf-vanilla", name: "Sugar-free vanilla", per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },

  // bases
  { id: "espresso", name: "Espresso", per100: { kcal: 9, protein: 0.1, carbs: 1.7, fat: 0.2, sugar: 0, fibre: 0 } },
  { id: "water", name: "Water", per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
  { id: "fresh-milk", name: "Fresh milk", per100: { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sugar: 5, fibre: 0 }, allergens: ["milk"] },
  { id: "oat-milk", name: "Oat milk", per100: { kcal: 46, protein: 1, carbs: 6.5, fat: 1.5, sugar: 3.5, fibre: 0.8 }, allergens: ["gluten"] },
  { id: "almond-milk", name: "Almond milk", per100: { kcal: 15, protein: 0.5, carbs: 0.3, fat: 1.1, sugar: 0, fibre: 0.2 }, allergens: ["tree-nuts"] },
  { id: "soy-milk", name: "Soy milk", per100: { kcal: 33, protein: 2.9, carbs: 1.7, fat: 1.6, sugar: 1, fibre: 0.5 }, allergens: ["soy"] },
];

export const ingredients: Record<string, Ingredient> = Object.fromEntries(list.map((i) => [i.id, i]));

export function getIngredient(id: string): Ingredient {
  const ing = ingredients[id];
  if (!ing) throw new Error(`Unknown ingredient: ${id}`);
  return ing;
}
