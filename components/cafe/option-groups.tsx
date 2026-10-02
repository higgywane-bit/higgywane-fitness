"use client";

import { Check, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { MenuItem, Option, OptionGroup, Selections } from "@/content/types";
import { formatTHBDelta } from "@/lib/format";
import { optionImpact } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

type Props = {
  item: MenuItem;
  group: OptionGroup;
  selections: Selections;
  onToggle: (groupId: string, optionId: string) => void;
};

function impactLabel(item: MenuItem, selections: Selections, group: OptionGroup, option: Option) {
  const { macros } = optionImpact(item, selections, group.id, option.id);
  const selected = (selections[group.id] ?? []).includes(option.id);
  // For a selected multi option, describe what it adds (the inverse of removing it).
  const sign = selected && group.type !== "single" ? -1 : 1;
  const protein = Math.round(macros.protein * sign);
  const kcal = Math.round(macros.kcal * sign);
  if (Math.abs(protein) >= 3) return `${protein > 0 ? "+" : ""}${protein} g protein`;
  if (Math.abs(kcal) >= 5) return `${kcal > 0 ? "+" : ""}${kcal} kcal`;
  return option.ingredientId === "creatine" ? "0 kcal" : null;
}

function GroupHeader({ group, count }: { group: OptionGroup; count: number }) {
  let hint: string | null = null;
  if (group.type === "single" && group.required) hint = "Required";
  else if (group.type === "multi" && group.max) hint = `${count} of ${group.max}`;
  else if (group.type === "remove") hint = "Optional";
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 id={`grp-${group.id}`} className="text-[17px] font-semibold">
        {group.title}
      </h3>
      {hint ? <span className="tabular text-sm text-text-tertiary">{hint}</span> : null}
    </div>
  );
}

const POP = { type: "spring", stiffness: 500, damping: 26 } as const;

function SingleGroup({ item, group, selections, onToggle }: Props) {
  const reduce = useReducedMotion();
  const current = selections[group.id]?.[0];
  const cols = group.options.length === 2 ? "grid-cols-2" : group.options.length === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div role="radiogroup" aria-labelledby={`grp-${group.id}`} className={cn("grid gap-2", cols)}>
      {group.options.map((o) => {
        const on = current === o.id;
        const price = formatTHBDelta(o.priceDelta);
        const impact = on ? null : impactLabel(item, selections, group, o);
        return (
          <motion.button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onToggle(group.id, o.id)}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            className={cn(
              "tap relative flex min-h-[60px] flex-col items-start justify-center rounded-2xl border px-3.5 py-2.5 text-left transition-colors duration-200",
              on ? "border-white bg-white text-black" : "border-hairline-strong bg-surface-2 hover:border-white/30",
            )}
          >
            <span className="text-[15px] leading-tight font-semibold">{o.label}</span>
            <span className={cn("mt-0.5 text-xs leading-tight", on ? "text-black/60" : "text-text-tertiary")}>
              {[o.detail, price].filter(Boolean).join("  ") || impact || " "}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function MultiGroup({ item, group, selections, onToggle }: Props) {
  const reduce = useReducedMotion();
  const current = selections[group.id] ?? [];
  const full = group.max !== undefined && current.length >= group.max;
  return (
    <ul aria-labelledby={`grp-${group.id}`} className="overflow-hidden rounded-2xl bg-surface-2">
      {group.options.map((o, i) => {
        const on = current.includes(o.id);
        const disabled = !on && full;
        const impact = impactLabel(item, selections, group, o);
        return (
          <li key={o.id} className={cn(i > 0 && "border-t border-hairline")}>
            <motion.button
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-disabled={disabled}
              onClick={() => !disabled && onToggle(group.id, o.id)}
              whileTap={reduce || disabled ? undefined : { scale: 0.98 }}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-200",
                disabled ? "cursor-not-allowed opacity-40" : "hover:bg-surface-3",
                on && "bg-red-tint hover:bg-red-tint",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-200",
                  on ? "border-red bg-red text-white" : "border-hairline-strong",
                )}
              >
                <AnimatePresence initial={false}>
                  {on ? (
                    <motion.span
                      key="check"
                      initial={reduce ? false : { scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={reduce ? undefined : { scale: 0, transition: { duration: 0.12 } }}
                      transition={POP}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{o.label}</span>
                {o.detail ? <span className="block text-xs text-text-tertiary">{o.detail}</span> : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="tabular block text-[15px] font-semibold">{formatTHBDelta(o.priceDelta)}</span>
                {impact ? (
                  <span className={cn("tabular block text-xs", impact.includes("protein") ? "text-red-text" : "text-text-tertiary")}>
                    {impact}
                  </span>
                ) : null}
              </span>
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}

function RemoveGroup({ group, selections, onToggle }: Props) {
  const reduce = useReducedMotion();
  const current = selections[group.id] ?? [];
  return (
    <div aria-labelledby={`grp-${group.id}`} className="flex flex-wrap gap-2">
      {group.options.map((o) => {
        const on = current.includes(o.id);
        return (
          <motion.button
            key={o.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onToggle(group.id, o.id)}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            className={cn(
              "tap flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-200",
              on ? "border-white bg-white text-black" : "border-hairline-strong text-text-secondary hover:text-white",
            )}
          >
            {on ? (
              <motion.span
                aria-hidden
                initial={reduce ? false : { scale: 0, rotate: 90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={POP}
              >
                <X className="size-4" strokeWidth={2.5} />
              </motion.span>
            ) : null}
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

export function OptionGroupView(props: Props) {
  const { group, selections } = props;
  return (
    <section className="scroll-mt-4">
      <GroupHeader group={group} count={(selections[group.id] ?? []).length} />
      {group.type === "single" ? (
        <SingleGroup {...props} />
      ) : group.type === "multi" ? (
        <MultiGroup {...props} />
      ) : (
        <RemoveGroup {...props} />
      )}
    </section>
  );
}
