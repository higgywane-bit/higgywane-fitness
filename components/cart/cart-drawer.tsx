"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { getMenuItem } from "@/lib/catalog";
import type { CartLine } from "@/content/types";
import { DrinkArt } from "@/components/cafe/drink-art";
import { StarMark } from "@/components/brand/logo";
import { MACRO_META, MacroRing } from "@/components/macros/macro-panel";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useCart, useCartUI } from "@/lib/cart-store";
import { formatTHB } from "@/lib/format";
import { cartCount, cartMacros, cartSubtotal, macroSplit, roundMacros, selectionSummary } from "@/lib/nutrition";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export function OrderMacros({ lines, className }: { lines: Pick<CartLine, "qty" | "unitMacros">[]; className?: string }) {
  const macros = roundMacros(cartMacros(lines));
  const split = macroSplit(macros);
  return (
    <section aria-label="Order nutrition" className={cn("rounded-3xl bg-surface-2 p-4", className)}>
      <div className="flex items-center gap-5">
        <MacroRing macros={macros} size={116} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-secondary">This order</p>
          <p className="mt-0.5 leading-none">
            <span className="font-display tabular text-[40px] text-red-text">{macros.protein}</span>
            <span className="ml-1 text-sm font-medium text-text-secondary">g protein</span>
          </p>
          <dl className="mt-3 space-y-1.5">
            {MACRO_META.map((m) => (
              <div key={m.key} className="flex items-center gap-2 text-sm">
                <span aria-hidden className={cn("size-2 rounded-full", m.swatch)} />
                <dt className="text-text-secondary">{m.label}</dt>
                <dd className="tabular ml-auto font-semibold">
                  {macros[m.key]} g <span className="ml-1 font-normal text-text-tertiary">{split[m.key]}%</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Line({ line, onEdit }: { line: CartLine; onEdit: (line: CartLine) => void }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const item = getMenuItem(line.itemId);
  const reduce = useReducedMotion();
  if (!item) return null;
  const summary = selectionSummary(item, line.selections);
  const m = roundMacros(line.unitMacros);

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
      className="flex gap-3 py-4"
    >
      <DrinkArt item={item} sizes="64px" className="size-16 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl leading-none uppercase">{item.name}</h3>
          <p className="tabular text-[15px] font-semibold">{formatTHB(line.unitPrice * line.qty)}</p>
        </div>
        {summary.length ? <p className="mt-1 text-[13px] leading-snug text-text-secondary">{summary.join(", ")}</p> : null}
        {line.note ? <p className="mt-0.5 text-[13px] text-text-tertiary italic">&ldquo;{line.note}&rdquo;</p> : null}
        <p className="tabular mt-1 text-xs text-text-tertiary">
          {m.kcal} kcal, <span className="text-red-text">{m.protein} g protein</span>
          {line.qty > 1 ? " each" : ""}
        </p>
        <div className="mt-2 flex items-center gap-1">
          <div className="flex items-center rounded-full bg-surface-3" role="group" aria-label={`Quantity of ${item.name}`}>
            <button
              type="button"
              onClick={() => setQty(line.id, line.qty - 1)}
              aria-label={line.qty === 1 ? `Remove ${item.name}` : "Decrease quantity"}
              className="tap grid size-11 place-items-center rounded-full"
            >
              {line.qty === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
            </button>
            <span className="tabular w-5 text-center text-sm font-semibold">{line.qty}</span>
            <button
              type="button"
              onClick={() => setQty(line.id, line.qty + 1)}
              aria-label="Increase quantity"
              className="tap grid size-11 place-items-center rounded-full"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onEdit(line)}
            className="tap ml-1 h-11 rounded-full px-3 text-sm font-semibold text-text-secondary hover:text-white"
          >
            Edit
          </button>
          {line.qty > 1 ? (
            <button
              type="button"
              onClick={() => remove(line.id)}
              className="tap h-11 rounded-full px-3 text-sm font-semibold text-text-secondary hover:text-white"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </motion.li>
  );
}

export function CartDrawer() {
  const open = useCartUI((s) => s.cartOpen);
  const setOpen = useCartUI((s) => s.setCartOpen);
  const lines = useCart((s) => s.lines);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const router = useRouter();

  const count = cartCount(lines);
  const subtotal = cartSubtotal(lines);

  const edit = (line: CartLine) => {
    setOpen(false);
    const item = getMenuItem(line.itemId);
    if (item) setTimeout(() => router.push(`/cafe/${item.slug}?edit=${line.id}`, { scroll: false }), desktop ? 0 : 220);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction={desktop ? "right" : "bottom"}>
      <DrawerContent side={desktop ? "right" : "bottom"} className={cn(!desktop && "h-[90dvh]")}>
        <div className="flex items-center justify-between px-4 pt-2 pb-3 md:px-6 md:pt-5">
          <div>
            <DrawerTitle className="text-statement text-[36px]">Your order</DrawerTitle>
            <DrawerDescription className="tabular mt-1 text-sm text-text-secondary">
              {count ? `${count} ${count === 1 ? "drink" : "drinks"}` : "Nothing added yet"}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <button type="button" aria-label="Close cart" className="tap grid size-11 place-items-center rounded-full bg-surface-3">
              <X className="size-5" />
            </button>
          </DrawerClose>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
            <StarMark className="size-20 text-white/10" background="var(--surface-1)" />
            <p className="mt-5 text-lg font-semibold">Your order is empty</p>
            <p className="mt-1 max-w-xs text-sm text-text-secondary">
              Pick a smoothie, juice or coffee and it will land here with its macros.
            </p>
            <Button asChild size="lg" variant="inverse" className="mt-6">
              <Link href="/cafe" onClick={() => setOpen(false)}>
                Browse the menu
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:px-6">
              <OrderMacros lines={lines} />
              <ul className="divide-y divide-hairline">
                <AnimatePresence initial={false}>
                  {lines.map((l) => (
                    <Line key={l.id} line={l} onEdit={edit} />
                  ))}
                </AnimatePresence>
              </ul>
            </div>
            <div className="pb-safe border-t border-hairline bg-surface-1 px-4 pt-4 md:px-6">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-text-secondary">Subtotal</span>
                <span className="tabular text-xl font-bold">{formatTHB(subtotal)}</span>
              </div>
              <Button asChild size="lg" className="mb-4 w-full">
                <Link href="/checkout" onClick={() => setOpen(false)}>
                  Go to checkout
                </Link>
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
