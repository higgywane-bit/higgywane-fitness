import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { cafeOrders, type CafeOrderRow, type CafeOrderStatus } from "@/lib/db/schema";
import { localDate } from "@/lib/membership/dates";
import { ServiceError } from "@/lib/membership/service";
import type { Order } from "@/lib/orders";

/* Website cafe orders on the bar's board: new → preparing → ready → collected. */

export const ORDER_FLOW: CafeOrderStatus[] = ["new", "preparing", "ready", "collected"];

export const ORDER_STATUS_LABEL: Record<CafeOrderStatus, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  collected: "Collected",
  cancelled: "Cancelled",
};

export function nextStatus(s: CafeOrderStatus): CafeOrderStatus | null {
  const i = ORDER_FLOW.indexOf(s);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
}

export async function saveWebOrder(db: DB, o: Order) {
  await db
    .insert(cafeOrders)
    .values({
      id: o.id,
      number: o.number,
      customerName: o.customer.name,
      contact: o.customer.contact ?? null,
      serviceMode: o.service.mode,
      table: o.service.table ?? null,
      pickupTime: o.pickup.asap ? null : (o.pickup.time ?? null),
      note: o.note ?? null,
      lines: o.lines.map((l) => ({ name: l.name, qty: l.qty, summary: l.summary, note: l.note, unitPrice: l.unitPrice })),
      subtotal: o.subtotal,
      protein: Math.round(o.macros.protein),
      kcal: Math.round(o.macros.kcal),
      paymentMethod: o.payment.method,
      paymentStatus: o.payment.status,
      createdAt: new Date(o.createdAt),
    })
    .onConflictDoNothing();
}

export async function setOrderStatus(db: DB, id: string, status: CafeOrderStatus) {
  if (!(status in ORDER_STATUS_LABEL)) throw new ServiceError("Unknown status.");
  const [row] = await db.update(cafeOrders).set({ status, updatedAt: new Date() }).where(eq(cafeOrders.id, id)).returning();
  if (!row) throw new ServiceError("Order not found.");
  return row;
}

export async function markOrderPaid(db: DB, id: string) {
  await db.update(cafeOrders).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(cafeOrders.id, id));
}

/** Today's board plus anything still open from earlier. */
export async function boardOrders(db: DB, now = new Date()): Promise<CafeOrderRow[]> {
  const start = new Date(`${localDate(now)}T00:00:00+07:00`);
  const [today, open] = await Promise.all([
    db.select().from(cafeOrders).where(gte(cafeOrders.createdAt, start)).orderBy(desc(cafeOrders.createdAt)),
    db
      .select()
      .from(cafeOrders)
      .where(and(inArray(cafeOrders.status, ["new", "preparing", "ready"])))
      .orderBy(desc(cafeOrders.createdAt)),
  ]);
  const seen = new Set<string>();
  return [...open, ...today].filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

export async function orderStatus(db: DB, id: string) {
  const [row] = await db.select({ status: cafeOrders.status, paymentStatus: cafeOrders.paymentStatus }).from(cafeOrders).where(eq(cafeOrders.id, id)).limit(1);
  return row ?? null;
}
