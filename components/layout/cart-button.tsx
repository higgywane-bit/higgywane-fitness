"use client";

import { ShoppingBag } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCart, useCartUI } from "@/lib/cart-store";
import { cartCount, cartSubtotal } from "@/lib/nutrition";
import { formatTHB } from "@/lib/format";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

function useCartSummary() {
  const lines = useCart((s) => s.lines);
  const tick = useCart((s) => s.addedTick);
  const hydrated = useHydrated();
  return {
    count: hydrated ? cartCount(lines) : 0,
    total: hydrated ? cartSubtotal(lines) : 0,
    tick,
  };
}

function Badge({ count, tick, className }: { count: number; tick: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.span
          key={reduce ? "badge" : `badge-${tick}`}
          initial={reduce ? false : { scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 600, damping: 18 }}
          className={cn(
            "tabular grid h-5 min-w-5 place-items-center rounded-full bg-red px-1.5 text-[11px] font-bold leading-none text-white",
            className,
          )}
        >
          {count}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

/** Bottom tab bar cart item (mobile). */
export function CartTab() {
  const { count, tick } = useCartSummary();
  const open = useCartUI((s) => s.setCartOpen);
  return (
    <button
      type="button"
      onClick={() => open(true)}
      className="group tap flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-text-tertiary"
      aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart, empty"}
    >
      <span data-cart-target className="relative grid h-8 w-14 place-items-center rounded-full">
        <ShoppingBag className="size-[22px]" strokeWidth={1.75} />
        <Badge count={count} tick={tick} className="absolute -top-1 right-1" />
      </span>
      <span className="text-[11px] font-medium">Cart</span>
    </button>
  );
}

/** Header cart button (desktop). */
export function CartHeaderButton() {
  const { count, total, tick } = useCartSummary();
  const open = useCartUI((s) => s.setCartOpen);
  return (
    <button
      type="button"
      onClick={() => open(true)}
      className="tap flex h-11 items-center gap-3 rounded-full bg-surface-2 pr-4 pl-3 text-sm font-semibold hover:bg-surface-3"
      aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}, ${formatTHB(total)}` : "Cart, empty"}
    >
      <span data-cart-target className="relative">
        <ShoppingBag className="size-5" strokeWidth={1.75} />
      </span>
      {count > 0 ? (
        <>
          <span className="tabular">{formatTHB(total)}</span>
          <Badge count={count} tick={tick} />
        </>
      ) : (
        <span>Cart</span>
      )}
    </button>
  );
}
