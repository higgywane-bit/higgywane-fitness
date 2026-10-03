import { eq } from "drizzle-orm";
import type { Selections } from "@/content/types";
import { getMenuItem, getPlan } from "@/lib/catalog";
import type { DB } from "@/lib/db/client";
import { cafeOrders, members } from "@/lib/db/schema";
import { ServiceError } from "@/lib/errors";
import { fullName, logActivity, sellPlan } from "@/lib/membership/service";
import { isSelectionValid, itemMacros, itemPrice, selectionSummary, sumMacros, scaleMacros } from "@/lib/nutrition";
import { recordPlanSale, recordTillSale } from "@/lib/sales/service";
import type { SaleCategory } from "@/lib/sales/qashier";

/*
 * The Superfit till: cafe, merch and plans on one ticket, optionally on a member's
 * account. Prices are worked out here from the live catalog, never taken from the screen.
 */

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

export async function ringUp(db: DB, input: TillInput, now = new Date()): Promise<TillReceipt> {
  if (!input.lines.length) throw new ServiceError("The ticket is empty.");
  if (input.lines.length > 60) throw new ServiceError("That's a lot of lines. Split it into two sales.");
  if (!TILL_PAY_METHODS.includes(input.paymentMethod)) throw new ServiceError("Pick how they paid.");
  const { menu, plans, total } = priceTicket(input.lines);

  let customer = input.customerName?.trim().slice(0, 60) || "Walk-in";
  if (input.memberId) {
    const [m] = await db.select().from(members).where(eq(members.id, input.memberId)).limit(1);
    if (!m) throw new ServiceError("Member not found.");
    customer = fullName(m);
  } else if (plans.length) {
    throw new ServiceError("Add the member to the sale to sell them a plan.");
  }

  const saleId = crypto.randomUUID();
  const number = `T-${String(now.getTime()).slice(-5)}`;
  const ref = input.paymentRef?.trim().slice(0, 60) || null;

  const soldPlans: TillReceipt["plans"] = [];
  for (const p of plans) {
    const row = await sellPlan(db, input.memberId!, { planId: p.planId, paymentMethod: input.paymentMethod, paymentRef: ref ?? number }, now);
    await recordPlanSale(db, row, now);
    soldPlans.push({ name: row.planName, endsOn: row.endsOn });
  }

  let orderNumber: string | null = null;
  if (menu.length) {
    const subtotal = menu.reduce((a, l) => a + l.unit * l.qty, 0);
    const macros = sumMacros(menu.map((l) => scaleMacros(l.macros, l.qty)));
    const cafe = menu.filter((l) => l.category === "cafe");
    if (cafe.length) {
      orderNumber = number;
      await db.insert(cafeOrders).values({
        id: saleId,
        number,
        status: input.sendToBar === false ? "collected" : "new",
        customerName: customer,
        channel: "pos",
        serviceMode: "takeaway",
        lines: cafe.map((l) => ({ name: l.name, qty: l.qty, summary: l.summary, note: l.note, unitPrice: l.unit })),
        subtotal: cafe.reduce((a, l) => a + l.unit * l.qty, 0),
        protein: Math.round(macros.protein),
        kcal: Math.round(macros.kcal),
        paymentMethod: input.paymentMethod,
        paymentStatus: "paid",
        memberId: input.memberId ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const category of ["cafe", "retail"] as const) {
      const ls = menu.filter((l) => l.category === category);
      if (!ls.length) continue;
      const amount = ls.reduce((a, l) => a + l.unit * l.qty, 0);
      await recordTillSale(db, {
        externalId: `${saleId}:${category}`,
        occurredAt: now,
        amountSatang: amount * 100,
        category,
        description: `${number} · ${ls.map((l) => `${l.qty}× ${l.name}`).join(", ")}`.slice(0, 200),
        paymentMethod: input.paymentMethod,
        memberId: input.memberId ?? null,
        items: ls.map((l) => ({ name: l.name, qty: l.qty, amountSatang: l.unit * l.qty * 100 })),
      });
    }
    if (input.memberId) {
      await logActivity(db, input.memberId, "till.sale", `Bought ${menu.map((l) => `${l.qty}× ${l.name}`).join(", ")} at the till · ฿${subtotal.toLocaleString("en-US")} ${input.paymentMethod}`, now);
    }
  }

  return {
    saleId,
    number,
    total,
    customer,
    orderNumber,
    plans: soldPlans,
    lines: [
      ...plans.map((p) => ({ name: p.name, qty: 1, amount: p.price, summary: [] })),
      ...menu.map((l) => ({ name: l.name, qty: l.qty, amount: l.unit * l.qty, summary: l.summary })),
    ],
  };
}
