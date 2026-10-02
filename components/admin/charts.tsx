"use client";

import { useState } from "react";
import { formatTHB } from "@/lib/format";
import { formatDate } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";

/** Serializable value formats (server components can't pass functions to client ones). */
export type ChartUnit = "visits" | "thb" | "count";

function fmt(unit: ChartUnit, n: number) {
  if (unit === "thb") return formatTHB(n);
  if (unit === "visits") return `${n} visit${n === 1 ? "" : "s"}`;
  return String(n);
}

/*
 * Small, dependency-free charts. One series each (the panel title names it, so no legend),
 * thin bars with rounded data ends on a recessive baseline, and a hover/tap readout.
 */

export function BarChart({
  data,
  unit = "count",
  today,
  labelFormat = "day",
  summary = "total",
  tickEvery = 7,
  highlightLast = true,
  className,
}: {
  data: { date: string; value: number }[];
  unit?: ChartUnit;
  /** gym-local date, so labels drop the year when it's this year */
  today: string;
  /** "month" for monthly series (dates are the 1st of each month) */
  labelFormat?: "day" | "month";
  /** what the top-right figure shows: the sum, or the latest value (for levels like member counts) */
  summary?: "total" | "latest";
  tickEvery?: number;
  highlightLast?: boolean;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const format = (n: number) => fmt(unit, n);
  const label = (d: string) => (labelFormat === "month" ? MONTH.format(new Date(`${d}T00:00:00Z`)) + (d.slice(0, 4) !== today.slice(0, 4) ? ` ${d.slice(2, 4)}` : "") : formatDate(d, today));
  const max = Math.max(1, ...data.map((d) => d.value));
  const shown = hover ?? data.length - 1;
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm text-text-secondary">
          <span className="tabular font-semibold text-white">{format(data[shown]?.value ?? 0)}</span>
          <span className="ml-1.5">{data[shown] ? label(data[shown].date) : ""}</span>
        </p>
        <p className="tabular text-xs text-text-tertiary">
          {summary === "total" ? `${format(total)} total` : `now ${format(data.at(-1)?.value ?? 0)}`}
        </p>
      </div>
      <div
        role="img"
        aria-label={`Bar chart, ${data.length} days, total ${format(total)}`}
        className="relative flex h-36 items-end gap-[2px] border-b border-hairline-strong"
        onPointerLeave={() => setHover(null)}
      >
        {[0.5, 1].map((f) => (
          <span key={f} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-hairline" style={{ bottom: `${f * 100}%` }} />
        ))}
        {data.map((d, i) => {
          const active = i === shown;
          return (
            <button
              key={d.date}
              type="button"
              tabIndex={-1}
              aria-label={`${label(d.date)}: ${format(d.value)}`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              className="group relative flex h-full flex-1 items-end"
            >
              <span
                className={cn(
                  "block w-full rounded-t-[4px] transition-[background-color,height] duration-200",
                  active || (highlightLast && hover === null && i === data.length - 1) ? "bg-red" : "bg-white/25 group-hover:bg-white/45",
                )}
                style={{ height: `${Math.max(d.value ? 3 : 0, (d.value / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      {/* one slot per bar, so each label sits under its own bar */}
      <div className="mt-2 flex gap-[2px] text-[11px] text-text-tertiary" aria-hidden>
        {data.map((d, i) => (
          <span key={d.date} className="relative h-4 flex-1">
            {(data.length - 1 - i) % tickEvery === 0 ? (
              <span className={cn("absolute top-0 whitespace-nowrap", i === data.length - 1 ? "right-0" : i === 0 ? "left-0" : "left-1/2 -translate-x-1/2")}>{label(d.date)}</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Busy hours: one hue, light → dark by visits. */
export function Heatmap({ grid, open }: { grid: number[][]; open: number }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...grid.flat());
  const hours = grid[0]?.length ?? 0;
  const peak = grid.flatMap((row, d) => row.map((v, h) => ({ v, d, h }))).sort((a, b) => b.v - a.v)[0];
  const sel = hover ?? (peak ? { d: peak.d, h: peak.h } : null);
  const hourLabel = (h: number) => `${String(open + h).padStart(2, "0")}:00`;

  return (
    <div className="select-none">
      <p className="mb-3 text-sm text-text-secondary">
        {sel ? (
          <>
            <span className="font-semibold text-white">{DAYS[sel.d]} {hourLabel(sel.h)}</span>
            <span className="ml-1.5">
              {grid[sel.d][sel.h]} visits{hover ? "" : " · busiest"}
            </span>
          </>
        ) : null}
      </p>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `2.25rem repeat(${hours}, minmax(0, 1fr))` }} onPointerLeave={() => setHover(null)}>
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="self-center text-[11px] text-text-tertiary">{DAYS[d]}</span>
            {row.map((v, h) => (
              <span
                key={h}
                onPointerEnter={() => setHover({ d, h })}
                title={`${DAYS[d]} ${hourLabel(h)}: ${v} visits`}
                className={cn("aspect-square rounded-[4px]", sel?.d === d && sel?.h === h && "ring-2 ring-white")}
                style={{ backgroundColor: v ? `rgb(225 29 72 / ${0.12 + (v / max) * 0.88})` : "rgb(255 255 255 / 0.04)" }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: hours }, (_, h) => (
          <span key={h} className="text-center text-[10px] text-text-tertiary">
            {h % 3 === 0 ? open + h : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ranked horizontal bars with the value written out (identity is in the label, not the colour). */
export function BarList({ items, unit = "count" }: { items: { label: string; value: number }[]; unit?: ChartUnit }) {
  const format = (n: number) => fmt(unit, n);
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-sm text-text-tertiary">Nothing yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-text-secondary">{i.label}</span>
            <span className="tabular font-semibold">{format(i.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-white/70" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars with text labels (weekdays, hours). Hover/tap shows the value. */
export function LabeledBars({ items, unit = "count", labelEvery = 1 }: { items: { label: string; value: number }[]; unit?: ChartUnit; labelEvery?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const peak = items.reduce((best, it, i) => (it.value > items[best].value ? i : best), 0);
  const shown = hover ?? peak;
  return (
    <div className="select-none">
      <p className="mb-3 text-sm text-text-secondary">
        <span className="tabular font-semibold text-white">{fmt(unit, items[shown]?.value ?? 0)}</span>
        <span className="ml-1.5">
          {items[shown]?.label}
          {hover === null ? " · busiest" : ""}
        </span>
      </p>
      <div className="flex h-28 items-end gap-[3px] border-b border-hairline-strong" onPointerLeave={() => setHover(null)}>
        {items.map((it, i) => (
          <button
            key={it.label}
            type="button"
            tabIndex={-1}
            aria-label={`${it.label}: ${fmt(unit, it.value)}`}
            onPointerEnter={() => setHover(i)}
            className="group flex h-full flex-1 items-end"
          >
            <span
              className={cn("block w-full rounded-t-[4px]", i === shown ? "bg-red" : "bg-white/25 group-hover:bg-white/45")}
              style={{ height: `${Math.max(it.value ? 3 : 0, (it.value / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px] text-[10px] text-text-tertiary">
        {items.map((it, i) => (
          <span key={it.label} className="flex-1 text-center">
            {i % labelEvery === 0 ? it.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
