"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "motion/react";
import { ArrowDown, ArrowUp, Check, EyeOff, GripVertical, Plus, SlidersHorizontal, X } from "lucide-react";
import { saveDashboardAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import * as D from "@radix-ui/react-dialog";
import {
  DEFAULT_LAYOUT,
  GROUP_LABEL,
  PRESETS,
  WIDGETS,
  widgetMeta,
  type DashboardLayout,
  type LayoutItem,
  type PresetId,
  type WidgetGroup,
  type WidgetSize,
} from "@/lib/dashboard/catalog";
import { cn } from "@/lib/utils";

const SIZE_LABEL: Record<WidgetSize, string> = { 1: "Tile", 2: "Half", 4: "Full" };

export function DashboardCustomizer({ layout }: { layout: DashboardLayout }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LayoutItem[]>(layout.items);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = new Set(items.map((i) => i.id));
  const dirty = JSON.stringify(items) !== JSON.stringify(layout.items);

  function openChange(o: boolean) {
    setOpen(o);
    if (o) setItems(layout.items);
    setError(null);
  }
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function save() {
    start(async () => {
      const res = await saveDashboardAction({ version: 1, items });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <D.Root open={open} onOpenChange={openChange}>
      <D.Trigger asChild>
        <Button variant="outline">
          <SlidersHorizontal className="size-4" aria-hidden />
          Customise
        </Button>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_var(--ease-out)]" />
        <D.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-hairline-strong bg-surface-1 outline-none data-[state=open]:animate-[sheet-in_280ms_var(--ease-out)]">
          <div className="pt-safe flex items-start justify-between gap-3 border-b border-hairline px-5 pt-5 pb-4">
            <div>
              <D.Title className="text-lg font-semibold">Customise dashboard</D.Title>
              <D.Description className="text-sm text-text-secondary">Pick the numbers you want. Saved for every device.</D.Description>
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1 -mr-2">
                <X className="size-5" />
              </Button>
            </D.Close>
          </div>

          <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-[0.14em] text-text-tertiary uppercase">Start from a preset</h3>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PRESETS) as PresetId[]).map((id) => {
                  const p = PRESETS[id];
                  const active = JSON.stringify(p.layout.items) === JSON.stringify(items);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setItems(p.layout.items)}
                      className={cn("tap rounded-2xl p-3 text-left", active ? "glass-lit" : "glass hover:bg-white/[0.07]")}
                      aria-pressed={active}
                    >
                      <span className="flex items-center justify-between text-sm font-semibold">
                        {p.label}
                        {active ? <Check className="size-4" aria-hidden /> : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-secondary">{p.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-[0.14em] text-text-tertiary uppercase">On your dashboard · {items.length}</h3>
              {items.length ? (
                <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-1.5">
                  {items.map((item, i) => (
                    <Row
                      key={item.id}
                      item={item}
                      first={i === 0}
                      last={i === items.length - 1}
                      onMove={(d) => move(i, d)}
                      onSize={(size) => setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, size } : x)))}
                      onRemove={() => setItems((xs) => xs.filter((x) => x.id !== item.id))}
                    />
                  ))}
                </Reorder.Group>
              ) : (
                <p className="text-sm text-text-tertiary">Nothing yet. Add modules below.</p>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-[0.14em] text-text-tertiary uppercase">Add modules</h3>
              {(Object.keys(GROUP_LABEL) as WidgetGroup[]).map((g) => {
                const hidden = WIDGETS.filter((w) => w.group === g && !shown.has(w.id));
                if (!hidden.length) return null;
                return (
                  <div key={g} className="mb-4">
                    <p className="mb-1.5 text-sm font-semibold">{GROUP_LABEL[g]}</p>
                    <ul className="divide-y divide-hairline">
                      {hidden.map((w) => (
                        <li key={w.id} className="flex items-center gap-3 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{w.title}</span>
                            <span className="block text-xs text-text-secondary">
                              {w.description} · {w.source}
                            </span>
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setItems((xs) => [...xs, { id: w.id, size: w.sizes[0] }])}
                            aria-label={`Add ${w.title}`}
                          >
                            <Plus className="size-4" aria-hidden />
                            Add
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {shown.size === WIDGETS.length ? <p className="text-sm text-text-tertiary">Every module is on.</p> : null}
            </section>
          </div>

          <div className="pb-safe flex items-center justify-between gap-3 border-t border-hairline px-5 pt-4 pb-4">
            <Button variant="ghost" onClick={() => setItems(DEFAULT_LAYOUT.items)}>
              Reset
            </Button>
            <div className="flex items-center gap-3">
              {error ? (
                <p role="alert" className="text-sm text-red-text">
                  {error}
                </p>
              ) : null}
              <Button onClick={save} disabled={pending || !dirty}>
                {pending ? "Saving…" : "Save dashboard"}
              </Button>
            </div>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Row({
  item,
  first,
  last,
  onMove,
  onSize,
  onRemove,
}: {
  item: LayoutItem;
  first: boolean;
  last: boolean;
  onMove: (d: -1 | 1) => void;
  onSize: (s: WidgetSize) => void;
  onRemove: () => void;
}) {
  const meta = widgetMeta(item.id)!;
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-1 rounded-2xl bg-surface-2 py-1.5 pr-1.5 pl-1 ring-1 ring-hairline ring-inset"
    >
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onPointerDown={(e) => controls.start(e)}
        className="grid size-9 shrink-0 cursor-grab touch-none place-items-center text-text-tertiary active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{meta.title}</span>
        <span className="block text-[11px] text-text-tertiary">{meta.source}</span>
      </span>
      {meta.sizes.length > 1 ? (
        <span className="mr-1 flex rounded-full bg-black/40 p-0.5" role="group" aria-label={`${meta.title} width`}>
          {meta.sizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSize(s)}
              aria-pressed={item.size === s}
              className={cn("h-7 rounded-full px-2.5 text-xs font-semibold", item.size === s ? "bg-white text-black" : "text-text-secondary")}
            >
              {SIZE_LABEL[s]}
            </button>
          ))}
        </span>
      ) : null}
      <button type="button" onClick={() => onMove(-1)} disabled={first} aria-label={`Move ${meta.title} up`} className="grid size-8 place-items-center rounded-full text-text-secondary hover:bg-surface-3 disabled:opacity-30">
        <ArrowUp className="size-4" />
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={last} aria-label={`Move ${meta.title} down`} className="grid size-8 place-items-center rounded-full text-text-secondary hover:bg-surface-3 disabled:opacity-30">
        <ArrowDown className="size-4" />
      </button>
      <button type="button" onClick={onRemove} aria-label={`Hide ${meta.title}`} className="grid size-8 place-items-center rounded-full text-text-secondary hover:bg-surface-3 hover:text-white">
        <EyeOff className="size-4" />
      </button>
    </Reorder.Item>
  );
}
