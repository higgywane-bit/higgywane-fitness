"use client";

import { Check, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { MenuItem, Option, OptionGroup, Selections } from "@/content/types";
import { formatTHBDelta } from "@/lib/format";
import { optionImpact } from "@/lib/nutrition";
import { SelectGlow } from "@/components/motion/select-glow";
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

const POP = { type: "spring", stiffness: 560, damping: 28 } as const;

function Indicator({ on, className }: { on: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-[background-color,box-shadow] duration-200",
        on ? "bg-white text-black shadow-[0_0_14px_rgb(255_255_255/0.45)]" : "shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.28)]",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {on ? (
          <motion.span
            key="check"
            initial={reduce ? false : { scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={reduce ? undefined : { scale: 0, transition: { duration: 0.1 } }}
            transition={POP}
          >
            <Check className="size-3" strokeWidth={3.5} />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

function SingleGroup({ item, group, selections, onToggle }: Props) {
  const current = selections[group.id]?.[0];
  const cols = group.options.length === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div role="radiogroup" aria-labelledby={`grp-${group.id}`} className={cn("grid gap-2", cols)}>
      {group.options.map((o) => {
        const on = current === o.id;
        const price = formatTHBDelta(o.priceDelta);
        const impact = on ? null : impactLabel(item, selections, group, o);
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onToggle(group.id, o.id)}
            className={cn(
              "tap relative isolate flex min-h-[64px] flex-col justify-center overflow-hidden rounded-2xl px-3.5 py-2.5 text-left",
              on ? "glass-lit" : "glass hover:bg-white/[0.08]",
            )}
          >
            <SelectGlow on={on} />
            <span className="flex items-start justify-between gap-2">
              <span className="text-[15px] leading-tight font-semibold">{o.label}</span>
              <Indicator on={on} className="mt-px size-[18px]" />
            </span>
            <span className={cn("mt-1 text-xs leading-tight", on ? "text-white/75" : "text-text-tertiary")}>
              {[o.detail, price].filter(Boolean).join(" · ") || impact || "\u00a0"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MultiGroup({ item, group, selections, onToggle }: Props) {
  const current = selections[group.id] ?? [];
  const full = group.max !== undefined && current.length >= group.max;
  return (
    <ul aria-labelledby={`grp-${group.id}`} className="glass overflow-hidden rounded-2xl">
      {group.options.map((o, i) => {
        const on = current.includes(o.id);
        const disabled = !on && full;
        const impact = impactLabel(item, selections, group, o);
        return (
          <li key={o.id} className={cn(i > 0 && "border-t border-hairline")}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-disabled={disabled}
              onClick={() => !disabled && onToggle(group.id, o.id)}
              className={cn(
                "tap relative isolate flex min-h-[60px] w-full items-center gap-3 overflow-hidden px-4 py-2.5 text-left",
                disabled && "cursor-not-allowed opacity-40",
                on ? "bg-white/[0.09]" : !disabled && "hover:bg-white/[0.05]",
              )}
            >
              <SelectGlow on={on} />
              <Indicator on={on} className="size-6" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{o.label}</span>
                {o.detail ? <span className="block text-xs text-text-tertiary">{o.detail}</span> : null}
              </span>
              <span className="shrink-0 text-right">
                <span className={cn("tabular block text-[15px] font-semibold", !on && "text-text-secondary")}>
                  {formatTHBDelta(o.priceDelta)}
                </span>
                {impact ? (
                  <span className={cn("tabular block text-xs", impact.includes("protein") ? "text-red-text" : "text-text-tertiary")}>
                    {impact}
                  </span>
                ) : null}
              </span>
            </button>
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
          <button
            key={o.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onToggle(group.id, o.id)}
            className={cn(
              "tap relative isolate flex h-11 items-center gap-2 overflow-hidden rounded-full px-4 text-sm font-medium",
              on ? "glass-lit" : "glass text-text-secondary hover:text-white",
            )}
          >
            <SelectGlow on={on} />
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
            <span className={cn(on && "line-through decoration-white/50")}>{o.label}</span>
          </button>
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
