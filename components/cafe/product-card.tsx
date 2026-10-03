"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { MenuItem } from "@/content/types";
import { DrinkArt } from "@/components/cafe/drink-art";
import { ItemTag } from "@/components/ui/tag";
import { useCart } from "@/lib/cart-store";
import { haptic, useFly } from "@/lib/fly-store";
import { formatTHB } from "@/lib/format";
import { ingredientNames, itemDefaults, itemGroups, roundMacros } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export function ProductCard({ item, priority }: { item: MenuItem; priority?: boolean }) {
  const add = useCart((s) => s.add);
  const launch = useFly((s) => s.launch);
  const notify = useFly((s) => s.notify);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1100);
    return () => clearTimeout(t);
  }, [added]);
  const { selections, macros } = itemDefaults(item);
  const m = roundMacros(macros);
  const ingredients = ingredientNames(item, selections);
  const addons = itemGroups(item)
    .filter((g) => g.type === "multi")
    .flatMap((g) => g.options.map((o) => o.label));

  const quickAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    add({ itemId: item.id, selections, qty: 1 });
    launch(e.currentTarget.getBoundingClientRect(), item.tint);
    notify(`${item.name} added`);
    setAdded(true);
    haptic(14);
  };

  return (
    <article className="group relative flex flex-col">
      <Link
        href={`/cafe/${item.slug}`}
        scroll={false}
        className="tap flex flex-1 flex-col rounded-3xl focus-visible:outline-offset-4"
        aria-label={`${item.name}, ${item.priceIsFrom ? "from " : ""}${formatTHB(item.basePrice)}, ${m.kcal} kcal, ${m.protein} grams protein`}
      >
        <DrinkArt
          item={item}
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          className="aspect-square rounded-3xl transition-transform duration-300 ease-[var(--ease-out)] group-hover:scale-[1.015]"
        />
        <div className="flex flex-1 flex-col px-1 pt-3">
          <h3 className="font-display text-[22px] uppercase md:text-2xl">{item.name}</h3>
          {item.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.slice(0, 2).map((t) => (
                <ItemTag key={t} tag={t} />
              ))}
            </div>
          ) : null}
          {item.description ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-text-secondary">{item.description}</p>
          ) : null}
          {ingredients.length ? (
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-text-tertiary">
              <span className="sr-only">Ingredients: </span>
              {ingredients.join(" · ")}
            </p>
          ) : null}
          {addons.length ? (
            <p className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-text-secondary">
              <Plus className="size-3 shrink-0" strokeWidth={2.75} aria-hidden />
              <span className="min-w-0 truncate">
                <span className="sr-only">Add-ons: </span>
                {addons.slice(0, 3).join(", ")}
              </span>
              {addons.length > 3 ? <span className="tabular shrink-0 text-text-tertiary">+{addons.length - 3}</span> : null}
            </p>
          ) : null}
          <p className="tabular mt-2 text-xs text-text-tertiary">
            {m.kcal} kcal
            <span aria-hidden className="mx-1.5 inline-block h-2.5 w-px translate-y-px bg-white/20" />
            <span className={m.protein >= 20 ? "font-semibold text-red-text" : undefined}>{m.protein} g protein</span>
          </p>
          <p className="tabular mt-auto pt-2 text-[15px] font-semibold">
            {item.priceIsFrom ? <span className="mr-1 text-xs font-normal text-text-tertiary">from</span> : null}
            {formatTHB(item.basePrice)}
          </p>
        </div>
      </Link>
      {/* overlay matching the square image, so the button sits on its corner */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
        <button
          type="button"
          onClick={quickAdd}
          aria-label={`Quick add ${item.name}`}
          className={cn(
            "tap pointer-events-auto absolute right-2 bottom-2 grid size-12 place-items-center rounded-full backdrop-blur-xl backdrop-saturate-150",
            added
              ? "bg-white text-black shadow-[0_0_24px_rgb(255_255_255/0.45)]"
              : "bg-black/35 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),inset_0_0_0_1px_rgb(255_255_255/0.2)] hover:bg-black/50",
          )}
        >
          {added ? <Check className="size-5" strokeWidth={3} /> : <Plus className="size-6" strokeWidth={2.25} />}
        </button>
      </div>
    </article>
  );
}
