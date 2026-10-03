"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addExpenseAction, deleteExpenseAction, endRecurringAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/rules";
import { localDate } from "@/lib/membership/dates";
import { AdminDialog, ErrorText, Pills, Select, useAction } from "./kit";

export function AddExpenseButton() {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ date: localDate(), category: "cafe-stock", description: "", vendor: "", amount: "", recurring: "none" as "none" | "monthly", paymentMethod: "" });
  const { run, pending, error } = useAction();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Add expense
      </Button>
      <AdminDialog open={open} onOpenChange={setOpen} title="Add expense" description="Rent, stock, repairs, wages. Monthly costs repeat by themselves." className="max-w-lg">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addExpenseAction({ ...v, amount: Number(v.amount) }), () => {
              setOpen(false);
              setV((s) => ({ ...s, description: "", vendor: "", amount: "" }));
            });
          }}
        >
          <div>
            <Label htmlFor="ex-date">Date</Label>
            <Input id="ex-date" type="date" value={v.date} onChange={set("date")} />
          </div>
          <div>
            <Label htmlFor="ex-amount">Amount (฿)</Label>
            <Input id="ex-amount" inputMode="decimal" value={v.amount} onChange={(e) => setV((s) => ({ ...s, amount: e.target.value.replace(/[^\d.]/g, "") }))} required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="ex-desc">What for</Label>
            <Input id="ex-desc" value={v.description} onChange={set("description")} placeholder="Whey restock, aircon repair…" required />
          </div>
          <div>
            <Label htmlFor="ex-cat">Category</Label>
            <Select id="ex-cat" value={v.category} onChange={set("category")}>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ex-vendor">Paid to</Label>
            <Input id="ex-vendor" value={v.vendor} onChange={set("vendor")} placeholder="Optional" />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-text-secondary">Repeats</p>
            <Pills label="Repeats" value={v.recurring} onChange={(recurring) => setV((s) => ({ ...s, recurring }))} options={[{ id: "none", label: "One-off" }, { id: "monthly", label: "Every month" }]} />
          </div>
          <div className="sm:col-span-2">
            <ErrorText error={error} />
            <Button type="submit" size="lg" className="w-full" disabled={pending || !v.description.trim() || !v.amount}>
              {pending ? "Saving…" : "Add expense"}
            </Button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}

export function ExpenseRowActions({ id, recurring, ended }: { id: string; recurring: boolean; ended: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <div className="flex items-center justify-end gap-1">
      {recurring && !ended ? (
        <Button size="sm" variant="ghost" className="text-text-secondary" disabled={pending} onClick={() => run(() => endRecurringAction(id, localDate()))}>
          Stop repeating
        </Button>
      ) : null}
      <Button size="icon" variant="ghost" aria-label="Delete expense" disabled={pending} onClick={() => confirm("Delete this expense?") && run(() => deleteExpenseAction(id))}>
        <Trash2 className="size-4" />
      </Button>
      <ErrorText error={error} />
    </div>
  );
}
