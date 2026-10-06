"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Drawer as Vaul } from "vaul";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/utils";
import { btn } from "./ui";

/* ── stepper: − value + ──────────────────────────────────── */

export function Stepper({
  value,
  onStep,
  label,
  format = String,
  min,
  max,
  className,
  size = "md",
}: {
  value: number;
  onStep: (dir: -1 | 1) => void;
  label: string;
  format?: (n: number) => string;
  min?: number;
  max?: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-9" : "h-11";
  return (
    <div className={cn("inline-flex items-center rounded-full bg-s1-surface-3", h, className)} role="group" aria-label={label}>
      <button type="button" aria-label={`Less ${label}`} disabled={min !== undefined && value <= min} onClick={() => onStep(-1)} className={cn("tap grid aspect-square place-items-center rounded-full text-white disabled:opacity-30", h)}>
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      <output aria-live="polite" className="num min-w-12 px-1 text-center text-[16px] font-semibold">
        {format(value)}
      </output>
      <button type="button" aria-label={`More ${label}`} disabled={max !== undefined && value >= max} onClick={() => onStep(1)} className={cn("tap grid aspect-square place-items-center rounded-full text-white disabled:opacity-30", h)}>
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/* ── switch ──────────────────────────────────────────────── */

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40", checked ? "bg-s1-green" : "bg-s1-surface-4")}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-[27px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform duration-200", checked && "translate-x-5")} />
    </button>
  );
}

/* ── segmented control ───────────────────────────────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex rounded-[12px] bg-s1-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "tap flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[14px] font-semibold transition-colors",
            value === o.value ? "bg-s1-surface-4 text-white shadow-[0_1px_3px_rgba(0,0,0,0.5)]" : "text-s1-muted hover:text-white",
          )}
        >
          <span className="truncate">{o.label}</span>
          {o.count !== undefined ? <span className="num text-[12px] opacity-70">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ── bottom sheet ────────────────────────────────────────── */

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  left,
  right,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** header buttons, e.g. Cancel / Done */
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <Vaul.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Vaul.Portal>
        <Vaul.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Vaul.Content
          className={cn(
            "s1 fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-s1-surface-1 shadow-[0_30px_80px_rgba(0,0,0,0.6)] outline-none md:bottom-6 md:rounded-[28px]",
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-white/20 md:hidden" />
          <div className="grid grid-cols-[minmax(72px,1fr)_auto_minmax(72px,1fr)] items-center px-3 pt-2 pb-1">
            <div className="flex">{left}</div>
            <Vaul.Title className="truncate text-center text-[17px] font-semibold">{title}</Vaul.Title>
            <div className="flex justify-end">
              {right ?? (
                <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="tap grid size-9 place-items-center rounded-full bg-s1-surface-3 text-s1-muted hover:text-white">
                  <X className="size-4.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
          {description ? <Vaul.Description className="px-5 pb-2 text-center text-[14px] text-s1-muted">{description}</Vaul.Description> : <Vaul.Description className="sr-only">{title}</Vaul.Description>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">{children}</div>
          {footer ? <div className="border-t border-s1-hairline px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div> : <div className="pb-[env(safe-area-inset-bottom)]" />}
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}

/* ── collapsible row ("drop-down") ───────────────────────── */

export function Collapsible({
  open,
  onToggle,
  header,
  children,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  header: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div className={cn("transition-colors", open && "bg-white/[0.025]", className)}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="tap flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">{header}</div>
        <ChevronDown className={cn("size-5 shrink-0 text-s1-faint transition-transform duration-200", open && "rotate-180 text-white")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={id}
            key="body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ── toasts ("Saved. Pete's app is updated") ─────────────── */

type Toast = { id: number; title: string; body?: string; tone: "good" | "bad" | "info" };
type ToastState = { toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void };

let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
    setTimeout(() => get().dismiss(id), t.tone === "bad" ? 6000 : 4200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export const toast = {
  good: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: "good" }),
  bad: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: "bad" }),
  info: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: "info" }),
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  const reduce = useReducedMotion();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            role={t.tone === "bad" ? "alert" : "status"}
            className="s1 pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-s1-surface-2/95 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl"
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                t.tone === "good" && "bg-s1-green text-black",
                t.tone === "bad" && "bg-s1-red text-black",
                t.tone === "info" && "bg-s1-blue text-black",
              )}
              aria-hidden
            >
              {t.tone === "bad" ? <X className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-[13px] leading-[18px] text-s1-muted">{t.body}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 grid size-7 place-items-center rounded-full text-s1-faint hover:text-white">
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ── save bar: unsaved changes → Save and send ───────────── */

export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  label,
  className,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  label: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {dirty ? (
        <motion.div
          initial={reduce ? { opacity: 0 } : { y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className={cn("fixed inset-x-0 bottom-[calc(var(--s1-tabbar,0px)+12px)] z-40 flex justify-center px-3 lg:bottom-6 lg:left-[248px]", className)}
        >
          <div className="s1-glass flex w-full max-w-xl items-center gap-2 rounded-full py-2 pr-2 pl-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
            <span className="flex min-w-0 flex-1 items-center gap-2 text-[14px] font-medium text-s1-muted">
              <span className="size-2 shrink-0 rounded-full bg-s1-yellow" aria-hidden />
              <span className="truncate">Unsaved changes</span>
            </span>
            <button type="button" onClick={onDiscard} disabled={saving} className={btn({ variant: "plain", size: "sm", className: "text-s1-muted" })}>
              Discard
            </button>
            <button type="button" onClick={onSave} disabled={saving} className={btn({ variant: "primary", size: "md", className: "rounded-full" })}>
              {saving ? "Saving…" : label}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Warn before leaving a page with unsaved edits. */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
}

/** Field with a label above it. */
export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="px-1 text-[13px] font-semibold text-s1-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="px-1 text-[13px] text-s1-faint">{hint}</p> : null}
    </div>
  );
}

export const inputCls =
  "h-12 w-full rounded-xl bg-s1-surface-2 px-4 text-[16px] text-white placeholder:text-s1-faint outline-none ring-1 ring-s1-hairline transition focus:ring-2 focus:ring-s1-blue/60";

/** Copies text and briefly shows "Copied". */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        toast.bad("Couldn't copy", "Press and hold the link to copy it.");
      }
    },
  };
}
