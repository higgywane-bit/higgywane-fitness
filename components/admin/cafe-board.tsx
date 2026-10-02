"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Banknote, Clock, Store, UtensilsCrossed, X } from "lucide-react";
import { cafeBoardAction, markOrderPaidAction, setOrderStatusAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import type { CafeOrderStatus } from "@/lib/db/schema";
import { formatTHB } from "@/lib/format";
import type { BoardOrder } from "@/lib/cafe/serialize";
import { cn } from "@/lib/utils";

const COLUMNS: { id: CafeOrderStatus; label: string; next?: string }[] = [
  { id: "new", label: "New", next: "Start" },
  { id: "preparing", label: "Preparing", next: "Ready" },
  { id: "ready", label: "Ready", next: "Collected" },
  { id: "collected", label: "Collected today" },
];
const FLOW: CafeOrderStatus[] = ["new", "preparing", "ready", "collected"];

function minsAgo(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 1 ? "just now" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** The bar's live board. Polls every 10 s and chimes when a new order lands. */
export function CafeBoard({ initial }: { initial: BoardOrder[] }) {
  const [orders, setOrders] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const known = useRef(new Set(initial.map((o) => o.id)));

  useEffect(() => {
    const t = setInterval(async () => {
      setNow(Date.now());
      const res = await cafeBoardAction();
      if (!res.ok) return;
      const fresh = res.data.filter((o) => o.status === "new" && !known.current.has(o.id));
      res.data.forEach((o) => known.current.add(o.id));
      if (fresh.length) chime();
      setOrders(res.data);
    }, 10_000);
    return () => clearInterval(t);
  }, []);

  function move(o: BoardOrder, status: CafeOrderStatus) {
    setOrders((xs) => xs.map((x) => (x.id === o.id ? { ...x, status } : x)));
    start(async () => {
      await setOrderStatusAction(o.id, status);
    });
  }

  // the server only sends today's orders plus anything still open
  const col = (id: CafeOrderStatus) =>
    orders
      .filter((o) => o.status === id)
      .sort((a, b) => (id === "collected" ? b.updatedAt.localeCompare(a.updatedAt) : a.createdAt.localeCompare(b.createdAt)));

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((c) => {
        const list = col(c.id);
        return (
          <section key={c.id} aria-label={c.label} className="flex min-h-40 flex-col rounded-3xl border border-hairline bg-surface-1 p-3">
            <h2 className="flex items-center justify-between px-1 pt-1 pb-3 text-[15px] font-semibold">
              {c.label}
              <span className="tabular rounded-full bg-surface-3 px-2 py-0.5 text-xs text-text-secondary">{list.length}</span>
            </h2>
            <ul className="space-y-2">
              {(c.id === "collected" ? list.slice(0, 12) : list).map((o) => {
                const late = c.id !== "collected" && now - new Date(o.createdAt).getTime() > 15 * 60_000;
                const i = FLOW.indexOf(o.status);
                return (
                  <li key={o.id} className={cn("rounded-2xl bg-surface-2 p-3 ring-1 ring-inset", c.id === "ready" ? "ring-success/40" : late ? "ring-energy/40" : "ring-hairline")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="tabular font-display text-2xl leading-none">{o.number}</p>
                        <p className="mt-1 truncate text-sm font-semibold">{o.customerName}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p className={cn("inline-flex items-center gap-1", late ? "font-semibold text-energy" : "text-text-tertiary")}>
                          <Clock className="size-3" aria-hidden />
                          {minsAgo(o.createdAt, now)}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-text-secondary">
                          {o.serviceMode === "dine-in" ? <UtensilsCrossed className="size-3" aria-hidden /> : <Store className="size-3" aria-hidden />}
                          {o.serviceMode === "dine-in" ? `Table ${o.table ?? "–"}` : o.pickupTime ? `Pickup ${o.pickupTime}` : "Takeaway"}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {o.lines.map((l, k) => (
                        <li key={k}>
                          <span className="tabular font-semibold">{l.qty}×</span> {l.name}
                          {l.summary.length ? <span className="block text-xs text-text-tertiary">{l.summary.join(", ")}</span> : null}
                          {l.note ? <span className="block text-xs text-energy">“{l.note}”</span> : null}
                        </li>
                      ))}
                    </ul>
                    {o.note ? <p className="mt-1 text-xs text-energy">Note: {o.note}</p> : null}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={cn("text-xs font-semibold", o.paymentStatus === "paid" ? "text-success" : "text-energy")}>
                        {formatTHB(o.subtotal)} · {o.paymentStatus === "paid" ? "Paid" : "Pay at counter"}
                      </span>
                      <div className="flex gap-1">
                        {o.paymentStatus !== "paid" && c.id !== "collected" ? (
                          <Button size="sm" variant="ghost" aria-label={`Mark ${o.number} paid`} disabled={pending} onClick={() => start(async () => { await markOrderPaidAction(o.id); setOrders((xs) => xs.map((x) => (x.id === o.id ? { ...x, paymentStatus: "paid" } : x))); })}>
                            <Banknote className="size-4" />
                          </Button>
                        ) : null}
                        {c.id === "new" ? (
                          <Button size="sm" variant="ghost" aria-label={`Cancel ${o.number}`} disabled={pending} onClick={() => move(o, "cancelled")}>
                            <X className="size-4" />
                          </Button>
                        ) : null}
                        {c.next ? (
                          <Button size="sm" variant={c.id === "ready" ? "secondary" : "primary"} disabled={pending} onClick={() => move(o, FLOW[i + 1])}>
                            {c.next}
                            <ArrowRight className="size-3.5" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
              {!list.length ? <li className="px-1 py-6 text-center text-sm text-text-tertiary">Nothing here</li> : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880, 990].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.21);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* no audio */
  }
}
