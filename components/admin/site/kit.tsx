"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { resetCatalogAction, saveCatalogAction, uploadImageAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import type { Catalog, CatalogSection } from "@/lib/catalog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/* Building blocks for the Site & content editors. */

/** Save one catalog section; returns the cleaned value the server stored. */
export function useSectionSave<S extends CatalogSection>(section: S) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = (value: Catalog[S], after?: (clean: Catalog[S]) => void) => {
    setError(null);
    start(async () => {
      const res = await saveCatalogAction(section, value);
      if (!res.ok) return setError(res.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      after?.(res.data as Catalog[S]);
      router.refresh();
    });
  };
  const reset = (after?: () => void) => {
    setError(null);
    start(async () => {
      const res = await resetCatalogAction(section);
      if (!res.ok) return setError(res.error);
      after?.();
      router.refresh();
    });
  };
  return { save, reset, pending, error, saved, setError };
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint ? <p className="mt-1.5 text-xs text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  multiline,
  className,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) =>
        multiline ? (
          <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} className="min-h-28" />
        ) : (
          <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} autoComplete="off" />
        )
      }
    </Field>
  );
}

/** Number input that keeps what's typed (empty, "1.") and reports numbers. */
export function NumberField({
  label,
  value,
  onChange,
  hint,
  prefix,
  suffix,
  className,
  step,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  hint?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  step?: number;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const last = useRef(value);
  if (last.current !== value && Number(text) !== value) {
    last.current = value;
    setText(value === undefined ? "" : String(value));
  }
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <div className="relative">
          {prefix ? <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-tertiary">{prefix}</span> : null}
          <Input
            id={id}
            inputMode={step && step < 1 ? "decimal" : "numeric"}
            value={text}
            onChange={(e) => {
              const t = e.target.value.replace(/[^\d.-]/g, "");
              setText(t);
              const n = t === "" || t === "-" ? undefined : Number(t);
              last.current = n;
              onChange(n === undefined || Number.isNaN(n) ? undefined : n);
            }}
            className={cn("tabular", prefix && "pl-9", suffix && "pr-14")}
          />
          {suffix ? <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-text-tertiary">{suffix}</span> : null}
        </div>
      )}
    </Field>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="tap flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl text-left"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {description ? <span className="block text-xs text-text-tertiary">{description}</span> : null}
      </span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-success" : "bg-surface-4")}>
        <motion.span
          className="absolute top-1 left-1 size-5 rounded-full bg-white shadow"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 34 }}
        />
      </span>
    </button>
  );
}

/** Multi-select chips. */
export function Chips<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-text-secondary">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
              className={cn(
                "tap inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
                on ? "bg-white text-black" : "bg-surface-2 text-text-secondary ring-1 ring-hairline-strong ring-inset hover:text-white",
              )}
            >
              {on ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function EditorSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-hairline pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold tracking-[0.16em] text-text-tertiary uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Edit panel: right-hand sheet on desktop, bottom sheet on phones. */
export function EditorDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const desktop = useMediaQuery("(min-width: 768px)");
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} direction={desktop ? "right" : "bottom"} repositionInputs={false}>
      <DrawerContent side={desktop ? "right" : "bottom"} className={cn(desktop ? "max-w-[560px]" : "h-[94dvh]")}>
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 pt-4 pb-4 md:pt-6">
          <div className="min-w-0">
            <DrawerTitle className="font-display text-[28px] leading-none uppercase">{title}</DrawerTitle>
            <DrawerDescription className={description ? "mt-1.5 text-sm text-text-secondary" : "sr-only"}>{description ?? title}</DrawerDescription>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="-mt-1 -mr-2 shrink-0">
            <X className="size-5" />
          </Button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5" data-vaul-no-drag>
          {children}
        </div>
        <div className="border-t border-hairline bg-surface-1 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
      </DrawerContent>
    </Drawer>
  );
}

export function SaveFooter({
  onSave,
  onDelete,
  pending,
  error,
  saved,
  disabled,
  saveLabel = "Save",
}: {
  onSave: () => void;
  onDelete?: () => void;
  pending: boolean;
  error: string | null;
  saved?: boolean;
  disabled?: boolean;
  saveLabel?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div>
      {error ? (
        <p role="alert" className="mb-2 text-sm font-medium text-red-text">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        {onDelete ? (
          confirm ? (
            <>
              <Button variant="primary" onClick={onDelete} disabled={pending}>
                Delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setConfirm(true)}>
              <Trash2 className="size-5 text-red-text" />
            </Button>
          )
        ) : null}
        <Button variant="inverse" size="lg" className="ml-auto min-w-36" onClick={onSave} disabled={pending || disabled}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : saved ? <Check className="size-5" strokeWidth={3} aria-hidden /> : null}
          {pending ? "Saving…" : saved ? "Saved" : saveLabel}
        </Button>
      </div>
    </div>
  );
}

/** Sticky bar for editors that save a whole table at once. */
export function DirtyBar({ dirty, onSave, onDiscard, pending, error }: { dirty: boolean; onSave: () => void; onDiscard: () => void; pending: boolean; error: string | null }) {
  return (
    <AnimatePresence>
      {dirty || error ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.75rem)] z-40 mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-3xl border border-hairline-strong bg-surface-2/95 p-3 pl-5 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl lg:bottom-6 lg:left-[calc(260px+1.5rem)]"
          role="region"
          aria-label="Unsaved changes"
        >
          <p className={cn("min-w-0 flex-1 text-sm font-medium", error && "text-red-text")}>{error ?? "Unsaved changes"}</p>
          <Button variant="ghost" onClick={onDiscard} disabled={pending}>
            Discard
          </Button>
          <Button variant="inverse" onClick={onSave} disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Resize in the browser (max 1600 px, WebP) so uploads are small and fast. */
async function shrink(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/webp", 0.82);
  return { dataUrl: dataUrl.startsWith("data:image/webp") ? dataUrl : canvas.toDataURL("image/jpeg", 0.85), width, height };
}

export function ImageUpload({ value, onChange, label, alt, aspect = "aspect-square" }: { value?: string; onChange: (v: string | undefined) => void; label: string; alt: string; aspect?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const img = await shrink(file);
      const res = await uploadImageAction({ ...img, alt });
      if (!res.ok) setError(res.error);
      else onChange(res.data);
    } catch {
      setError("Couldn't read that photo. Try a JPG or PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-text-secondary">{label}</p>
      <div className="flex items-end gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files[0]);
          }}
          className={cn(
            "tap group relative grid w-36 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-hairline-strong bg-surface-2 text-text-tertiary hover:border-white/40 hover:text-white",
            aspect,
          )}
          aria-label={value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={alt} className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-xs font-medium">
              <ImagePlus className="size-6" aria-hidden />
              Add photo
            </span>
          )}
          {busy ? (
            <span className="absolute inset-0 grid place-items-center bg-black/60">
              <Loader2 className="size-6 animate-spin text-white" aria-hidden />
            </span>
          ) : null}
        </button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            Remove
          </Button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files?.[0])} />
      {error ? <p className="mt-2 text-sm text-red-text">{error}</p> : <p className="mt-2 text-xs text-text-tertiary">Tap or drop a photo. It&apos;s resized automatically.</p>}
    </div>
  );
}
