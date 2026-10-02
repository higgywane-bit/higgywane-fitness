"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { createMemberAction, duplicatesAction, updateMemberAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PAYMENT_METHODS } from "@/content/gym";
import { PLANS } from "@/content/plans";
import { formatTHB } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MemberFormValues = {
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  lineId: string;
  birthDate: string;
  gender: string;
  emergencyContact: string;
  notes: string;
  marketingOptIn: boolean;
};

const EMPTY: MemberFormValues = {
  firstName: "",
  lastName: "",
  nickname: "",
  phone: "",
  email: "",
  lineId: "",
  birthDate: "",
  gender: "",
  emergencyContact: "",
  notes: "",
  marketingOptIn: true,
};

const selectClass = "h-12 w-full rounded-2xl border border-hairline-strong bg-surface-2 px-4 text-base text-white";

export function MemberForm({ memberId, initial, onDone }: { memberId?: string; initial?: Partial<MemberFormValues>; onDone?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState<MemberFormValues>({ ...EMPTY, ...initial });
  const [card, setCard] = useState("");
  const [planId, setPlanId] = useState("");
  const [method, setMethod] = useState("qashier");
  const [dupes, setDupes] = useState<{ id: string; name: string; memberNo: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = !!memberId;

  const set = (k: keyof MemberFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  async function checkDupes() {
    if (!v.email && !v.phone) return setDupes([]);
    const res = await duplicatesAction({ email: v.email, phone: v.phone }, memberId);
    if (res.ok) setDupes(res.data);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (editing) {
        const res = await updateMemberAction(memberId, v);
        if (!res.ok) return setError(res.error);
        onDone?.();
        router.refresh();
        return;
      }
      const res = await createMemberAction({
        ...v,
        cardCode: card || undefined,
        sell: planId ? { planId, paymentMethod: method } : undefined,
      });
      if (!res.ok) return setError(res.error);
      router.push(`/admin/members/${res.data.id}?welcome=1`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-white">Who</legend>
        <div>
          <Label htmlFor="firstName">First name *</Label>
          <Input id="firstName" required autoComplete="off" value={v.firstName} onChange={set("firstName")} autoFocus={!editing} />
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" autoComplete="off" value={v.lastName} onChange={set("lastName")} />
        </div>
        <div>
          <Label htmlFor="nickname">Nickname</Label>
          <Input id="nickname" autoComplete="off" placeholder="What staff call them" value={v.nickname} onChange={set("nickname")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="birthDate">Birthday</Label>
            <Input id="birthDate" type="date" value={v.birthDate} onChange={set("birthDate")} />
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <select id="gender" className={selectClass} value={v.gender} onChange={set("gender")}>
              <option value="">—</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-white">Contact</legend>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" inputMode="tel" placeholder="081 234 5678" value={v.phone} onChange={set("phone")} onBlur={checkDupes} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" inputMode="email" placeholder="For renewal reminders" value={v.email} onChange={set("email")} onBlur={checkDupes} />
        </div>
        <div>
          <Label htmlFor="lineId">LINE ID</Label>
          <Input id="lineId" autoComplete="off" value={v.lineId} onChange={set("lineId")} />
        </div>
        <div>
          <Label htmlFor="emergency">Emergency contact</Label>
          <Input id="emergency" autoComplete="off" placeholder="Name and phone" value={v.emergencyContact} onChange={set("emergencyContact")} />
        </div>
        {dupes.length ? (
          <div role="status" className="flex gap-3 rounded-2xl bg-energy/10 p-4 text-sm ring-1 ring-energy/30 ring-inset sm:col-span-2">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-energy" aria-hidden />
            <p>
              <span className="font-semibold text-energy">Already a member?</span> Same phone or email as{" "}
              {dupes.map((d, i) => (
                <span key={d.id}>
                  {i ? ", " : ""}
                  <Link href={`/admin/members/${d.id}`} className="font-semibold underline underline-offset-4">
                    {d.name} #{d.memberNo}
                  </Link>
                </span>
              ))}
              .
            </p>
          </div>
        ) : null}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text-secondary sm:col-span-2">
          <input
            type="checkbox"
            checked={v.marketingOptIn}
            onChange={(e) => setV((s) => ({ ...s, marketingOptIn: e.target.checked }))}
            className="size-5 accent-[var(--red)]"
          />
          OK to send renewal reminders and gym news
        </label>
      </fieldset>

      {!editing ? (
        <>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-white">Membership (optional)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[{ id: "", name: "Later", price: null as number | null }, ...PLANS.filter((p) => p.kind === "membership")].map((p) => (
                <label
                  key={p.id || "none"}
                  className={cn("tap flex min-h-16 cursor-pointer flex-col justify-center rounded-2xl px-3 py-2", planId === p.id ? "glass-lit" : "glass hover:bg-white/[0.07]")}
                >
                  <input type="radio" name="plan" className="sr-only" checked={planId === p.id} onChange={() => setPlanId(p.id)} />
                  <span className="text-sm font-semibold">{p.name}</span>
                  {p.price != null ? <span className="tabular text-xs text-text-secondary">{formatTHB(p.price)}</span> : <span className="text-xs text-text-tertiary">Sell from profile</span>}
                </label>
              ))}
            </div>
            {planId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <label
                    key={m.id}
                    className={cn("tap inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-sm font-medium", method === m.id ? "bg-white text-black" : "glass text-text-secondary hover:text-white")}
                  >
                    <input type="radio" name="method" className="sr-only" checked={method === m.id} onChange={() => setMethod(m.id)} />
                    {m.label}
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-white">Existing card (optional)</legend>
            <div className="max-w-sm">
              <Label htmlFor="card">Glofox card number</Label>
              <Input id="card" autoComplete="off" placeholder="Scan or type the card" value={card} onChange={(e) => setCard(e.target.value)} />
              <p className="mt-2 text-xs text-text-tertiary">Their old card keeps working alongside the new phone QR.</p>
            </div>
          </fieldset>
        </>
      ) : null}

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" placeholder="Injuries, goals, anything the team should know" value={v.notes} onChange={set("notes")} />
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 border-t border-hairline bg-black/85 px-4 py-3 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 lg:bottom-0">
        {error ? (
          <p role="alert" className="mb-3 text-sm font-medium text-red-text">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending || !v.firstName.trim()} className="w-full md:w-auto md:min-w-56">
          {pending ? "Saving…" : editing ? "Save changes" : planId ? "Create member and sell plan" : "Create member"}
        </Button>
      </div>
    </form>
  );
}
