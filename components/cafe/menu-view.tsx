"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CategoryId } from "@/content/types";
import { ProductCard } from "@/components/cafe/product-card";
import { StarMark } from "@/components/brand/logo";
import { findIngredient, menuCategories, menuItems } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4";

function matches(q: string) {
  const needle = q.trim().toLowerCase();
  return menuItems().filter(
    (m) =>
      m.name.toLowerCase().includes(needle) ||
      m.description?.toLowerCase().includes(needle) ||
      m.recipe.some((r) => findIngredient(r.ingredientId)?.name.toLowerCase().includes(needle)),
  );
}

export function MenuView() {
  const categories = menuCategories().filter((c) => menuItems().some((m) => m.category === c.id));
  const [active, setActive] = useState<CategoryId>(categories[0]?.id ?? "smoothies");
  const [query, setQuery] = useState("");
  const chipRefs = useRef<Partial<Record<CategoryId, HTMLButtonElement | null>>>({});
  const stickyRef = useRef<HTMLDivElement>(null);
  const clickLock = useRef(0);

  const searching = query.trim().length > 0;
  const catKey = categories.map((c) => c.id).join(",");
  const results = useMemo(() => (searching ? matches(query) : []), [query, searching]);

  // Scroll-spy: the section nearest the top of the viewport (below the sticky bar) is active.
  useEffect(() => {
    if (searching) return;
    const sections = catKey
      .split(",")
      .map((id) => document.getElementById(`cat-${id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        if (Date.now() < clickLock.current) return;
        const first = sections.find((s) => visible.get(s.id));
        if (first) setActive(first.id.replace("cat-", "") as CategoryId);
      },
      { rootMargin: "-160px 0px -55% 0px", threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [searching, catKey]);

  // Keep the active chip in view. Scroll only the chip row: scrollIntoView would also
  // move the window and cancel the smooth scroll started by a chip tap.
  useEffect(() => {
    const chip = chipRefs.current[active];
    const row = chip?.closest("ul");
    if (!chip || !row) return;
    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  const jump = (id: CategoryId) => {
    setQuery("");
    setActive(id);
    clickLock.current = Date.now() + 900;
    requestAnimationFrame(() => {
      const el = document.getElementById(`cat-${id}`);
      if (!el) return;
      // Where the bar sits once stuck (its CSS top + height), not where it is right now.
      const bar = stickyRef.current;
      const offset = bar ? parseFloat(getComputedStyle(bar).top) + bar.offsetHeight : 160;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    });
  };

  return (
    <div>
      <header className="mx-auto max-w-7xl px-4 pt-6 pb-4 md:px-8 md:pt-12 md:pb-6">
        <h1 className="text-statement text-[64px] md:text-[104px]">Cafe</h1>
        <p className="mt-3 max-w-md text-[15px] text-text-secondary md:text-base">
          Protein smoothies, coffee, food and kit. Every add-on shows its macros before you order.
        </p>
      </header>

      <div
        ref={stickyRef}
        className="sticky top-[calc(var(--header-h)+env(safe-area-inset-top))] z-30 border-b border-hairline bg-black/85 backdrop-blur-xl backdrop-saturate-150 md:top-16"
      >
        <div className="mx-auto max-w-7xl px-4 pt-2 md:flex md:items-center md:gap-4 md:px-8 md:py-3">
          <div className="relative md:w-[22rem] md:shrink-0">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-tertiary" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drinks or ingredients"
              aria-label="Search the menu"
              className="glass h-11 w-full rounded-full pr-11 pl-11 text-base outline-none placeholder:text-text-tertiary focus-visible:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.6)] [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="tap absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center text-text-secondary"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <nav aria-label="Menu categories" className="-mx-4 md:mx-0 md:min-w-0 md:flex-1">
            <ul className="no-scrollbar relative flex gap-2 overflow-x-auto px-4 py-2.5 md:px-0 md:py-0">
              {categories.map((c) => {
                const on = !searching && active === c.id;
                return (
                  <li key={c.id}>
                    <button
                      ref={(el) => {
                        chipRefs.current[c.id] = el;
                      }}
                      type="button"
                      onClick={() => jump(c.id)}
                      aria-current={on ? "true" : undefined}
                      className={cn(
                        "tap h-11 rounded-full px-5 text-[15px] font-semibold whitespace-nowrap",
                        on ? "bg-white text-black" : "glass text-text-secondary hover:text-white",
                      )}
                    >
                      {c.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
        {searching ? (
          <section aria-live="polite" className="pt-6">
            <h2 className="text-sm text-text-secondary">
              {results.length} {results.length === 1 ? "result" : "results"} for &ldquo;{query.trim()}&rdquo;
            </h2>
            {results.length ? (
              <div className={cn(GRID, "mt-5")}>
                {results.map((m) => (
                  <ProductCard key={m.id} item={m} />
                ))}
              </div>
            ) : (
              <div className="mt-10 flex flex-col items-center text-center">
                <p className="text-lg font-semibold">Nothing matches that yet</p>
                <p className="mt-1 text-sm text-text-secondary">Try a flavour like banana, or an ingredient like oats.</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="tap mt-5 h-11 rounded-full bg-surface-3 px-5 text-sm font-semibold"
                >
                  Show the full menu
                </button>
              </div>
            )}
          </section>
        ) : (
          categories.map((c, ci) => {
            const items = menuItems().filter((m) => m.category === c.id);
            return (
              <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`h-${c.id}`} className="pt-8 md:pt-12">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <h2 id={`h-${c.id}`} className="font-display text-[34px] uppercase md:text-[44px]">
                      {c.title}
                    </h2>
                    <p className="mt-1 text-sm text-text-secondary">{c.blurb}</p>
                  </div>
                  {items.length ? (
                    <span className="tabular shrink-0 pb-1 text-sm whitespace-nowrap text-text-tertiary">{items.length} {items.length === 1 ? "item" : "items"}</span>
                  ) : null}
                </div>
                {items.length ? (
                  <div className={GRID}>
                    {items.map((m, i) => (
                      <ProductCard key={m.id} item={m} priority={ci === 0 && i < 4} />
                    ))}
                  </div>
                ) : (
                  <ComingSoon />
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function ComingSoon() {
  return (
    <div className="relative flex min-h-56 flex-col justify-end overflow-hidden rounded-3xl border border-dashed border-hairline-strong bg-surface-1 p-6 md:min-h-64 md:p-8">
      <StarMark className="absolute -top-6 -right-6 size-48 text-white/[0.04] md:size-64" background="var(--surface-1)" />
      <p className="text-statement text-[40px] md:text-[56px]">Coming soon</p>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        Pre-workout, recovery shots and supplements are on the way. Ask at the bar for what&apos;s in stock today.
      </p>
    </div>
  );
}
