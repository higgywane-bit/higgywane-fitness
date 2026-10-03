import type { Selections } from "@/content/types";
import { getMenuItem, getPlan } from "@/lib/catalog";
import { ServiceError } from "@/lib/errors";
import { isSelectionValid, itemMacros, itemPrice, selectionSummary } from "@/lib/nutrition";
import type { SaleCategory } from "@/lib/sales/qashier";

/* Till maths, no database: the screen and the server price a ticket the same way. */

export type TillPayMethod = "qashier" | "promptpay" | "cash";
export const TILL_PAY_METHODS: TillPayMethod[] = ["qashier", "promptpay", "cash"];

export type TillLine =
  | { kind: "menu"; itemId: string; qty: number; selections: Selections; note?: string }
  | { kind: "plan"; planId: string };

export type TillInput = {
  memberId?: string | null;
  customerName?: string | null;
  lines: TillLine[];
  paymentMethod: TillPayMethod;
  paymentRef?: string | null;
  /** drinks/food go on the bar's order board */
  sendToBar?: boolean;
};

export type TillReceipt = {
  saleId: string;
  number: string;
  total: number;
  customer: string;
  orderNumber: string | null;
  plans: { name: string; endsOn: string }[];
  lines: { name: string; qty: number; amount: number; summary: string[] }[];
};

type Priced = {
  name: string;
  qty: number;
  unit: number;
  summary: string[];
  note?: string;
  category: SaleCategory;
  macros: ReturnType<typeof itemMacros>;
};

/** Prices a ticket without saving anything (the screen shows the same maths). */
export function priceTicket(lines: TillLine[]) {
  const menu: Priced[] = [];
  const plans: { planId: string; name: string; price: number; kind: "membership" | "pt" }[] = [];
  for (const l of lines) {
    if (l.kind === "plan") {
      const p = getPlan(l.planId);
      if (!p || p.hidden) throw new ServiceError("That plan is no longer sold.");
      plans.push({ planId: p.id, name: p.name, price: p.price, kind: p.kind });
      continue;
    }
    const item = getMenuItem(l.itemId);
    if (!item || item.available === false) throw new ServiceError(`${item?.name ?? "An item"} is sold out.`);
    if (!isSelectionValid(item, l.selections)) throw new ServiceError(`Check the options for ${item.name}.`);
    const qty = Math.floor(l.qty);
    if (!(qty >= 1 && qty <= 50)) throw new ServiceError("Quantity must be 1 to 50.");
    menu.push({
      name: item.name,
      qty,
      unit: itemPrice(item, l.selections),
      summary: selectionSummary(item, l.selections),
      note: l.note?.trim().slice(0, 140) || undefined,
      category: item.category === "merchandise" ? "retail" : "cafe",
      macros: itemMacros(item, l.selections),
    });
  }
  const total = menu.reduce((a, l) => a + l.unit * l.qty, 0) + plans.reduce((a, p) => a + p.price, 0);
  return { menu, plans, total };
}
