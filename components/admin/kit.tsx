"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* Small shared pieces for admin screens. */

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string };

/** Run a server action, refresh the page, surface the error. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: (data: unknown) => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      after?.("data" in res ? res.data : undefined);
      router.refresh();
    });
  };
  return { run, pending, error, setError };
}

export function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto p-5", className)}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            {description ? <DialogDescription className="mt-1 text-sm text-text-secondary">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1 -mr-2 shrink-0">
              <X className="size-5" />
            </Button>
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mt-3 text-sm font-medium text-red-text">
      {error}
    </p>
  ) : null;
}

export const selectClass = "h-12 w-full rounded-2xl border border-hairline-strong bg-surface-2 px-4 text-base text-white";

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(selectClass, className)} {...props} />;
}

/** Pill toggle group (single choice). */
export function Pills<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("tap inline-flex h-10 items-center rounded-full px-4 text-sm font-medium", value === o.id ? "bg-white text-black" : "glass text-text-secondary hover:text-white")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tabs that link (server-rendered sections). */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-hairline-strong p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-text-secondary">{children}</div> : null}
    </div>
  );
}
