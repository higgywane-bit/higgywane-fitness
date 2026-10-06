"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { savePlanAction } from "@/app/coach/actions";
import { Field, inputCls, SaveBar, Sheet, Switch, toast, useLeaveGuard } from "@/components/pt/controls";
import { Button, Group } from "@/components/pt/ui";
import { addQuestion, CUSTOM_TYPES, questionHint, removeQuestion, setTarget, toggleQuestion, type FeedbackSetup } from "@/lib/pt/feedback";

export function FeedbackEditor({ initial, clientId, firstName, version: v0, unsaved }: { initial: FeedbackSetup; clientId: string; firstName: string; version: number; unsaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [setup, setSetup] = useState(initial);
  const [version, setVersion] = useState(v0);
  const [fresh, setFresh] = useState(unsaved);
  const [adding, setAdding] = useState(false);
  const [saving, start] = useTransition();
  const dirty = useMemo(() => fresh || JSON.stringify(setup) !== JSON.stringify(saved), [fresh, setup, saved]);
  useLeaveGuard(dirty);
  const on = setup.questions.filter((q) => q.enabled).length;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="px-1 text-[15px] text-s1-muted">
        {firstName} answers these each day and taps Complete. {on} on.
      </p>
      <Group>
        {setup.questions.map((q) => (
          <div key={q.id} className="flex min-h-[64px] items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-medium">{q.label}</p>
              <p className="text-[14px] text-s1-muted">{questionHint(q)}</p>
            </div>
            {q.id === "steps" || q.id === "water" ? (
              <label className="flex items-center gap-1.5 text-[13px] text-s1-muted">
                Target
                {q.type === "choice" ? (
                  <select value={q.target ?? ""} onChange={(e) => setSetup((s) => setTarget(s, q.id, e.target.value ? Number(e.target.value) : null))} className="h-9 rounded-lg bg-s1-surface-3 px-2 text-[15px] text-white outline-none" aria-label={`${q.label} target`}>
                    <option value="">None</option>
                    {q.options?.map((o) => (
                      <option key={o} value={o}>
                        {o} {q.unit}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    inputMode="numeric"
                    value={q.target ?? ""}
                    onChange={(e) => {
                      const n = e.target.value.replace(/\D/g, "");
                      setSetup((s) => setTarget(s, q.id, n ? Number(n) : null));
                    }}
                    className="num h-9 w-24 rounded-lg bg-s1-surface-3 px-2 text-right text-[15px] text-white outline-none focus:ring-2 focus:ring-s1-blue/60"
                    aria-label={`${q.label} target`}
                  />
                )}
              </label>
            ) : null}
            {!q.builtin ? (
              <button type="button" aria-label={`Delete ${q.label}`} onClick={() => setSetup((s) => removeQuestion(s, q.id))} className="grid size-9 place-items-center rounded-full text-s1-faint hover:bg-s1-red-tint hover:text-s1-red">
                <Trash2 className="size-4" />
              </button>
            ) : null}
            <Switch label={q.label} checked={q.enabled} onChange={(v) => setSetup((s) => toggleQuestion(s, q.id, v))} />
          </div>
        ))}
      </Group>
      <Button variant="tinted" size="lg" className="self-start rounded-2xl" onClick={() => setAdding(true)}>
        <Plus className="size-5" aria-hidden /> Add your own question
      </Button>
      <AddQuestionSheet
        open={adding}
        onOpenChange={setAdding}
        onAdd={(input) => {
          try {
            setSetup((s) => addQuestion(s, input));
            setAdding(false);
          } catch (e) {
            toast.bad((e as Error).message);
          }
        }}
      />
      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={() => setSetup(saved)}
        label={`Save and send to ${firstName}`}
        onSave={() =>
          start(async () => {
            const res = await savePlanAction(clientId, "feedback", setup, version);
            if (!res.ok) return toast.bad("Not saved", res.error);
            setSaved(setup);
            setFresh(false);
            setVersion(res.data.version);
            toast.good(res.data.notified ? `Saved. ${firstName}'s app is updated` : "Saved");
            router.refresh();
          })
        }
      />
    </div>
  );
}

function AddQuestionSheet({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (q: { label: string; type: string; unit?: string }) => void }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("rate");
  const [unit, setUnit] = useState("");
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Your own question">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd({ label, type, unit });
          setLabel("");
          setUnit("");
        }}
      >
        <Field label="Question" htmlFor="q-label">
          <input id="q-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="e.g. Took creatine" className={inputCls} required />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 px-1 text-[13px] font-semibold text-s1-muted">Answer</legend>
          <div className="grid grid-cols-2 gap-2">
            {CUSTOM_TYPES.map((t) => (
              <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className={type === t.id ? "tap h-12 rounded-2xl bg-s1-blue text-[15px] font-semibold text-s1-on-blue" : "tap h-12 rounded-2xl bg-s1-surface-2 text-[15px] font-semibold hover:bg-s1-surface-3"}>
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        {type === "number" ? (
          <Field label="Unit (optional)" htmlFor="q-unit">
            <input id="q-unit" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={10} placeholder="e.g. cm, g" className={inputCls} />
          </Field>
        ) : null}
        <Button type="submit" variant="primary" size="lg" block disabled={!label.trim()}>
          Add question
        </Button>
      </form>
    </Sheet>
  );
}
