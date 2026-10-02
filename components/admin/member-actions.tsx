"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, CreditCard, ExternalLink, Minus, Pause, Play, Plus, RefreshCw, Share2, Trash2, X } from "lucide-react";
import {
  addCardAction,
  archiveMemberAction,
  cancelMembershipAction,
  extendAction,
  freezeAction,
  regenerateQrAction,
  revokeCredentialAction,
  unfreezeAction,
  logSessionAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import type { PlanKind } from "@/content/plans";
import { addDays, localDate } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";
import { MemberForm, type MemberFormValues } from "./member-form";
import { SellPlanDialog, type SellTarget } from "./sell-plan-dialog";

type Result = { ok: true } | { ok: false; error: string };

/** Runs a server action, refreshes the page, and surfaces errors. */
function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result | { ok: true; data: unknown }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      after?.();
      router.refresh();
    });
  };
  return { run, pending, error };
}

function Sheet({
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
          <div>
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            {description ? <DialogDescription className="mt-1 text-sm text-text-secondary">{description}</DialogDescription> : null}
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1 -mr-2">
              <X className="size-5" />
            </Button>
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mt-3 text-sm font-medium text-red-text">
      {error}
    </p>
  ) : null;
}

export function SellButton({
  member,
  kind = "membership",
  label,
  autoOpen = false,
  variant = "primary",
}: {
  member: SellTarget;
  kind?: PlanKind;
  label: string;
  autoOpen?: boolean;
  variant?: "primary" | "outline" | "inverse";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? <SellPlanDialog open onOpenChange={setOpen} member={member} defaultKind={kind} onSold={() => router.refresh()} /> : null}
    </>
  );
}

export function MembershipMenu({
  membership,
}: {
  membership: { id: string; planName: string; endsOn: string; frozenFrom: string | null; frozenUntil: string | null };
}) {
  const today = localDate();
  const [dialog, setDialog] = useState<null | "freeze" | "extend" | "cancel">(null);
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState(addDays(today, 13));
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const { run, pending, error } = useAction();
  const paused = !!membership.frozenFrom && (membership.frozenUntil ?? "") >= today;
  const close = () => setDialog(null);

  return (
    <div className="flex flex-wrap gap-2">
      {paused ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => unfreezeAction(membership.id))}>
          <Play className="size-3.5" aria-hidden />
          Resume now
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setDialog("freeze")}>
          <Pause className="size-3.5" aria-hidden />
          Pause
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => setDialog("extend")}>
        <Plus className="size-3.5" aria-hidden />
        Add days
      </Button>
      <Button variant="ghost" size="sm" className="text-text-secondary" onClick={() => setDialog("cancel")}>
        Cancel plan
      </Button>
      <ErrorLine error={error} />

      <Sheet open={dialog === "freeze"} onOpenChange={(o) => !o && close()} title="Pause membership" description="Injury, travel, holiday. The end date moves back by the same number of days.">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="fz-from">From</Label>
            <Input id="fz-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fz-until">Until (inclusive)</Label>
            <Input id="fz-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
        </div>
        <ErrorLine error={error} />
        <Button size="lg" className="mt-5 w-full" disabled={pending} onClick={() => run(() => freezeAction(membership.id, from, until), close)}>
          Pause {membership.planName}
        </Button>
      </Sheet>

      <Sheet open={dialog === "extend"} onOpenChange={(o) => !o && close()} title="Add days" description="Comp days, a sickness note, a make-good. Use a negative number to take days off.">
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <div>
            <Label htmlFor="ex-days">Days</Label>
            <Input id="ex-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^\d-]/g, ""))} />
          </div>
          <div>
            <Label htmlFor="ex-reason">Reason</Label>
            <Input id="ex-reason" placeholder="Optional" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {[3, 7, 14, 30].map((d) => (
            <button key={d} type="button" onClick={() => setDays(String(d))} className="tap glass h-9 rounded-full px-3.5 text-sm">
              +{d}
            </button>
          ))}
        </div>
        <ErrorLine error={error} />
        <Button size="lg" className="mt-5 w-full" disabled={pending} onClick={() => run(() => extendAction(membership.id, Number(days), reason || undefined), close)}>
          Update end date
        </Button>
      </Sheet>

      <Sheet open={dialog === "cancel"} onOpenChange={(o) => !o && close()} title={`Cancel ${membership.planName}?`} description="They lose access straight away. The plan stays in their history.">
        <Label htmlFor="cx-reason">Reason</Label>
        <Input id="cx-reason" placeholder="Refunded, sold by mistake…" value={reason} onChange={(e) => setReason(e.target.value)} />
        <ErrorLine error={error} />
        <Button size="lg" className="mt-5 w-full" disabled={pending} onClick={() => run(() => cancelMembershipAction(membership.id, reason || undefined), close)}>
          Cancel plan
        </Button>
      </Sheet>
    </div>
  );
}

export function SessionButtons({ id, left, used }: { id: string; left: number; used: number }) {
  const { run, pending, error } = useAction();
  return (
    <div>
      <div className="flex gap-2">
        <Button disabled={pending || left <= 0} onClick={() => run(() => logSessionAction(id, 1))}>
          <Minus className="size-4" aria-hidden />
          Log a session
        </Button>
        <Button variant="ghost" disabled={pending || used <= 0} onClick={() => run(() => logSessionAction(id, -1))}>
          Undo
        </Button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

export function PassActions({ memberId, token, name }: { memberId: string; token: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const { run, pending, error } = useAction();
  const [confirm, setConfirm] = useState(false);
  const url = () => `${window.location.origin}/pass/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy the pass link", url());
    }
  }
  async function share() {
    const data = { title: "Your Superfit pass", text: `Hi ${name.split(" ")[0]}, here's your Superfit pass. Show the QR at the front desk.`, url: url() };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else copy();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="inverse" onClick={share}>
          <Share2 className="size-4" aria-hidden />
          Send pass
        </Button>
        <Button variant="secondary" onClick={copy} aria-live="polite">
          <Copy className="size-4" aria-hidden />
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button variant="ghost" asChild>
          <a href={`/pass/${token}`} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden />
            Open pass
          </a>
        </Button>
        <Button variant="ghost" onClick={() => setConfirm(true)}>
          <RefreshCw className="size-4" aria-hidden />
          New code
        </Button>
      </div>
      <Sheet open={confirm} onOpenChange={setConfirm} title="Issue a new QR code?" description="Use this if a phone is lost or a screenshot is being shared. The old code stops working immediately; the pass link updates by itself.">
        <ErrorLine error={error} />
        <Button size="lg" className="w-full" disabled={pending} onClick={() => run(() => regenerateQrAction(memberId), () => setConfirm(false))}>
          Issue new code
        </Button>
      </Sheet>
    </div>
  );
}

export function CardList({ memberId, cards }: { memberId: string; cards: { id: string; code: string }[] }) {
  const [code, setCode] = useState("");
  const { run, pending, error } = useAction();
  return (
    <div>
      {cards.length ? (
        <ul className="mb-3 space-y-1">
          {cards.map((c) => (
            <li key={c.id} className="flex min-h-11 items-center gap-3 rounded-xl bg-surface-2 pr-1 pl-3">
              <CreditCard className="size-4 text-text-tertiary" aria-hidden />
              <span className="tabular flex-1 font-mono text-sm">{c.code}</span>
              <Button variant="ghost" size="icon" aria-label={`Remove card ${c.code}`} disabled={pending} onClick={() => run(() => revokeCredentialAction(c.id))}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) run(() => addCardAction(memberId, code), () => setCode(""));
        }}
      >
        <Input aria-label="Card number" placeholder="Scan or type a card" value={code} onChange={(e) => setCode(e.target.value)} className="h-11" />
        <Button type="submit" variant="secondary" disabled={pending || !code.trim()}>
          Link card
        </Button>
      </form>
      <ErrorLine error={error} />
    </div>
  );
}

export function EditDetailsButton({ memberId, initial }: { memberId: string; initial: Partial<MemberFormValues> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit details
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Edit details" className="max-w-2xl">
        <MemberForm memberId={memberId} initial={initial} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function ArchiveButton({ memberId, archived }: { memberId: string; archived: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <div>
      <Button variant="ghost" size="sm" className="text-text-secondary" disabled={pending} onClick={() => run(() => archiveMemberAction(memberId, !archived))}>
        {archived ? "Restore member" : "Archive member"}
      </Button>
      <ErrorLine error={error} />
    </div>
  );
}
