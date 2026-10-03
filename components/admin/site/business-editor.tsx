"use client";

import { useState } from "react";
import type { Business } from "@/content/business";
import { DirtyBar, TextField, useSectionSave } from "./kit";

export function BusinessEditor({ business }: { business: Business }) {
  const [b, setB] = useState(business);
  const { save, pending, error } = useSectionSave("business");
  const dirty = JSON.stringify(b) !== JSON.stringify(business);
  const set = (k: keyof Business) => (v: string) => setB((s) => ({ ...s, [k]: v }));
  return (
    <div className="grid max-w-4xl gap-4 px-4 pb-32 md:grid-cols-2 md:px-8">
      <section className="space-y-4 rounded-3xl border border-hairline bg-surface-1 p-5">
        <h2 className="text-xs font-bold tracking-[0.16em] text-text-tertiary uppercase">Payments</h2>
        <TextField
          label="PromptPay number"
          hint="The phone number or 13-digit tax ID your PromptPay is registered to. Powers the QR at the desk and the bar."
          value={b.promptPayId}
          onChange={set("promptPayId")}
          inputMode="numeric"
          placeholder="0812345678"
          maxLength={20}
        />
      </section>
      <section className="space-y-4 rounded-3xl border border-hairline bg-surface-1 p-5">
        <h2 className="text-xs font-bold tracking-[0.16em] text-text-tertiary uppercase">On the website</h2>
        <TextField label="Gym name" value={b.name} onChange={set("name")} maxLength={60} />
        <TextField label="Tagline" value={b.tagline} onChange={set("tagline")} maxLength={140} />
        <TextField label="Opening hours" value={b.hours} onChange={set("hours")} maxLength={120} />
      </section>
      <section className="space-y-4 rounded-3xl border border-hairline bg-surface-1 p-5 md:col-span-2">
        <h2 className="text-xs font-bold tracking-[0.16em] text-text-tertiary uppercase">Contact</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Phone" value={b.phone} onChange={set("phone")} inputMode="tel" maxLength={30} />
          <TextField label="Email" value={b.email} onChange={set("email")} inputMode="email" maxLength={80} />
          <TextField label="LINE" value={b.line} onChange={set("line")} placeholder="@superfit" maxLength={60} />
          <TextField label="Instagram" value={b.instagram} onChange={set("instagram")} placeholder="superfit.th" maxLength={60} />
          <TextField label="Address" value={b.address} onChange={set("address")} multiline maxLength={200} className="md:col-span-2" />
        </div>
      </section>
      <DirtyBar dirty={dirty} onSave={() => save(b, (clean) => setB(clean))} onDiscard={() => setB(business)} pending={pending} error={error} />
    </div>
  );
}
