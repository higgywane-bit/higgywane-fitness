"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { saveTargetsAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { Targets } from "@/lib/performance/targets";
import { AdminDialog, ErrorText, useAction } from "./kit";

const FIELDS: { key: keyof Targets; label: string; hint: string }[] = [
  { key: "revenue", label: "Sales (฿) per month", hint: "Till total from Qashier" },
  { key: "newMembers", label: "New members per month", hint: "First-ever gym plan" },
  { key: "activeMembers", label: "Active members", hint: "At the end of the month" },
  { key: "ptSessions", label: "PT sessions per month", hint: "Delivered, all coaches" },
];

export function TargetsButton({ targets }: { targets: Targets }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, targets[f.key]?.toString() ?? ""])) as Record<keyof Targets, string>);
  const { run, pending, error } = useAction();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Target className="size-4" aria-hidden />
        Set targets
      </Button>
      <AdminDialog open={open} onOpenChange={setOpen} title="Monthly targets" description="Leave a box empty to hide that target.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const n = (s: string) => (s.trim() ? Number(s) : null);
            run(() => saveTargetsAction({ revenue: n(v.revenue), newMembers: n(v.newMembers), activeMembers: n(v.activeMembers), ptSessions: n(v.ptSessions) }), () => setOpen(false));
          }}
        >
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label htmlFor={`tg-${f.key}`}>{f.label}</Label>
              <Input id={`tg-${f.key}`} inputMode="numeric" value={v[f.key]} onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value.replace(/\D/g, "") }))} placeholder={f.hint} />
            </div>
          ))}
          <ErrorText error={error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            Save targets
          </Button>
        </form>
      </AdminDialog>
    </>
  );
}
