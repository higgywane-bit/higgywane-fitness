"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { sellPlanAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { PAYMENT_METHODS } from "@/content/gym";
import type { PlanKind } from "@/content/plans";
import { planList } from "@/lib/catalog";
import { formatTHB } from "@/lib/format";
import { planEndDate } from "@/lib/membership/access";
import { addDays, formatDate, isISODate, localDate } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";

export type SellTarget = {
  id: string;
  name: string;
  /** last day of current gym cover, so a renewal starts the day after */
  coverEnds?: string | null;
};

export function SellPlanDialog({
  open,
  onOpenChange,
  member,
  defaultKind = "membership",
  onSold,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: SellTarget;
  defaultKind?: PlanKind;
  onSold?: (info: { planName: string; startsOn: string; endsOn: string }) => void;
}) {
  const today = localDate();
  const [kind, setKind] = useState<PlanKind>(defaultKind);
  const plans = planList(kind);
  const [planId, setPlanId] = useState<string>(kind === "membership" ? "1-month" : "pt-10");
  const plan = plans.find((p) => p.id === planId);
  const autoStart = kind === "membership" && member.coverEnds && member.coverEnds >= today ? addDays(member.coverEnds, 1) : today;
  const [start, setStart] = useState<string | null>(null);
  const startsOn = start ?? autoStart;
  const [price, setPrice] = useState<string>("");
  const [method, setMethod] = useState<string>("qashier");
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const endsOn = useMemo(() => (plan && isISODate(startsOn) ? planEndDate(startsOn, plan.duration) : null), [plan, startsOn]);
  const finalPrice = price === "" ? (plan?.price ?? 0) : Number(price);

  function pickKind(k: PlanKind) {
    setKind(k);
    setPlanId(k === "membership" ? "1-month" : "pt-10");
    setPrice("");
    setStart(null);
  }

  function submit() {
    if (!plan) return setError("Pick a plan.");
    setError(null);
    startTransition(async () => {
      const res = await sellPlanAction(member.id, {
        planId: plan.id,
        startsOn,
        price: finalPrice,
        paymentMethod: method,
        paymentRef: ref || null,
      });
      if (!res.ok) return setError(res.error);
      onOpenChange(false);
      setPrice("");
      setRef("");
      setStart(null);
      onSold?.(res.data);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-xl flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 pt-5 pb-4">
          <div>
            <DialogTitle className="text-lg font-semibold">Sell a plan</DialogTitle>
            <DialogDescription className="text-sm text-text-secondary">{member.name}</DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1 -mr-2">
              <X className="size-5" />
            </Button>
          </DialogClose>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div role="tablist" aria-label="Plan type" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
            {(["membership", "pt"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={kind === k}
                onClick={() => pickKind(k)}
                className={cn("tap h-10 rounded-full text-sm font-semibold", kind === k ? "bg-white text-black" : "text-text-secondary hover:text-white")}
              >
                {k === "membership" ? "Gym membership" : "Personal training"}
              </button>
            ))}
          </div>

          <fieldset>
            <legend className="sr-only">Plan</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {plans.map((p) => {
                const selected = p.id === planId;
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "tap relative flex min-h-[76px] cursor-pointer flex-col justify-between rounded-2xl p-3",
                      selected ? "glass-lit" : "glass hover:bg-white/[0.07]",
                    )}
                  >
                    <input type="radio" name="plan" value={p.id} checked={selected} onChange={() => { setPlanId(p.id); setPrice(""); }} className="sr-only" />
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="tabular text-[13px] text-text-secondary">{formatTHB(p.price)}</span>
                    {selected ? (
                      <span className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-white text-black">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sell-start">Starts</Label>
              <Input id="sell-start" type="date" value={startsOn} onChange={(e) => setStart(e.target.value || null)} />
            </div>
            <div>
              <Label htmlFor="sell-price">Price (฿)</Label>
              <Input
                id="sell-price"
                inputMode="numeric"
                placeholder={String(plan?.price ?? "")}
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>
          {endsOn ? (
            <p className="-mt-2 text-sm text-text-secondary">
              {startsOn === today ? "From today" : `From ${formatDate(startsOn, today)}`} until{" "}
              <span className="font-semibold text-white">{formatDate(endsOn, today)}</span>
              {plan?.sessions ? ` · ${plan.sessions} session${plan.sessions > 1 ? "s" : ""}` : ""}
              {startsOn !== today && start === null ? " · starts after their current plan" : ""}
            </p>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-text-secondary">Paid by</legend>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    "tap inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-sm font-medium",
                    method === m.id ? "bg-white text-black" : "glass text-text-secondary hover:text-white",
                  )}
                >
                  <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="sell-ref">Receipt / reference (optional)</Label>
            <Input id="sell-ref" placeholder={method === "qashier" ? "Qashier receipt no." : "Reference"} value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
        </div>

        <div className="border-t border-hairline px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error ? (
            <p role="alert" className="mb-3 text-sm font-medium text-red-text">
              {error}
            </p>
          ) : null}
          <Button size="lg" className="w-full" onClick={submit} disabled={pending || !plan}>
            {pending ? "Saving…" : `Confirm sale · ${formatTHB(finalPrice)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
