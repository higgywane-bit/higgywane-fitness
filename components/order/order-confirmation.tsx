"use client";

import Link from "next/link";
import { Check, Store } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { getMenuItem } from "@/content/menu";
import { DrinkArt } from "@/components/cafe/drink-art";
import { OrderMacros } from "@/components/cart/cart-drawer";
import { Button } from "@/components/ui/button";
import { useOrders } from "@/lib/order-store";
import { formatTHB } from "@/lib/format";
import { useHydrated } from "@/hooks/use-hydrated";

const METHOD_LABEL = { promptpay: "PromptPay", "apple-pay": "Apple Pay", counter: "Qashier terminal" } as const;

export function OrderConfirmation({ id }: { id: string }) {
  const hydrated = useHydrated();
  const order = useOrders((s) => s.orders.find((o) => o.id === id));
  const reduce = useReducedMotion();

  if (!hydrated) return <div className="min-h-dvh" />;

  if (!order) {
    return (
      <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-statement text-[52px]">Order not found</h1>
        <p className="mt-3 text-text-secondary">
          Orders are saved on the device they were placed from. Ask at the bar if you need help with an order.
        </p>
        <Button asChild size="lg" variant="inverse" className="mt-6">
          <Link href="/cafe">Back to the menu</Link>
        </Button>
      </div>
    );
  }

  const paid = order.payment.status === "paid";
  const pickup = order.pickup.asap ? "As soon as possible" : `At ${order.pickup.time}`;
  const service = order.service.mode === "dine-in" ? `Dine in, table ${order.service.table}` : "Takeaway";

  return (
    <div className="mx-auto max-w-xl px-4 pt-8 pb-12 md:pt-14">
      <motion.div
        initial={reduce ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className={`grid size-16 place-items-center rounded-full ${paid ? "bg-success text-black" : "bg-white text-black"}`}
      >
        {paid ? <Check className="size-8" strokeWidth={3} aria-hidden /> : <Store className="size-7" aria-hidden />}
      </motion.div>

      <p className="mt-6 text-text-secondary">Thanks, {order.customer.name}. Your order number is</p>
      <h1 className="text-statement tabular mt-1 text-[88px] md:text-[120px]">{order.number}</h1>

      <div className="mt-6 rounded-3xl bg-surface-2 p-5">
        <p className="text-lg font-semibold" role="status">
          {paid ? "Paid and sent to the bar" : "Sent to the bar. Pay at the counter."}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {paid
            ? `Paid ${formatTHB(order.subtotal)} with ${METHOD_LABEL[order.payment.method]}.`
            : `Show order ${order.number} at the counter and pay ${formatTHB(order.subtotal)} by card or cash.`}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4 text-sm">
          <div>
            <dt className="text-text-tertiary">Pickup</dt>
            <dd className="mt-0.5 font-semibold">{pickup}</dd>
          </div>
          <div>
            <dt className="text-text-tertiary">Service</dt>
            <dd className="mt-0.5 font-semibold">{service}</dd>
          </div>
        </dl>
      </div>

      <OrderMacros lines={order.lines} className="mt-4" />

      <ul className="mt-4 divide-y divide-hairline rounded-3xl bg-surface-2 px-4">
        {order.lines.map((l, i) => {
          const item = getMenuItem(l.itemId);
          return (
            <li key={i} className="flex items-center gap-3 py-3">
              {item ? <DrinkArt item={item} sizes="48px" className="size-12 shrink-0 rounded-xl" /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  <span className="tabular text-text-secondary">{l.qty}×</span> {l.name}
                </p>
                {l.summary.length ? <p className="truncate text-xs text-text-tertiary">{l.summary.join(", ")}</p> : null}
              </div>
              <p className="tabular text-[15px] font-semibold">{formatTHB(l.unitPrice * l.qty)}</p>
            </li>
          );
        })}
      </ul>

      <Button asChild size="lg" variant="inverse" className="mt-8 w-full">
        <Link href="/cafe">Back to the menu</Link>
      </Button>
    </div>
  );
}
