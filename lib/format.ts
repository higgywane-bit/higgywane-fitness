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

/** +66812345678 → 081 234 5678 (Thai numbers as people write them); others unchanged. */
export function formatPhone(p: string | null | undefined): string {
  if (!p) return "";
  const m = p.match(/^\+66(\d{8,9})$/);
  if (!m) return p;
  const local = `0${m[1]}`;
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}
