"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { savePlanAction, saveTemplateAction } from "@/app/coach/actions";
import { Collapsible, Field, inputCls, SaveBar, Stepper, Switch, toast, useLeaveGuard } from "@/components/pt/controls";
import { Button, Card, Group, SectionTitle } from "@/components/pt/ui";
import {
  addFood,
  addMeal,
  kcalOf,
  MACROS,
  macroSplit,
  mealSummary,
  moveMeal,
  removeFood,
  removeMeal,
  renameMeal,
  stepMacro,
  updateFood,
  type DietPlan,
} from "@/lib/pt/diet";

const BAR = { protein: "bg-s1-blue", carbs: "bg-white", fat: "bg-s1-pink" } as const;

export type DietTarget = { kind: "client"; clientId: string; firstName: string; version: number } | { kind: "template"; id?: string; name: string };

export function DietEditor({ initial, target, templates = [], unsaved = false }: { initial: DietPlan; target: DietTarget; templates?: { id: string; name: string; doc: DietPlan }[]; unsaved?: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [plan, setPlan] = useState(initial);
  const [version, setVersion] = useState(target.kind === "client" ? target.version : 0);
  const [name, setName] = useState(target.kind === "template" ? target.name : "");
  const [open, setOpen] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const [fresh, setFresh] = useState(unsaved);
  const dirty = useMemo(() => fresh || JSON.stringify(plan) !== JSON.stringify(saved) || (target.kind === "template" && name !== target.name), [fresh, plan, saved, name, target]);
  useLeaveGuard(dirty);
  const who = target.kind === "client" ? target.firstName : null;
  const split = macroSplit(plan);

  const save = () =>
    start(async () => {
      if (target.kind === "client") {
        const res = await savePlanAction(target.clientId, "diet", plan, version);
        if (!res.ok) return toast.bad("Not saved", res.error);
        setSaved(plan);
        setFresh(false);
        setVersion(res.data.version);
        toast.good(res.data.notified ? `Saved. ${who}'s app is updated` : "Saved", res.data.changes[0]);
      } else {
        const res = await saveTemplateAction({ id: target.id, kind: "diet", name, doc: plan });
        if (!res.ok) return toast.bad("Not saved", res.error);
        setSaved(plan);
        toast.good("Diet saved");
        if (!target.id) router.replace(`/coach/programs/${res.data.id}`);
      }
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        {target.kind === "template" ? (
          <Field label="Diet name" htmlFor="diet-name">
            <input id="diet-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="e.g. Lean bulk 2,800" className={inputCls} />
          </Field>
        ) : null}
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <p className="num text-[40px] leading-[44px] font-bold tracking-[-0.03em]">{kcalOf(plan).toLocaleString("en-US")}</p>
            <p className="text-[14px] text-s1-muted">kcal a day, from the macros</p>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-s1-surface-3" aria-hidden>
            {MACROS.map((m) => (
              <span key={m.id} className={`${BAR[m.id]} transition-[width] duration-300`} style={{ width: `${split[m.id]}%` }} />
            ))}
          </div>
          <div className="flex flex-col divide-y divide-s1-hairline">
            {MACROS.map((m) => (
              <div key={m.id} className="flex min-h-14 items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[17px] font-medium">
                  <span className={`size-2.5 rounded-full ${BAR[m.id]}`} aria-hidden />
                  {m.label}
                  <span className="num text-[13px] text-s1-faint">{split[m.id]}%</span>
                </span>
                <Stepper label={m.label} value={plan[m.id]} min={0} format={(n) => `${n} g`} onStep={(d) => setPlan((p) => stepMacro(p, m.id, d))} />
              </div>
            ))}
          </div>
        </Card>
        {templates.length ? (
          <label className="flex flex-col gap-1.5">
            <span className="px-1 text-[13px] font-semibold text-s1-muted">Start from a saved diet</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const t = templates.find((x) => x.id === e.target.value);
                if (t) {
                  setPlan(t.doc);
                  toast.info(`${t.name} loaded`, who ? `Check it, then Save and send to ${who}.` : undefined);
                }
                e.target.value = "";
              }}
              className="h-11 rounded-xl bg-s1-surface-2 px-3 text-[15px] outline-none ring-1 ring-s1-hairline"
            >
              <option value="">Choose…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {kcalOf(t.doc).toLocaleString("en-US")} kcal
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Field label={who ? `Note for ${who}` : "Note"} htmlFor="diet-note">
          <textarea
            id="diet-note"
            rows={3}
            maxLength={400}
            value={plan.note ?? ""}
            onChange={(e) => setPlan((p) => ({ ...p, note: e.target.value || undefined }))}
            placeholder="e.g. Eat the carbs around training. Weigh food raw."
            className="w-full resize-none rounded-2xl bg-s1-surface-2 px-4 py-3 text-[15px] leading-[21px] outline-none ring-1 ring-s1-hairline placeholder:text-s1-faint focus:ring-2 focus:ring-s1-blue/60"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <Card className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-medium">Daily plan</p>
            <p className="text-[14px] text-s1-muted">{who ? `Shows under the macros in ${who}'s app` : "Meals under the macros"}</p>
          </div>
          <Switch label="Daily plan" checked={plan.showDailyPlan} onChange={(v) => setPlan((p) => ({ ...p, showDailyPlan: v }))} />
        </Card>

        {plan.showDailyPlan ? (
          <>
            <SectionTitle>Meals</SectionTitle>
            {plan.meals.length ? (
              <Group>
                {plan.meals.map((meal, i) => (
                  <Collapsible
                    key={meal.id}
                    open={open === meal.id}
                    onToggle={() => setOpen(open === meal.id ? null : meal.id)}
                    header={
                      <>
                        <span className="block text-[17px] font-semibold">{meal.name}</span>
                        <span className="block truncate text-[14px] text-s1-muted">{mealSummary(meal)}</span>
                      </>
                    }
                  >
                    <div className="flex flex-col gap-3">
                      <input defaultValue={meal.name} aria-label="Meal name" maxLength={40} onBlur={(e) => setPlan((p) => renameMeal(p, meal.id, e.target.value))} className={`${inputCls} h-11 bg-s1-surface-3`} />
                      <ul className="flex flex-col gap-2">
                        {meal.foods.map((f) => (
                          <li key={f.id} className="grid grid-cols-[1fr_96px_36px] items-center gap-2">
                            <input value={f.name} aria-label="Food" maxLength={40} onChange={(e) => setPlan((p) => updateFood(p, meal.id, f.id, { name: e.target.value }))} className="h-11 min-w-0 rounded-xl bg-s1-surface-3 px-3 text-[15px] outline-none focus:ring-2 focus:ring-s1-blue/60" />
                            <input value={f.amount} aria-label={`Amount of ${f.name}`} maxLength={24} placeholder="80 g" onChange={(e) => setPlan((p) => updateFood(p, meal.id, f.id, { amount: e.target.value }))} className="num h-11 min-w-0 rounded-xl bg-s1-surface-3 px-3 text-right text-[15px] outline-none focus:ring-2 focus:ring-s1-blue/60" />
                            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setPlan((p) => removeFood(p, meal.id, f.id))} className="grid size-9 place-items-center rounded-full text-s1-faint hover:bg-s1-red-tint hover:text-s1-red">
                              <X className="size-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <AddFood onAdd={(food) => setPlan((p) => addFood(p, meal.id, food))} />
                      <div className="flex flex-wrap gap-2 border-t border-s1-hairline pt-3">
                        <Button variant="secondary" size="sm" disabled={i === 0} onClick={() => setPlan((p) => moveMeal(p, meal.id, -1))}>
                          <ArrowUp className="size-4" aria-hidden /> Up
                        </Button>
                        <Button variant="secondary" size="sm" disabled={i === plan.meals.length - 1} onClick={() => setPlan((p) => moveMeal(p, meal.id, 1))}>
                          <ArrowDown className="size-4" aria-hidden /> Down
                        </Button>
                        <Button variant="danger" size="sm" className="ml-auto" onClick={() => setPlan((p) => removeMeal(p, meal.id))}>
                          <Trash2 className="size-4" aria-hidden /> Remove meal
                        </Button>
                      </div>
                    </div>
                  </Collapsible>
                ))}
              </Group>
            ) : null}
            <Button
              variant="tinted"
              size="lg"
              className="rounded-2xl"
              onClick={() => {
                const next = addMeal(plan);
                setPlan(next);
                setOpen(next.meals.at(-1)?.id ?? null);
              }}
            >
              <Plus className="size-5" aria-hidden /> Add meal
            </Button>
          </>
        ) : (
          <p className="rounded-[20px] border border-dashed border-white/10 px-4 py-6 text-center text-[15px] text-s1-muted">Switch the daily plan on to write out meals. Macros alone work too.</p>
        )}
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setPlan(saved)} label={who ? `Save and send to ${who}` : "Save diet"} />
    </div>
  );
}

function AddFood({ onAdd }: { onAdd: (f: { name: string; amount: string }) => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <form
      className="grid grid-cols-[1fr_96px_auto] items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd({ name, amount });
        setName("");
        setAmount("");
        (e.currentTarget.elements.namedItem("food") as HTMLInputElement | null)?.focus();
      }}
    >
      <input name="food" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add food" aria-label="New food" maxLength={40} className="h-11 min-w-0 rounded-xl bg-s1-surface-3/60 px-3 text-[15px] outline-none ring-1 ring-dashed ring-white/10 placeholder:text-s1-faint focus:ring-2 focus:ring-s1-blue/60" />
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" aria-label="New food amount" maxLength={24} className="h-11 min-w-0 rounded-xl bg-s1-surface-3/60 px-3 text-right text-[15px] outline-none ring-1 ring-white/10 placeholder:text-s1-faint focus:ring-2 focus:ring-s1-blue/60" />
      <Button type="submit" variant="tinted" size="sm" className="h-11" disabled={!name.trim()} aria-label="Add food">
        <Plus className="size-4" />
      </Button>
    </form>
  );
}
