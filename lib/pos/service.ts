import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { cafeOrders, members } from "@/lib/db/schema";
import { ServiceError } from "@/lib/errors";
import { fullName, logActivity, sellPlan } from "@/lib/membership/service";
import { sumMacros, scaleMacros } from "@/lib/nutrition";
import { recordPlanSale, recordTillSale } from "@/lib/sales/service";
import { priceTicket, TILL_PAY_METHODS, type TillInput, type TillReceipt } from "./ticket";

export { priceTicket, TILL_PAY_METHODS, type TillInput, type TillLine, type TillPayMethod, type TillReceipt } from "./ticket";

/*
 * The Superfit till: cafe, merch and plans on one ticket, optionally on a member's
 * account. Prices are worked out here from the live catalog, never taken from the screen.
 */

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
