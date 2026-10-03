"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addShiftAction, copyWeekAction, createStaffAction, removeShiftAction, setStaffActiveAction, updateStaffAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { coachList } from "@/lib/catalog";
import { AREAS, ROLES, type Area, type Role } from "@/lib/staff/rules";
import { AdminDialog, ErrorText, Select, useAction } from "./kit";

export type StaffFormValues = {
  id?: string;
  name: string;
  role: Role;
  phone: string;
  email: string;
  coachSlug: string;
  hourlyRate: string;
  ptCommissionPct: string;
  hasPin?: boolean;
};

const EMPTY: StaffFormValues = { name: "", role: "desk", phone: "", email: "", coachSlug: "", hourlyRate: "", ptCommissionPct: "" };

export function StaffFormButton({ initial, label = "Add staff", variant = "primary" }: { initial?: StaffFormValues; label?: string; variant?: "primary" | "outline" }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<StaffFormValues>(initial ?? EMPTY);
  const [pin, setPin] = useState("");
  const { run, pending, error } = useAction();
  const set = (k: keyof StaffFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { name: v.name, role: v.role, phone: v.phone, email: v.email, coachSlug: v.coachSlug, hourlyRate: num(v.hourlyRate), ptCommissionPct: num(v.ptCommissionPct), pin: pin || null };
    run(() => (v.id ? updateStaffAction(v.id, input) : createStaffAction(input)), () => {
      setOpen(false);
      setPin("");
      if (!v.id) setV(EMPTY);
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {v.id ? null : <Plus className="size-4" aria-hidden />}
        {label}
      </Button>
      <AdminDialog open={open} onOpenChange={setOpen} title={v.id ? `Edit ${initial?.name}` : "Add staff"} className="max-w-lg">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="st-name">Name *</Label>
            <Input id="st-name" value={v.name} onChange={set("name")} required />
          </div>
          <div>
            <Label htmlFor="st-role">Role</Label>
            <Select id="st-role" value={v.role} onChange={set("role")}>
              {(Object.keys(ROLES) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLES[r].label}
                </option>
              ))}
            </Select>
          </div>
          {v.role === "coach" ? (
            <div>
              <Label htmlFor="st-coach">Coach profile on website</Label>
              <Select id="st-coach" value={v.coachSlug} onChange={set("coachSlug")}>
                <option value="">—</option>
                {coachList({ includeHidden: true }).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div />
          )}
          <div>
            <Label htmlFor="st-phone">Phone</Label>
            <Input id="st-phone" type="tel" value={v.phone} onChange={set("phone")} />
          </div>
          <div>
            <Label htmlFor="st-email">Email</Label>
            <Input id="st-email" type="email" value={v.email} onChange={set("email")} />
          </div>
          <div>
            <Label htmlFor="st-rate">Hourly rate (฿)</Label>
            <Input id="st-rate" inputMode="numeric" value={v.hourlyRate} onChange={(e) => setV((s) => ({ ...s, hourlyRate: e.target.value.replace(/\D/g, "") }))} placeholder="For wage estimates" />
          </div>
          {v.role === "coach" ? (
            <div>
              <Label htmlFor="st-comm">PT commission (%)</Label>
              <Input id="st-comm" inputMode="numeric" value={v.ptCommissionPct} onChange={(e) => setV((s) => ({ ...s, ptCommissionPct: e.target.value.replace(/\D/g, "") }))} placeholder="e.g. 40" />
            </div>
          ) : (
            <div />
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="st-pin">{v.hasPin ? "New PIN (leave blank to keep)" : "PIN (optional, 4–6 digits)"}</Label>
            <Input id="st-pin" inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            <p className="mt-1.5 text-xs text-text-tertiary">Asked when they switch to themselves on a shared device.</p>
          </div>
          <div className="sm:col-span-2">
            <ErrorText error={error} />
            <Button type="submit" size="lg" className="w-full" disabled={pending || !v.name.trim()}>
              {pending ? "Saving…" : v.id ? "Save" : "Add staff member"}
            </Button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}

export function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <div>
      <Button variant="ghost" size="sm" className="text-text-secondary" disabled={pending} onClick={() => run(() => setStaffActiveAction(id, !active))}>
        {active ? "Deactivate" : "Reactivate"}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

/* ── rota ── */

export function AddShift({ staff, date, staffId }: { staff: { id: string; name: string }[]; date: string; staffId: string }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(staffId);
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("14:00");
  const [area, setArea] = useState<Area>("desk");
  const { run, pending, error } = useAction();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Add shift on ${date}`} className="grid h-8 w-full place-items-center rounded-lg text-text-tertiary opacity-60 hover:bg-surface-3 hover:text-white hover:opacity-100 focus-visible:opacity-100">
        <Plus className="size-4" />
      </button>
      <AdminDialog open={open} onOpenChange={setOpen} title="Add shift" description={new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}>
        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addShiftAction({ staffId: who, date, start, end, area }), () => setOpen(false));
          }}
        >
          <div className="col-span-2">
            <Label htmlFor="sh-who">Who</Label>
            <Select id="sh-who" value={who} onChange={(e) => setWho(e.target.value)}>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sh-start">Start</Label>
            <Input id="sh-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sh-end">End</Label>
            <Input id="sh-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="sh-area">Where</Label>
            <Select id="sh-area" value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {(Object.keys(AREAS) as Area[]).map((a) => (
                <option key={a} value={a}>
                  {AREAS[a]}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-span-2">
            <ErrorText error={error} />
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              Add shift
            </Button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}

export function ShiftChip({ id, label, sub, color }: { id: string; label: string; sub: string; color: string | null }) {
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useAction();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-lg px-2 py-1.5 text-left text-xs ring-1 ring-inset ring-white/10 hover:ring-white/30" style={{ backgroundColor: `${color ?? "#ffffff"}22` }}>
        <span className="tabular block font-semibold text-white">{label}</span>
        <span className="block truncate text-[11px] text-text-secondary">{sub}</span>
      </button>
      <AdminDialog open={open} onOpenChange={setOpen} title={`${label} · ${sub}`}>
        <ErrorText error={error} />
        <Button variant="outline" className="w-full" disabled={pending} onClick={() => run(() => removeShiftAction(id), () => setOpen(false))}>
          <Trash2 className="size-4" aria-hidden />
          Remove shift
        </Button>
      </AdminDialog>
    </>
  );
}

export function CopyWeekButton({ from, to }: { from: string; to: string }) {
  const { run, pending, error } = useAction();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" disabled={pending} onClick={() => run(() => copyWeekAction(from, to), (n) => setMsg(`${n} shifts copied`))}>
        Copy last week
      </Button>
      {msg ? <span className="text-sm text-success">{msg}</span> : null}
      <ErrorText error={error} />
    </div>
  );
}
