"use server";

import { getMenuItem } from "@/content/menu";
import { getPaymentProvider } from "@/lib/payments";
import type { Payment } from "@/lib/payments/types";
import {
  cartMacros,
  cartSubtotal,
  isSelectionValid,
  itemMacros,
  itemPrice,
  selectionSummary,
} from "@/lib/nutrition";
import type { Order, OrderInput, OrderLine } from "@/lib/orders";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function placeOrder(input: OrderInput): Promise<Result<Order>> {
  const name = input.customer.name?.trim();
  if (!name) return { ok: false, error: "Add your name so we can call you when it's ready." };
  if (!input.lines.length) return { ok: false, error: "Your order is empty." };
  if (input.service.mode === "dine-in" && !input.service.table?.trim()) {
    return { ok: false, error: "Add your table number, or switch to takeaway." };
  }

  // Re-price on the server from menu data. Never trust client totals.
  const lines: OrderLine[] = [];
  for (const l of input.lines) {
    const item = getMenuItem(l.itemId);
    if (!item || item.available === false) return { ok: false, error: "Something in your order is no longer available." };
    if (!isSelectionValid(item, l.selections)) return { ok: false, error: `Check the options for ${item.name}.` };
    const qty = Math.max(1, Math.min(20, Math.floor(l.qty)));
    lines.push({
      itemId: item.id,
      name: item.name,
      qty,
      selections: l.selections,
      summary: selectionSummary(item, l.selections),
      note: l.note?.slice(0, 140),
      unitPrice: itemPrice(item, l.selections),
      unitMacros: itemMacros(item, l.selections),
    });
  }

  const subtotal = cartSubtotal(lines);
  const id = crypto.randomUUID();
  const number = `SF-${String(Date.now()).slice(-4)}`;

  const payment = await getPaymentProvider().createPayment({
    orderId: id,
    orderNumber: number,
    amount: subtotal,
    method: input.method,
    customerName: name,
  });

  // TODO: persist the order and notify staff (session 5: real ordering)
  return {
    ok: true,
    data: {
      id,
      number,
      createdAt: new Date().toISOString(),
      lines,
      subtotal,
      macros: cartMacros(lines),
      customer: { name, contact: input.customer.contact?.trim() || undefined },
      pickup: input.pickup,
      service: input.service,
      note: input.note?.trim() || undefined,
      payment,
    },
  };
}

export async function paymentStatus(paymentId: string): Promise<Result<Payment>> {
  try {
    return { ok: true, data: await getPaymentProvider().getStatus(paymentId) };
  } catch {
    return { ok: false, error: "We couldn't check the payment. Try again." };
  }
}
