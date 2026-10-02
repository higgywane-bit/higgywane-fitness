"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronLeft, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getMenuItem } from "@/content/menu";
import { DrinkArt } from "@/components/cafe/drink-art";
import { OrderMacros } from "@/components/cart/cart-drawer";
import { PaymentMethods } from "@/components/checkout/payment-methods";
import { PromptPayScreen } from "@/components/checkout/promptpay-screen";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { placeOrder, paymentStatus } from "@/app/(site)/checkout/actions";
import { useCart, useCartUI } from "@/lib/cart-store";
import { useOrders } from "@/lib/order-store";
import { formatTHB } from "@/lib/format";
import { cartCount, cartSubtotal, selectionSummary } from "@/lib/nutrition";
import { pickupSlots, type Order, type ServiceMode } from "@/lib/orders";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "tap h-11 rounded-full text-[15px] font-semibold",
            value === o.id ? "bg-white text-black" : "text-text-secondary hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-[28px] uppercase">{title}</h2>
      {children}
    </section>
  );
}

const CTA: Record<PaymentMethod, (total: string) => string> = {
  promptpay: (t) => `Pay ${t} with PromptPay`,
  "apple-pay": (t) => `Pay ${t} with Apple Pay`,
  counter: () => "Place order, pay at the counter",
};

export function CheckoutView() {
  const router = useRouter();
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const setCartOpen = useCartUI((s) => s.setCartOpen);
  const saveOrder = useOrders((s) => s.save);
  const updatePayment = useOrders((s) => s.updatePayment);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [asap, setAsap] = useState(true);
  const [time, setTime] = useState<string>();
  const [mode, setMode] = useState<ServiceMode>("takeaway");
  const [table, setTable] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [pending, startTransition] = useTransition();
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [leaving, setLeaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLInputElement>(null);

  const slots = useMemo(() => (hydrated ? pickupSlots() : []), [hydrated]);
  const subtotal = cartSubtotal(lines);
  const count = cartCount(lines);

  const nameMissing = touched && !name.trim();
  const tableMissing = touched && mode === "dine-in" && !table.trim();

  const finish = (o: Order) => {
    setLeaving(true);
    saveOrder(o);
    clearCart();
    router.replace(`/order/${o.id}`);
  };

  const submit = (override?: PaymentMethod) => {
    const m = override ?? method;
    setTouched(true);
    setError(null);
    if (!name.trim()) return nameRef.current?.focus();
    if (mode === "dine-in" && !table.trim()) return tableRef.current?.focus();

    startTransition(async () => {
      const res = await placeOrder({
        lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, selections: l.selections, note: l.note })),
        customer: { name, contact },
        pickup: asap ? { asap: true } : { asap: false, time: time ?? slots[0] },
        service: { mode, table: mode === "dine-in" ? table : undefined },
        note,
        method: m,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const o = res.data;
      if (m === "promptpay") {
        saveOrder(o);
        setStatus(o.payment.status);
        setOrder(o);
        window.scrollTo({ top: 0 });
      } else if (m === "apple-pay") {
        // Mock: the provider authorises immediately. A real integration opens the Apple Pay sheet here.
        await new Promise((r) => setTimeout(r, 900));
        if (o.payment.status === "paid") finish(o);
        else setError("Apple Pay didn't go through. Try again or choose another method.");
      } else {
        finish(o);
      }
    });
  };

  // Poll PromptPay status while the QR is on screen.
  useEffect(() => {
    if (!order || order.payment.method !== "promptpay" || status !== "pending") return;
    const t = setInterval(async () => {
      const res = await paymentStatus(order.payment.id);
      if (res.ok) setStatus(res.data.status);
    }, 2000);
    return () => clearInterval(t);
  }, [order, status]);

  useEffect(() => {
    if (!order || status !== "paid") return;
    updatePayment(order.id, { ...order.payment, status: "paid" });
    const t = setTimeout(() => {
      clearCart();
      router.replace(`/order/${order.id}`);
    }, 1400);
    return () => clearTimeout(t);
  }, [order, status, updatePayment, clearCart, router]);

  if (!hydrated || leaving) return <div className="min-h-dvh" />;

  if (order) {
    return (
      <PromptPayScreen
        order={order}
        status={status}
        onCancel={() => setOrder(null)}
        onRetry={() => {
          setOrder(null);
          submit("promptpay");
        }}
        onPayAtCounter={() => {
          setOrder(null);
          setMethod("counter");
          submit("counter");
        }}
      />
    );
  }

  if (!lines.length) {
    return (
      <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-statement text-[52px]">Checkout</h1>
        <p className="mt-3 text-text-secondary">Your order is empty. Add a drink to check out.</p>
        <Button asChild size="lg" variant="inverse" className="mt-6">
          <Link href="/cafe">Browse the menu</Link>
        </Button>
      </div>
    );
  }

  const cta = CTA[method](formatTHB(subtotal));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 pb-8 md:px-8 md:pt-6">
      <Link
        href="/cafe"
        className="tap -ml-2 inline-flex h-11 items-center gap-1 rounded-full pr-4 pl-2 text-[15px] font-medium text-text-secondary hover:text-white"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Menu
      </Link>
      <h1 className="text-statement mt-2 text-[56px] md:text-[88px]">Checkout</h1>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-6 grid gap-10 md:mt-10 md:grid-cols-[minmax(0,1fr)_400px] md:gap-12"
      >
        <div className="order-2 space-y-10 md:order-1">
          <Section title="Your details">
            <div>
              <Label htmlFor="name">Name for the order</Label>
              <Input
                id="name"
                ref={nameRef}
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={nameMissing}
                aria-describedby={nameMissing ? "name-error" : undefined}
                placeholder="We'll call this when it's ready"
              />
              {nameMissing ? (
                <p id="name-error" className="mt-2 flex items-center gap-1.5 text-sm text-red-text">
                  <AlertCircle className="size-4" aria-hidden /> Add your name so we can call you.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="contact">
                Phone or member ID <span className="text-text-tertiary">(optional)</span>
              </Label>
              <Input
                id="contact"
                autoComplete="tel"
                inputMode="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="081 234 5678 or SF-0042"
              />
            </div>
          </Section>

          <Section title="Pickup">
            <Segmented
              label="Pickup time"
              value={asap ? "asap" : "later"}
              options={[
                { id: "asap", label: "As soon as possible" },
                { id: "later", label: "Choose a time" },
              ]}
              onChange={(v) => {
                setAsap(v === "asap");
                if (v === "later" && !time) setTime(slots[0]);
              }}
            />
            {asap ? (
              <p className="text-sm text-text-secondary">Usually ready in 5 to 10 minutes.</p>
            ) : slots.length ? (
              <div role="radiogroup" aria-label="Pickup slot" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={time === s}
                    onClick={() => setTime(s)}
                    className={cn(
                      "tap tabular h-11 shrink-0 rounded-full border px-4 text-[15px] font-semibold",
                      time === s ? "border-white bg-white text-black" : "border-hairline-strong text-text-secondary hover:text-white",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">The cafe is closing soon. Order for as soon as possible.</p>
            )}

            <Segmented
              label="Dine in or takeaway"
              value={mode}
              options={[
                { id: "takeaway", label: "Takeaway" },
                { id: "dine-in", label: "Dine in" },
              ]}
              onChange={setMode}
            />
            {mode === "dine-in" ? (
              <div>
                <Label htmlFor="table">Table number</Label>
                <Input
                  id="table"
                  ref={tableRef}
                  inputMode="numeric"
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  aria-invalid={tableMissing}
                  aria-describedby={tableMissing ? "table-error" : undefined}
                  placeholder="Printed on the table"
                  className="max-w-40"
                />
                {tableMissing ? (
                  <p id="table-error" className="mt-2 flex items-center gap-1.5 text-sm text-red-text">
                    <AlertCircle className="size-4" aria-hidden /> Add your table number.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <Label htmlFor="order-note">
                Note for the bar <span className="text-text-tertiary">(optional)</span>
              </Label>
              <Textarea
                id="order-note"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything the team should know"
              />
            </div>
          </Section>

          <Section title="Payment">
            <PaymentMethods value={method} onChange={setMethod} />
          </Section>

          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-tint p-4 text-sm font-medium text-red-text">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 -mx-4 bg-gradient-to-t from-black from-55% to-transparent px-4 pt-6 pb-3 md:static md:mx-0 md:bg-none md:p-0">
            <Button type="submit" size="lg" disabled={pending} className="w-full shadow-[0_12px_40px_-8px_rgb(0_0_0/0.9)]">
              {pending ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  {method === "apple-pay" ? "Confirming with Apple Pay" : "Placing your order"}
                </>
              ) : (
                cta
              )}
            </Button>
          </div>
        </div>

        <aside className="order-1 md:order-2" aria-label="Order summary">
          <div className="space-y-4 md:sticky md:top-24">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[28px] uppercase">Your order</h2>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="tap h-11 rounded-full px-3 text-sm font-semibold text-text-secondary hover:text-white"
              >
                Edit
              </button>
            </div>
            <OrderMacros lines={lines} />
            <ul className="divide-y divide-hairline rounded-3xl bg-surface-2 px-4">
              {lines.map((l) => {
                const item = getMenuItem(l.itemId);
                if (!item) return null;
                const summary = selectionSummary(item, l.selections);
                return (
                  <li key={l.id} className="flex items-center gap-3 py-3">
                    <DrinkArt item={item} sizes="48px" className="size-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">
                        <span className="tabular text-text-secondary">{l.qty}×</span> {item.name}
                      </p>
                      {summary.length ? <p className="truncate text-xs text-text-tertiary">{summary.join(", ")}</p> : null}
                    </div>
                    <p className="tabular text-[15px] font-semibold">{formatTHB(l.unitPrice * l.qty)}</p>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-baseline justify-between px-1">
              <span className="text-text-secondary">
                Total <span className="tabular">({count} {count === 1 ? "drink" : "drinks"})</span>
              </span>
              <span className="tabular text-2xl font-bold">{formatTHB(subtotal)}</span>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
