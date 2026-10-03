"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, CreditCard, UserRound } from "lucide-react";
import { duplicatesAction, quickPassAction } from "@/app/admin/actions";
import { AdminDialog, ErrorText } from "@/components/admin/kit";
import { PaymentStep, type DeskPayMethod } from "@/components/admin/pay/payment-step";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { FeedItem } from "@/lib/admin/queries";
import type { Plan } from "@/content/plans";
import { formatTHB } from "@/lib/format";
import type { CheckInResult } from "@/lib/membership/service";
import { cn } from "@/lib/utils";

export type QuickKind = "day" | "week";

export type DeskUpdate = { result: CheckInResult; feed: FeedItem[]; inToday: number };

type Dupe = { id: string; name: string; memberNo: number };

/**
 * Day pass: name, mobile, email → pay → in.
 * 1–2 week pass: the same plus the code written on the paper card we hand over.
 */
export function QuickPassSheet({
  kind,
  plans,
  promptPayId,
  onClose,
  onDone,
}: {
  kind: QuickKind;
  plans: Plan[];
  promptPayId: string | null;
  onClose: () => void;
  onDone: (u: DeskUpdate) => void;
}) {
  const choices = plans.filter((p) => p.kind === "membership" && (kind === "day" ? p.id === "day-pass" : p.id === "1-week" || p.id === "2-weeks"));
  const [planId, setPlanId] = useState(choices[0]?.id ?? "");
  const plan = choices.find((p) => p.id === planId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<DeskPayMethod>("qashier");
  const [reference, setReference] = useState("");
  const [dupes, setDupes] = useState<Dupe[]>([]);
  const [existing, setExisting] = useState<Dupe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (existing || (phone.replace(/\D/g, "").length < 9 && !/^\S+@\S+\.\S+$/.test(email))) return setDupes([]);
    const t = setTimeout(async () => {
      const res = await duplicatesAction({ phone, email });
      if (res.ok) setDupes(res.data);
    }, 300);
    return () => clearTimeout(t);
  }, [phone, email, existing]);

  const needsCode = kind === "week";
  const ready = !!plan && (existing || name.trim().length > 0) && (!needsCode || code.trim().length >= 3);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !ready) return;
    setError(null);
    start(async () => {
      const res = await quickPassAction({
        memberId: existing?.id,
        name,
        phone,
        email,
        planId: plan.id,
        paymentMethod: method,
        paymentRef: reference || null,
        code: code || null,
      });
      if (!res.ok) return setError(res.error);
      onDone(res.data);
    });
  }

  return (
    <AdminDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={kind === "day" ? "Day pass" : "Week pass"}
      description={kind === "day" ? "Quick sign-up, pay, straight in." : "Make the account and write in the code from the paper card."}
      className="sm:max-w-lg"
    >
      <form onSubmit={submit} className="space-y-5">
        {choices.length > 1 ? (
          <div role="radiogroup" aria-label="Pass" className="grid grid-cols-2 gap-2">
            {choices.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === planId}
                onClick={() => setPlanId(p.id)}
                className={cn(
                  "tap flex h-[72px] flex-col items-start justify-center rounded-2xl px-4 text-left",
                  p.id === planId ? "bg-white text-black" : "bg-surface-2 ring-1 ring-hairline-strong ring-inset",
                )}
              >
                <span className="font-display text-xl uppercase">{p.name}</span>
                <span className={cn("tabular text-sm", p.id === planId ? "text-black/60" : "text-text-secondary")}>{formatTHB(p.price)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {existing ? (
          <div className="flex items-center gap-3 rounded-2xl bg-success/12 p-3 ring-1 ring-success/30 ring-inset">
            <UserRound className="size-5 text-success" aria-hidden />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {existing.name} <span className="tabular font-normal text-text-secondary">#{existing.memberNo}</span>
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setExisting(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="qp-name">Name</Label>
              <Input id="qp-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoFocus required placeholder="First and last name" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="qp-phone">Mobile</Label>
                <Input id="qp-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" placeholder="081 234 5678" />
              </div>
              <div>
                <Label htmlFor="qp-email">Email</Label>
                <Input id="qp-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="name@email.com" />
              </div>
            </div>
            {dupes.length ? (
              <ul className="space-y-2" aria-label="Already a member">
                {dupes.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-energy/10 p-3 ring-1 ring-energy/30 ring-inset">
                    <p className="min-w-0 flex-1 truncate text-sm">
                      Already a member: <span className="font-semibold">{d.name}</span> <span className="tabular text-text-secondary">#{d.memberNo}</span>
                    </p>
                    <Button type="button" variant="inverse" size="sm" onClick={() => setExisting(d)}>
                      Use
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {needsCode ? (
          <div>
            <Label htmlFor="qp-code">Code on the card</Label>
            <div className="relative">
              <CreditCard className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-text-tertiary" aria-hidden />
              <Input
                id="qp-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                inputMode="numeric"
                autoComplete="off"
                maxLength={20}
                placeholder="6-digit code"
                required
                className="tabular h-14 pl-12 font-mono text-xl tracking-[0.3em] placeholder:font-sans placeholder:text-base placeholder:tracking-normal"
              />
            </div>
          </div>
        ) : null}

        {plan ? (
          <PaymentStep amount={plan.price} method={method} onMethod={setMethod} reference={reference} onReference={setReference} promptPayId={promptPayId} />
        ) : null}

        <ErrorText error={error} />

        <Button type="submit" size="lg" className="w-full" disabled={!ready || pending}>
          <Check className="size-5" strokeWidth={3} aria-hidden />
          {pending ? "Saving…" : plan ? `Paid ${formatTHB(plan.price)} · Check in` : "Check in"}
        </Button>
      </form>
    </AdminDialog>
  );
}
