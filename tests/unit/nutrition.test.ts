import { describe, expect, it } from "vitest";
import { getMenuItem, menu } from "@/content/menu";
import type { MenuItem } from "@/content/types";
import {
  allergensFor,
  cartMacros,
  cartSubtotal,
  defaultSelections,
  ingredientMacros,
  ingredientNames,
  isSelectionValid,
  itemMacros,
  itemPrice,
  macroSplit,
  optionImpact,
  selectionSummary,
  sumMacros,
  toggleOption,
} from "@/lib/nutrition";

const item = (slug: string): MenuItem => {
  const m = getMenuItem(slug);
  if (!m) throw new Error(slug);
  return m;
};

describe("menu data", () => {
  it("every item builds valid default selections", () => {
    for (const m of menu) {
      expect(isSelectionValid(m, defaultSelections(m)), m.slug).toBe(true);
    }
  });

  it("takes prices from pricing.json", () => {
    expect(item("berry-hype").basePrice).toBe(149);
    expect(item("berry-hype").priceIsFrom).toBe(true);
    expect(item("latte").basePrice).toBe(120);
    expect(item("latte").priceIsFrom).toBe(false);
    expect(item("skinny-and-rich").name).toBe("Skinny & Rich");
  });
});

describe("itemMacros", () => {
  it("sums recipe plus default base", () => {
    const m = item("berry-hype");
    const macros = itemMacros(m, defaultSelections(m));
    const expected = sumMacros([
      ingredientMacros("mixed-berries", 150),
      ingredientMacros("banana", 60),
      ingredientMacros("whey-vanilla", 30),
      ingredientMacros("honey", 10),
      ingredientMacros("almond-milk", 250),
    ]);
    for (const k of Object.keys(expected) as (keyof typeof expected)[]) {
      expect(macros[k] ?? 0, k).toBeCloseTo(expected[k] ?? 0, 6);
    }
  });

  it("Large scales the recipe and base but not add-ons", () => {
    const m = item("berry-hype");
    const base = defaultSelections(m);
    const regular = itemMacros(m, base);
    const large = itemMacros(m, { ...base, "size-smoothie": ["large"] });
    expect(large.kcal).toBeCloseTo(regular.kcal * 1.4, 6);

    const withWhey = { ...base, "smoothie-addons": ["whey"] };
    const largeWithWhey = itemMacros(m, { ...withWhey, "size-smoothie": ["large"] });
    const whey = ingredientMacros("whey-vanilla", 30);
    expect(largeWithWhey.protein).toBeCloseTo(regular.protein * 1.4 + whey.protein, 6);
  });

  it("removing an ingredient subtracts its macros", () => {
    const m = item("berry-hype");
    const base = defaultSelections(m);
    const without = itemMacros(m, { ...base, remove: ["honey"] });
    expect(itemMacros(m, base).sugar! - without.sugar!).toBeCloseTo(ingredientMacros("honey", 10).sugar!, 6);
  });

  it("swapping milk uses the drink's own milk amount", () => {
    const latte = item("latte");
    const capp = item("cappuccino");
    const swap = (m: MenuItem) => {
      const s = defaultSelections(m);
      return itemMacros(m, s).kcal - itemMacros(m, { ...s, "coffee-milk": ["almond"] }).kcal;
    };
    // fresh 61 kcal/100ml vs almond 15 → 0.46 kcal per ml saved
    expect(swap(latte)).toBeCloseTo(220 * 0.46, 6);
    expect(swap(capp)).toBeCloseTo(150 * 0.46, 6);
  });
});

describe("itemPrice", () => {
  it("adds option deltas to base price", () => {
    const m = item("thick");
    const s = defaultSelections(m);
    expect(itemPrice(m, s)).toBe(149);
    const s2 = { ...s, "size-smoothie": ["large"], "smoothie-base": ["oat"], "smoothie-addons": ["whey", "creatine"] };
    expect(itemPrice(m, s2)).toBe(149 + 40 + 15 + 40 + 30);
  });

  it("iced coffee costs ฿10 more by default", () => {
    const m = item("latte");
    expect(itemPrice(m, defaultSelections(m))).toBe(130);
    expect(itemPrice(m, { ...defaultSelections(m), temperature: ["hot"] })).toBe(120);
  });
});

describe("toggleOption", () => {
  it("single required groups always keep one choice", () => {
    const m = item("latte");
    const s = defaultSelections(m);
    expect(toggleOption(m, s, "temperature", "iced").temperature).toEqual(["iced"]);
    expect(toggleOption(m, s, "temperature", "hot").temperature).toEqual(["hot"]);
  });

  it("multi groups respect max", () => {
    const m = item("berry-hype");
    let s = defaultSelections(m);
    for (const id of ["whey", "pb", "oats", "creatine", "collagen"]) s = toggleOption(m, s, "smoothie-addons", id);
    expect(s["smoothie-addons"]).toEqual(["whey", "pb", "oats", "creatine"]);
    s = toggleOption(m, s, "smoothie-addons", "pb");
    expect(s["smoothie-addons"]).toEqual(["whey", "oats", "creatine"]);
  });

  it("optionImpact reports the price and protein a tap adds", () => {
    const m = item("banana-bam-bam");
    const impact = optionImpact(m, defaultSelections(m), "smoothie-addons", "whey");
    expect(impact.price).toBe(40);
    expect(impact.macros.protein).toBeCloseTo(23.4, 6);
  });
});

describe("labels", () => {
  it("summarises non-default choices", () => {
    const m = item("latte");
    const s = { ...defaultSelections(m), "coffee-milk": ["oat"], "coffee-extras": ["whey"], temperature: ["iced"] };
    expect(selectionSummary(m, s)).toEqual(["Oat milk", "+ Whey scoop"]);
  });

  it("lists final ingredients and allergens", () => {
    const m = item("strong-vibes");
    const s = { ...defaultSelections(m), remove: ["banana"], "smoothie-base": ["almond"] };
    expect(ingredientNames(m, s)).toEqual(["Peanut butter", "Vanilla whey", "Honey", "Almond milk"]);
    expect(allergensFor(m, s).sort()).toEqual(["milk", "peanuts", "tree-nuts"]);
  });
});

describe("cart maths", () => {
  it("multiplies unit snapshots by quantity", () => {
    const lines = [
      { qty: 2, unitPrice: 149, unitMacros: { kcal: 300, protein: 30, carbs: 30, fat: 5 } },
      { qty: 1, unitPrice: 120, unitMacros: { kcal: 140, protein: 7, carbs: 11, fat: 7 } },
    ];
    expect(cartSubtotal(lines)).toBe(418);
    const m = cartMacros(lines);
    expect(m.kcal).toBe(740);
    expect(m.protein).toBe(67);
  });

  it("macroSplit sums to 100", () => {
    const split = macroSplit({ kcal: 0, protein: 30, carbs: 40, fat: 10 });
    expect(split.protein + split.carbs + split.fat).toBe(100);
    expect(split.protein).toBe(32); // 120 of 370 kcal
    expect(macroSplit({ kcal: 0, protein: 0, carbs: 0, fat: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});
