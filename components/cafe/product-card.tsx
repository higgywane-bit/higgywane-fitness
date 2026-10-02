"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { MenuItem } from "@/content/types";
import { DrinkArt } from "@/components/cafe/drink-art";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { useCart } from "@/lib/cart-store";
import { haptic, useFly } from "@/lib/fly-store";
import { formatTHB } from "@/lib/format";
import { itemDefaults, roundMacros } from "@/lib/nutrition";

const TAG_VARIANT_MAP: Record<string, TagVariant> = {
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

const TAG_LABEL: Record<string, string> = {
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
};

export function ProductCard({ item, priority }: { item: MenuItem; priority?: boolean }) {
  const add = useCart((s) => s.add);
  const launch = useFly((s) => s.launch);
  const { selections, macros } = itemDefaults(item);
  const m = roundMacros(macros);

  const quickAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    add({ itemId: item.id, selections, qty: 1 });
    launch(e.currentTarget.getBoundingClientRect(), item.tint);
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
              {item.tags.slice(0, 1).map((t) => (
                <Tag key={t} variant={TAG_VARIANT_MAP[t] || "default"} className="text-xs">
                  {TAG_LABEL[t]}
                </Tag>
              ))}
            </div>
          ) : null}
          {item.description ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-text-secondary">{item.description}</p>
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
          className="tap pointer-events-auto absolute right-2 bottom-2 grid size-12 place-items-center rounded-full bg-yellow text-black shadow-[0_8px_24px_rgb(251_191_36/0.35)] transition-all duration-200 hover:bg-yellow-hover active:scale-95"
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </button>
      </div>
    </article>
  );
}
