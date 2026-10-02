"use client";

import { Minus, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { MenuItem, Selections } from "@/content/types";
import { DrinkArt } from "@/components/cafe/drink-art";
import { OptionGroupView } from "@/components/cafe/option-groups";
import { MacroPanel } from "@/components/macros/macro-panel";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { AddToCartFeedback } from "@/components/motion/add-to-cart-feedback";
import { Tag } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/input";
import { useCart } from "@/lib/cart-store";
import { haptic, useFly } from "@/lib/fly-store";
import { ALLERGEN_LABEL, formatTHB, formatTHBDelta } from "@/lib/format";
import {
  allergensFor,
  defaultSelections,
  ingredientNames,
  itemGroups,
  itemMacros,
  itemPrice,
  optionImpact,
} from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const TAG_LABEL = {
  "high-protein": "High Protein",
  "low-cal": "Low Cal",
  vegan: "Vegan",
  caffeine: "High Caffeine",
  recovery: "Recovery",
  energy: "Energy",
  "pre-workout": "Pre-Workout",
  "post-workout": "Post-Workout",
  "best-seller": "Best Seller",
  "limited-edition": "Limited Edition",
} as const;

export const TAG_VARIANT_MAP: Record<keyof typeof TAG_LABEL, "protein" | "energy" | "recovery" | "bestseller" | "limited" | "default"> = {
  "high-protein": "protein",
  "low-cal": "default",
  vegan: "default",
  caffeine: "energy",
  recovery: "recovery",
  energy: "energy",
  "pre-workout": "energy",
  "post-workout": "recovery",
  "best-seller": "bestseller",
  "limited-edition": "limited",
};

type Layout = "sheet" | "modal" | "page";

type Props = {
  item: MenuItem;
  layout: Layout;
  /** when editing an existing cart line */
  edit?: { lineId: string; selections: Selections; qty: number; note?: string };
  onClose?: () => void;
  onDone?: () => void;
  /** element id used by Vaul/Radix for the accessible title */
  titleAs?: React.ElementType;
};

type Feedback = { id: number; text: string; price: string };

function describeImpact(price: number, protein: number, kcal: number): Feedback | null {
  const p = Math.round(protein);
  const k = Math.round(kcal);
  const text =
    Math.abs(p) >= 3 ? `${p > 0 ? "+" : ""}${p} g protein` : Math.abs(k) >= 5 ? `${k > 0 ? "+" : ""}${k} kcal` : "";
  const priceText = formatTHBDelta(price);
  if (!text && !priceText) return null;
  return { id: Date.now(), text, price: priceText };
}

export function ProductConfigurator({ item, layout, edit, onClose, onDone, titleAs: Title = "h2" }: Props) {
  const groups = useMemo(() => itemGroups(item), [item]);
  const [selections, setSelections] = useState<Selections>(() => edit?.selections ?? defaultSelections(item));
  const [qty, setQty] = useState(edit?.qty ?? 1);
  const [note, setNote] = useState(edit?.note ?? "");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ctaRef = useRef<HTMLButtonElement>(null);

  const add = useCart((s) => s.add);
  const replace = useCart((s) => s.replace);
  const launch = useFly((s) => s.launch);

  const macros = useMemo(() => itemMacros(item, selections), [item, selections]);
  const unitPrice = useMemo(() => itemPrice(item, selections), [item, selections]);
  const ingredients = useMemo(() => ingredientNames(item, selections), [item, selections]);
  const allergens = useMemo(() => allergensFor(item, selections), [item, selections]);

  const onToggle = useCallback(
    (groupId: string, optionId: string) => {
      const impact = optionImpact(item, selections, groupId, optionId);
      if (impact.selections === selections) return;
      setSelections(impact.selections);
      haptic(8);
      const fb = describeImpact(impact.price, impact.macros.protein, impact.macros.kcal);
      clearTimeout(feedbackTimer.current);
      setFeedback(fb);
      feedbackTimer.current = setTimeout(() => setFeedback(null), 1600);
    },
    [item, selections],
  );

  const submit = () => {
    const input = { itemId: item.id, selections, qty, note };
    if (edit) {
      replace(edit.lineId, input);
      haptic(18);
      onDone?.();
    } else {
      add(input);
      if (ctaRef.current) launch(ctaRef.current.getBoundingClientRect(), item.tint);
      haptic(18);
      setAddedFeedback(true);
      // Show feedback then close after animation completes
      setTimeout(() => onDone?.(), 2200);
    }
  };

  const isModal = layout === "modal";

  const header = (
    <div className={cn("relative", isModal ? "h-full" : "")}>
      <DrinkArt
        item={item}
        hero
        priority
        sizes={isModal ? "420px" : "100vw"}
        className={cn(
          isModal ? "h-full" : layout === "page" ? "aspect-[4/3] rounded-3xl md:aspect-square" : "h-[220px]",
        )}
      />
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md hover:bg-black/75"
        >
          <X className="size-5" />
        </button>
      ) : null}
    </div>
  );

  const intro = (
    <div>
      <Title className="text-statement text-[44px] md:text-[52px]">{item.name}</Title>
      {item.description ? <p className="mt-2 text-[15px] text-text-secondary">{item.description}</p> : null}
      {item.tags?.length || item.badges?.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Highlights">
          {item.badges?.map((b) => (
            <li key={b}>
              <Tag variant="bestseller">{b}</Tag>
            </li>
          ))}
          {item.tags?.map((t) => (
            <li key={t}>
              <Tag variant={TAG_VARIANT_MAP[t as keyof typeof TAG_VARIANT_MAP]}>{TAG_LABEL[t as keyof typeof TAG_LABEL]}</Tag>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  const details = (
    <>
      <section aria-label="Ingredients" className="text-sm">
        <h3 className="text-[17px] font-semibold">What&apos;s in it</h3>
        <p className="mt-1.5 text-text-secondary">{ingredients.join(", ")}</p>
        {allergens.length ? (
          <p className="mt-1.5 text-text-tertiary">
            Contains {allergens.map((a) => ALLERGEN_LABEL[a].toLowerCase()).join(", ")}.
          </p>
        ) : null}
      </section>
    </>
  );

  const nutritionCompact = (
    <section className="space-y-2 rounded-2xl bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-secondary">Nutrition</span>
        <span className="text-2xl font-bold tabular">{Math.round(macros.kcal)}</span>
      </div>
      <div className="text-xs">
        <div className="flex justify-between">
          <span className="text-text-tertiary">Protein</span>
          <span className="tabular font-medium text-red">{Math.round(macros.protein)}g</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-text-tertiary">Carbs</span>
          <span className="tabular font-medium text-white">{Math.round(macros.carbs)}g</span>
        </div>
      </div>
    </section>
  );

  const options = (
    <>
      {groups.map((g) => (
        <OptionGroupView key={g.id} item={item} group={g} selections={selections} onToggle={onToggle} />
      ))}
      <section>
        <label htmlFor={`note-${item.id}`} className="mb-3 block text-[17px] font-semibold">
          Note for the bar
        </label>
        <Textarea
          id={`note-${item.id}`}
          value={note}
          maxLength={140}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Less ice, extra thick, in a takeaway cup"
          rows={2}
        />
      </section>
    </>
  );

  const footer = (
    <div
      className={cn(
        "relative z-10 border-t border-hairline bg-surface-1/95 px-4 pt-3 backdrop-blur-xl md:px-6",
        layout === "page" ? "pb-safe sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] md:bottom-0" : "pb-safe",
      )}
    >
      <AnimatePresence>
        {feedback ? (
          <motion.div
            key={feedback.id}
            role="status"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute -top-12 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-white px-4 py-2 text-sm font-semibold whitespace-nowrap text-black shadow-[0_8px_30px_rgb(0_0_0/0.5)]"
          >
            {feedback.text ? <span>{feedback.text}</span> : null}
            {feedback.text && feedback.price ? <span aria-hidden className="h-3.5 w-px bg-black/20" /> : null}
            {feedback.price ? <span className="tabular">{feedback.price}</span> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex items-center gap-3 pb-3">
        <div className="flex h-14 shrink-0 items-center rounded-full bg-surface-3" role="group" aria-label="Quantity">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
            className="tap grid size-12 place-items-center rounded-full disabled:opacity-30"
          >
            <Minus className="size-4" />
          </button>
          <span className="tabular w-5 text-center text-base font-semibold" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            aria-label="Increase quantity"
            className="tap grid size-12 place-items-center rounded-full"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <button
          ref={ctaRef}
          type="button"
          onClick={submit}
          className="tap flex h-14 min-w-0 flex-1 items-center justify-between gap-3 rounded-full bg-red pr-5 pl-6 text-white hover:bg-red-hover active:bg-red-press"
        >
          <span className="truncate text-base font-semibold">{edit ? "Update order" : "Add to order"}</span>
          <span className="flex flex-col items-end leading-tight">
            <AnimatedNumber value={unitPrice * qty} format={formatTHB} className="tabular text-base font-bold" />
            <span className="tabular text-xs font-medium text-white/80">
              <AnimatedNumber value={macros.kcal} /> kcal{qty > 1 ? " each" : ""}
            </span>
          </span>
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <>
        <div className="grid h-[min(88dvh,820px)] w-[min(92vw,1000px)] grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="relative overflow-y-auto border-r border-hairline">
            <div className="h-[300px]">{header}</div>
            <div className="space-y-6 p-6">
              {intro}
              {details}
            </div>
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="flex-1 space-y-7 overflow-y-auto p-6">
              {options}
              {nutritionCompact}
            </div>
            {footer}
          </div>
        </div>
        <AddToCartFeedback
          itemName={item.name}
          isVisible={addedFeedback}
          onDismiss={() => setAddedFeedback(false)}
        />
      </>
    );
  }

  if (layout === "page") {
    return (
      <>
        <div className="mx-auto max-w-6xl md:grid md:grid-cols-2 md:gap-10 md:px-8 md:py-10">
          <div className="space-y-6 px-4 pt-4 md:sticky md:top-24 md:self-start md:px-0 md:pt-0">
            {header}
            {intro}
            {details}
          </div>
          <div className="flex flex-col">
            <div className="space-y-7 px-4 pt-6 pb-8 md:px-0 md:pt-0">
              {options}
              {nutritionCompact}
            </div>
            {footer}
          </div>
        </div>
        <AddToCartFeedback
          itemName={item.name}
          isVisible={addedFeedback}
          onDismiss={() => setAddedFeedback(false)}
        />
      </>
    );
  }

  // sheet
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4">
            <div className="overflow-hidden rounded-3xl">{header}</div>
          </div>
          <div className="space-y-7 px-4 pt-5 pb-8">
            {intro}
            {details}
            {options}
            {nutritionCompact}
          </div>
        </div>
        {footer}
      </div>
      <AddToCartFeedback
        itemName={item.name}
        isVisible={addedFeedback}
        onDismiss={() => setAddedFeedback(false)}
      />
    </>
  );
}
