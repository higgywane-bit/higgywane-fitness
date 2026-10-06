import { clampInt } from "./library";
import { newId } from "./program";

/*
 * A client's nutrition: daily macro targets (calories are always worked out from them,
 * never typed) plus an optional daily plan of meals the coach writes out.
 */

export type Food = { id: string; name: string; amount: string };
export type Meal = { id: string; name: string; foods: Food[] };

export type DietPlan = {
  v: 1;
  protein: number;
  carbs: number;
  fat: number;
  /** show the meal plan under the macros in the client's app */
  showDailyPlan: boolean;
  meals: Meal[];
  note?: string;
};

export const MACRO_KCAL = { protein: 4, carbs: 4, fat: 9 } as const;
export type Macro = keyof typeof MACRO_KCAL;
export const MACROS: { id: Macro; label: string }[] = [
  { id: "protein", label: "Protein" },
  { id: "carbs", label: "Carbs" },
  { id: "fat", label: "Fat" },
];

const LIMITS = { grams: 1000, meals: 8, foods: 15, name: 40, amount: 24, note: 400 } as const;
export const MACRO_STEP = 5;

export const DEFAULT_MEALS = ["Breakfast", "Lunch", "Snack", "Dinner"];

export function emptyDiet(): DietPlan {
  return { v: 1, protein: 150, carbs: 200, fat: 60, showDailyPlan: false, meals: [] };
}

/** 4 kcal per gram of protein and carbs, 9 per gram of fat. */
export function kcalOf(m: Pick<DietPlan, Macro>): number {
  return m.protein * MACRO_KCAL.protein + m.carbs * MACRO_KCAL.carbs + m.fat * MACRO_KCAL.fat;
}

/** Share of calories from each macro, rounded so they add to 100. */
export function macroSplit(m: Pick<DietPlan, Macro>): Record<Macro, number> {
  const total = kcalOf(m);
  if (!total) return { protein: 0, carbs: 0, fat: 0 };
  const protein = Math.round(((m.protein * 4) / total) * 100);
  const fat = Math.round(((m.fat * 9) / total) * 100);
  return { protein, carbs: Math.max(0, 100 - protein - fat), fat };
}

export function setMacro(plan: DietPlan, macro: Macro, grams: number): DietPlan {
  return { ...plan, [macro]: clampInt(grams, 0, LIMITS.grams) };
}

export function stepMacro(plan: DietPlan, macro: Macro, dir: -1 | 1): DietPlan {
  return setMacro(plan, macro, plan[macro] + dir * MACRO_STEP);
}

export function addMeal(plan: DietPlan, name?: string, id = newId()): DietPlan {
  if (plan.meals.length >= LIMITS.meals) return plan;
  const label = clean(name, LIMITS.name) || DEFAULT_MEALS.find((m) => !plan.meals.some((x) => x.name === m)) || `Meal ${plan.meals.length + 1}`;
  return { ...plan, meals: [...plan.meals, { id, name: label, foods: [] }] };
}

export function renameMeal(plan: DietPlan, mealId: string, name: string): DietPlan {
  const label = clean(name, LIMITS.name);
  return label ? mapMeal(plan, mealId, (m) => ({ ...m, name: label })) : plan;
}

export function removeMeal(plan: DietPlan, mealId: string): DietPlan {
  return { ...plan, meals: plan.meals.filter((m) => m.id !== mealId) };
}

export function moveMeal(plan: DietPlan, mealId: string, dir: -1 | 1): DietPlan {
  const i = plan.meals.findIndex((m) => m.id === mealId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= plan.meals.length) return plan;
  const meals = [...plan.meals];
  [meals[i], meals[j]] = [meals[j], meals[i]];
  return { ...plan, meals };
}

export function addFood(plan: DietPlan, mealId: string, food: { name: string; amount: string }, id = newId()): DietPlan {
  const name = clean(food.name, LIMITS.name);
  if (!name) return plan;
  return mapMeal(plan, mealId, (m) =>
    m.foods.length >= LIMITS.foods ? m : { ...m, foods: [...m.foods, { id, name, amount: clean(food.amount, LIMITS.amount) }] },
  );
}

export function updateFood(plan: DietPlan, mealId: string, foodId: string, patch: Partial<Pick<Food, "name" | "amount">>): DietPlan {
  return mapMeal(plan, mealId, (m) => ({
    ...m,
    foods: m.foods.map((f) =>
      f.id === foodId
        ? { ...f, name: patch.name !== undefined ? clean(patch.name, LIMITS.name) || f.name : f.name, amount: patch.amount !== undefined ? clean(patch.amount, LIMITS.amount) : f.amount }
        : f,
    ),
  }));
}

export function removeFood(plan: DietPlan, mealId: string, foodId: string): DietPlan {
  return mapMeal(plan, mealId, (m) => ({ ...m, foods: m.foods.filter((f) => f.id !== foodId) }));
}

/** "Rolled oats, whey protein, banana" for a collapsed meal row. */
export function mealSummary(meal: Meal): string {
  if (!meal.foods.length) return "Nothing added yet";
  const names = meal.foods.map((f, i) => (i === 0 ? f.name : f.name.charAt(0).toLowerCase() + f.name.slice(1)));
  return names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

export function sanitizeDiet(input: unknown): DietPlan {
  const src = input as Record<string, unknown>;
  if (!src || typeof src !== "object") throw new Error("That nutrition plan couldn't be read.");
  const meals: Meal[] = [];
  for (const m of (Array.isArray(src.meals) ? src.meals : []).slice(0, LIMITS.meals) as Record<string, unknown>[]) {
    if (!m || typeof m !== "object") continue;
    const foods = (Array.isArray(m.foods) ? m.foods : [])
      .slice(0, LIMITS.foods)
      .map((f: Record<string, unknown>) => ({ id: clean(f?.id, 24) || newId(), name: clean(f?.name, LIMITS.name), amount: clean(f?.amount, LIMITS.amount) }))
      .filter((f: Food) => f.name);
    meals.push({ id: clean(m.id, 24) || newId(), name: clean(m.name, LIMITS.name) || `Meal ${meals.length + 1}`, foods });
  }
  const note = clean(src.note, LIMITS.note);
  return {
    v: 1,
    protein: clampInt(Number(src.protein ?? 0), 0, LIMITS.grams),
    carbs: clampInt(Number(src.carbs ?? 0), 0, LIMITS.grams),
    fat: clampInt(Number(src.fat ?? 0), 0, LIMITS.grams),
    showDailyPlan: src.showDailyPlan === true,
    meals,
    ...(note ? { note } : {}),
  };
}

export function diffDiet(before: DietPlan | null, after: DietPlan): string[] {
  const out: string[] = [];
  if (!before) return ["New nutrition plan"];
  if (kcalOf(before) !== kcalOf(after) || MACROS.some((m) => before[m.id] !== after[m.id])) {
    out.push(`Macros: ${after.protein} g protein, ${after.carbs} g carbs, ${after.fat} g fat (${kcalOf(after).toLocaleString("en-US")} kcal)`);
  }
  if (!before.showDailyPlan && after.showDailyPlan) out.push("Daily meal plan is on");
  if (after.showDailyPlan && JSON.stringify(before.meals) !== JSON.stringify(after.meals)) out.push("Meal plan updated");
  if ((before.note ?? "") !== (after.note ?? "") && after.note) out.push("New note from your coach");
  return out;
}

function mapMeal(plan: DietPlan, mealId: string, fn: (m: Meal) => Meal): DietPlan {
  return { ...plan, meals: plan.meals.map((m) => (m.id === mealId ? fn(m) : m)) };
}

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
