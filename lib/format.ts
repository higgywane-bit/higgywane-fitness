const thb = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** ฿1,200 */
export function formatTHB(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}฿${thb.format(Math.abs(Math.round(amount)))}`;
}

/** +฿40 / -฿20 (for price deltas) */
export function formatTHBDelta(amount: number): string {
  if (amount === 0) return "";
  return `${amount > 0 ? "+" : "-"}฿${thb.format(Math.abs(Math.round(amount)))}`;
}

export function formatGrams(g: number): string {
  return `${Math.round(g)} g`;
}

export const ALLERGEN_LABEL: Record<string, string> = {
  milk: "Milk",
  peanuts: "Peanuts",
  "tree-nuts": "Tree nuts",
  soy: "Soy",
  gluten: "Gluten",
};
