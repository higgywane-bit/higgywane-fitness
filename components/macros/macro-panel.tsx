"use client";

import { motion } from "motion/react";
import type { Macros } from "@/content/types";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { macroSplit } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const MACRO_META = [
  { key: "protein", label: "Protein", swatch: "bg-protein" },
  { key: "carbs", label: "Carbs", swatch: "bg-carbs" },
  { key: "fat", label: "Fat", swatch: "bg-fat" },
] as const;

/** Energy split bar: protein / carbs / fat as share of calories. */
export function MacroBar({ macros, className }: { macros: Macros; className?: string }) {
  const split = macroSplit(macros);
  return (
    <div
      className={cn("flex h-2 w-full gap-[3px] overflow-hidden rounded-full", className)}
      role="img"
      aria-label={`Energy from protein ${split.protein}%, carbs ${split.carbs}%, fat ${split.fat}%`}
    >
      {MACRO_META.map((m) => (
        <motion.span
          key={m.key}
          className={cn("h-full rounded-full", m.swatch)}
          initial={false}
          animate={{ flexGrow: Math.max(split[m.key], 0.0001) }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          style={{ flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

/** Live macro panel for the product sheet. */
export function MacroPanel({ macros, className }: { macros: Macros; className?: string }) {
  const split = macroSplit(macros);
  return (
    <section aria-label="Nutrition" className={cn("rounded-3xl bg-surface-2 p-5", className)}>
      <div className="flex items-end justify-between gap-4">
        <p className="flex items-baseline gap-1.5">
          <AnimatedNumber value={macros.kcal} className="font-display tabular text-[56px] leading-none" />
          <span className="text-sm font-medium text-text-secondary">kcal</span>
        </p>
        <p className="pb-1 text-right">
          <AnimatedNumber value={macros.protein} className="font-display tabular text-[32px] leading-none text-red-text" />
          <span className="ml-1 text-sm font-medium text-text-secondary">g protein</span>
        </p>
      </div>

      <MacroBar macros={macros} className="mt-4" />

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {MACRO_META.map((m) => (
          <div key={m.key}>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <span aria-hidden className={cn("size-2 rounded-full", m.swatch)} />
              {m.label}
            </dt>
            <dd className="mt-1 flex items-baseline gap-1">
              <AnimatedNumber value={macros[m.key]} className="tabular text-lg font-semibold" />
              <span className="text-sm text-text-secondary">g</span>
              <span className="tabular ml-auto text-xs text-text-tertiary">{split[m.key]}%</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex gap-5 border-t border-hairline pt-3 text-sm text-text-secondary">
        <p>
          Sugar <AnimatedNumber value={macros.sugar ?? 0} className="tabular font-semibold text-white" /> g
        </p>
        <p>
          Fibre <AnimatedNumber value={macros.fibre ?? 0} className="tabular font-semibold text-white" /> g
        </p>
      </div>
    </section>
  );
}

/** Donut of energy split with kcal in the middle (cart). */
export function MacroRing({ macros, size = 132 }: { macros: Macros; size?: number }) {
  const split = macroSplit(macros);
  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = split.protein && split.carbs && split.fat ? 1.6 : 0;
  let offset = 0;
  const segs = MACRO_META.map((m) => {
    const len = (split[m.key] / 100) * c;
    const seg = { key: m.key, len: Math.max(0, len - gap), offset };
    offset += len;
    return seg;
  });
  const color = { protein: "var(--macro-protein)", carbs: "var(--macro-carbs)", fat: "var(--macro-fat)" };
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
        {segs.map((s) =>
          s.len > 0 ? (
            <motion.circle
              key={s.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={color[s.key]}
              strokeWidth="9"
              strokeLinecap="butt"
              initial={false}
              animate={{ strokeDasharray: `${s.len} ${c}`, strokeDashoffset: -s.offset }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          ) : null,
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <AnimatedNumber value={macros.kcal} className="font-display tabular text-[34px] leading-none" />
        <span className="mt-0.5 text-xs text-text-secondary">kcal</span>
      </div>
    </div>
  );
}
