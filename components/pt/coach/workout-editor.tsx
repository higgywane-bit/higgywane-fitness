"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ClipboardList, Copy, MoreHorizontal, PencilLine, Plus, Trash2, X } from "lucide-react";
import { savePlanAction, saveTemplateAction } from "@/app/coach/actions";
import { Collapsible, Field, inputCls, SaveBar, Segmented, Sheet, Stepper, toast, useLeaveGuard } from "@/components/pt/controls";
import { Button, Empty, Group, Pill } from "@/components/pt/ui";
import { cueText, type Cue, type Lang, type LibraryExercise } from "@/lib/pt/library";
import {
  addDay,
  addExercises,
  daySummary,
  duplicateDay,
  durationLabel,
  exerciseSummary,
  isUniform,
  LIMITS,
  moveDay,
  moveExercise,
  removeDay,
  removeExercise,
  renameDay,
  setAllTargets,
  setNote,
  setSetCount,
  setTargetAt,
  stepTarget,
  targetValue,
  toggleCue,
  updateExercise,
  type PlanExercise,
  type WorkoutPlan,
} from "@/lib/pt/program";
import { cn } from "@/lib/utils";
import { CuePicker } from "./cue-picker";
import { LibraryPanel, LibrarySheet } from "./exercise-library";

export type EditorTarget = { kind: "client"; clientId: string; firstName: string; version: number } | { kind: "template"; id?: string; name: string };
export type TemplateOption = { id: string; name: string; doc: WorkoutPlan };

export function WorkoutEditor({
  initial,
  target,
  library: initialLibrary,
  cues: initialCues,
  lang,
  templates = [],
}: {
  initial: WorkoutPlan;
  target: EditorTarget;
  library: LibraryExercise[];
  cues: Cue[];
  lang: Lang;
  templates?: TemplateOption[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [plan, setPlan] = useState(initial);
  const [version, setVersion] = useState(target.kind === "client" ? target.version : 0);
  const [name, setName] = useState(target.kind === "template" ? target.name : "");
  const [dayId, setDayId] = useState(initial.days[0]?.id ?? null);
  const [open, setOpen] = useState<string | null>(null);
  const [library, setLibrary] = useState(initialLibrary);
  const [cues, setCues] = useState(initialCues);
  const [sheet, setSheet] = useState<null | "library" | "day" | "programs" | "save-template" | { cueFor: string }>(null);
  const [saving, start] = useTransition();

  const dirty = useMemo(() => JSON.stringify(plan) !== JSON.stringify(saved) || (target.kind === "template" && name !== target.name), [plan, saved, name, target]);
  useLeaveGuard(dirty);
  const day = plan.days.find((d) => d.id === dayId) ?? plan.days[0] ?? null;
  const who = target.kind === "client" ? target.firstName : null;

  const edit = (uid: string, fn: (e: PlanExercise) => PlanExercise) => day && setPlan((p) => updateExercise(p, day.id, uid, fn));

  const save = () =>
    start(async () => {
      if (target.kind === "client") {
        const res = await savePlanAction(target.clientId, "workout", plan, version);
        if (!res.ok) return toast.bad("Not saved", res.error);
        setSaved(plan);
        setVersion(res.data.version);
        toast.good(res.data.notified ? `Saved. ${who}'s app is updated` : "Saved", res.data.changes.slice(0, 3).join(". ") || undefined);
      } else {
        const res = await saveTemplateAction({ id: target.id, kind: "workout", name, doc: plan });
        if (!res.ok) return toast.bad("Not saved", res.error);
        setSaved(plan);
        toast.good("Program saved");
        if (!target.id) router.replace(`/coach/programs/${res.data.id}`);
      }
      router.refresh();
    });

  const addDayNow = () => {
    const next = addDay(plan);
    if (next === plan) return toast.bad(`${LIMITS.days} gym days is the most.`);
    setPlan(next);
    setDayId(next.days.at(-1)!.id);
  };

  const addFromLibrary = (list: LibraryExercise[]) => {
    if (!day) return;
    const before = day.exercises.length;
    const next = addExercises(plan, day.id, list);
    setPlan(next);
    const added = next.days.find((d) => d.id === day.id)!.exercises.slice(before);
    if (added.length === 1) setOpen(added[0].uid);
    if (added.length < list.length) toast.bad(`${LIMITS.exercises} exercises is the most for one day.`);
  };

  const cueEx = sheet && typeof sheet === "object" && day ? day.exercises.find((e) => e.uid === sheet.cueFor) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {target.kind === "template" ? (
          <Field label="Program name" htmlFor="program-name">
            <input id="program-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="e.g. Upper / lower 4 days" className={inputCls} />
          </Field>
        ) : null}

        <div className="flex items-center gap-2">
          <div className="no-scrollbar -mx-4 flex flex-1 gap-2 overflow-x-auto px-4 py-1 lg:mx-0 lg:flex-wrap lg:px-0" role="tablist" aria-label="Gym days">
            {plan.days.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={day?.id === d.id}
                onClick={() => {
                  setDayId(d.id);
                  setOpen(null);
                }}
                className={cn("tap h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold", day?.id === d.id ? "bg-white text-black" : "bg-s1-surface-2 text-s1-muted hover:text-white")}
              >
                {d.name}
              </button>
            ))}
            <button type="button" onClick={addDayNow} className="tap h-10 shrink-0 rounded-full bg-s1-blue-tint px-4 text-[15px] font-semibold text-s1-blue">
              + Add day
            </button>
          </div>
          {templates.length || target.kind === "client" ? (
            <Button variant="secondary" size="sm" className="h-10 shrink-0 rounded-full" onClick={() => setSheet("programs")} aria-label="Programs">
              <ClipboardList className="size-4.5" aria-hidden />
              <span className="hidden sm:inline">Programs</span>
            </Button>
          ) : null}
        </div>

        {!day ? (
          <Empty icon={<ClipboardList />} title="No gym days yet">
            Add a day, then fill it from the library{templates.length ? ", or load one of your programs" : ""}.
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="primary" onClick={addDayNow}>
                <Plus className="size-5" aria-hidden /> Add day
              </Button>
              {templates.length ? (
                <Button variant="secondary" onClick={() => setSheet("programs")}>
                  Load a program
                </Button>
              ) : null}
            </div>
          </Empty>
        ) : (
          <section className="flex flex-col gap-3" aria-label={day.name}>
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <h2 className="truncate text-[22px] leading-7 font-bold tracking-tight">{day.name}</h2>
                <p className="text-[14px] text-s1-muted">{daySummary(day)}</p>
              </div>
              <Button variant="secondary" size="sm" aria-label={`${day.name} options`} onClick={() => setSheet("day")} className="size-10 rounded-full p-0">
                <MoreHorizontal className="size-5" />
              </Button>
            </div>

            {day.exercises.length ? (
              <Group>
                {day.exercises.map((e, i) => (
                  <Collapsible
                    key={e.uid}
                    open={open === e.uid}
                    onToggle={() => setOpen(open === e.uid ? null : e.uid)}
                    header={
                      <>
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{e.name}</span>
                          <span className="num shrink-0 text-[15px] font-semibold text-s1-muted">{exerciseSummary(e)}</span>
                        </span>
                        {e.cues.length || e.note ? (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {e.cues.map((c) => (
                              <Pill key={c.id} tone="blue">
                                {cueText(c, lang)}
                              </Pill>
                            ))}
                            {e.note ? <Pill tone="pink">Note</Pill> : null}
                          </span>
                        ) : null}
                      </>
                    }
                  >
                    <ExerciseBody
                      ex={e}
                      lang={lang}
                      first={i === 0}
                      last={i === day.exercises.length - 1}
                      onChange={(fn) => edit(e.uid, fn)}
                      onMove={(dir) => setPlan((p) => moveExercise(p, day.id, e.uid, dir))}
                      onRemove={() => {
                        setPlan((p) => removeExercise(p, day.id, e.uid));
                        setOpen(null);
                      }}
                      onCues={() => setSheet({ cueFor: e.uid })}
                    />
                  </Collapsible>
                ))}
              </Group>
            ) : (
              <p className="rounded-[20px] border border-dashed border-white/10 px-4 py-6 text-center text-[15px] text-s1-muted">
                No exercises yet. <span className="hidden xl:inline">Click any exercise in the library to add it.</span>
              </p>
            )}

            <Button variant="tinted" size="lg" className="rounded-2xl xl:hidden" onClick={() => setSheet("library")}>
              <Plus className="size-5" aria-hidden /> Add exercise
            </Button>
          </section>
        )}
      </div>

      <div className="hidden xl:sticky xl:top-6 xl:block">
        <LibraryPanel
          dayName={day?.name ?? null}
          library={library}
          lang={lang}
          onAdd={(e) => {
            addFromLibrary([e]);
            toast.good(`Added ${e.name}`, day ? `to ${day.name}` : undefined);
          }}
          onCustom={(e) => {
            setLibrary((l) => [...l, e]);
            addFromLibrary([e]);
          }}
        />
      </div>

      {day ? (
        <LibrarySheet
          open={sheet === "library"}
          onOpenChange={(o) => setSheet(o ? "library" : null)}
          dayName={day.name}
          library={library}
          lang={lang}
          onAdd={addFromLibrary}
          onCustom={(e) => setLibrary((l) => [...l, e])}
        />
      ) : null}

      {day ? (
        <DaySheet
          open={sheet === "day"}
          onOpenChange={(o) => setSheet(o ? "day" : null)}
          name={day.name}
          canLeft={plan.days[0]?.id !== day.id}
          canRight={plan.days.at(-1)?.id !== day.id}
          onRename={(n) => setPlan((p) => renameDay(p, day.id, n))}
          onMove={(dir) => setPlan((p) => moveDay(p, day.id, dir))}
          onDuplicate={() => {
            const next = duplicateDay(plan, day.id);
            setPlan(next);
            const i = next.days.findIndex((d) => d.id === day.id);
            setDayId(next.days[i + 1]?.id ?? day.id);
            setSheet(null);
          }}
          onDelete={() => {
            const i = plan.days.findIndex((d) => d.id === day.id);
            const next = removeDay(plan, day.id);
            setPlan(next);
            setDayId(next.days[Math.max(0, i - 1)]?.id ?? null);
            setSheet(null);
          }}
        />
      ) : null}

      {cueEx ? (
        <CuePicker
          open
          onOpenChange={(o) => !o && setSheet(null)}
          exerciseName={cueEx.name}
          cues={cues}
          selected={cueEx.cues}
          lang={lang}
          onToggle={(c) => edit(cueEx.uid, (e) => toggleCue(e, c))}
          onCustom={(c) => {
            setCues((l) => (l.some((x) => x.id === c.id) ? l : [...l, c]));
            edit(cueEx.uid, (e) => (e.cues.some((x) => x.id === c.id) ? e : toggleCue(e, c)));
          }}
        />
      ) : null}

      <ProgramsSheet
        open={sheet === "programs"}
        onOpenChange={(o) => setSheet(o ? "programs" : null)}
        templates={templates}
        canSaveAs={target.kind === "client" && plan.days.length > 0}
        onLoad={(t) => {
          setPlan(t.doc);
          setDayId(t.doc.days[0]?.id ?? null);
          setOpen(null);
          setSheet(null);
          toast.info(`${t.name} loaded`, who ? `Check it over, then Save and send to ${who}.` : undefined);
        }}
        onSaveAs={(programName) =>
          start(async () => {
            const res = await saveTemplateAction({ kind: "workout", name: programName, doc: plan });
            if (!res.ok) return toast.bad(res.error);
            setSheet(null);
            toast.good("Saved to Programs", `${programName} can be loaded for any client.`);
          })
        }
      />

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => { setPlan(saved); setName(target.kind === "template" ? target.name : ""); }} label={who ? `Save and send to ${who}` : "Save program"} />
    </div>
  );
}

function ExerciseBody({
  ex,
  lang,
  first,
  last,
  onChange,
  onMove,
  onRemove,
  onCues,
}: {
  ex: PlanExercise;
  lang: Lang;
  first: boolean;
  last: boolean;
  onChange: (fn: (e: PlanExercise) => PlanExercise) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onCues: () => void;
}) {
  const [mode, setMode] = useState<"same" | "each">(isUniform(ex) ? "same" : "each");
  const timed = ex.log === "time";
  const unit = timed ? "Time" : "Reps";
  const fmt = (n: number) => (timed ? durationLabel(n) : String(n));
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="w-10 text-[14px] text-s1-muted">Sets</span>
          <Stepper label={`sets for ${ex.name}`} value={ex.sets.length} min={1} max={LIMITS.sets} onStep={(d) => onChange((e) => setSetCount(e, e.sets.length + d))} />
        </div>
        {mode === "same" ? (
          <div className="flex items-center gap-3">
            <span className="w-10 text-[14px] text-s1-muted">{unit}</span>
            <Stepper
              label={`${unit.toLowerCase()} for ${ex.name}`}
              value={targetValue(ex.log, ex.sets[0])}
              format={fmt}
              onStep={(d) => onChange((e) => setAllTargets(e, stepTarget(e.log, targetValue(e.log, e.sets[0]), d)))}
            />
          </div>
        ) : null}
      </div>

      {ex.sets.length > 1 ? (
        <Segmented
          label="Set targets"
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (m === "same") onChange((e) => setAllTargets(e, targetValue(e.log, e.sets[0])));
          }}
          className="max-w-sm"
          options={[
            { value: "same", label: `Same for all ${ex.sets.length}` },
            { value: "each", label: "Edit each set" },
          ]}
        />
      ) : null}

      {mode === "each" && ex.sets.length > 1 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {ex.sets.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-s1-surface-3/60 py-1.5 pr-1.5 pl-4">
              <span className="text-[15px] font-medium">Set {i + 1}</span>
              <Stepper size="sm" label={`${unit.toLowerCase()} for set ${i + 1}`} value={targetValue(ex.log, s)} format={fmt} onStep={(d) => onChange((e) => setTargetAt(e, i, stepTarget(e.log, targetValue(e.log, e.sets[i]), d)))} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {ex.cues.map((c) => (
            <span key={c.id} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-s1-blue-tint pr-1 pl-3 text-[14px] font-medium text-s1-blue">
              {cueText(c, lang)}
              <button type="button" aria-label={`Remove ${c.en}`} onClick={() => onChange((e) => toggleCue(e, c))} className="grid size-6 place-items-center rounded-full bg-s1-surface-4 text-white">
                <X className="size-3" strokeWidth={3} />
              </button>
            </span>
          ))}
          <Button variant="plain" size="sm" onClick={onCues} disabled={ex.cues.length >= LIMITS.cues}>
            <Plus className="size-4" aria-hidden /> Add note
          </Button>
        </div>
        <NoteField value={ex.note ?? ""} onChange={(v) => onChange((e) => setNote(e, v))} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-s1-hairline pt-3">
        <Button variant="secondary" size="sm" disabled={first} onClick={() => onMove(-1)} aria-label="Move up">
          <ArrowUp className="size-4" aria-hidden /> Up
        </Button>
        <Button variant="secondary" size="sm" disabled={last} onClick={() => onMove(1)} aria-label="Move down">
          <ArrowDown className="size-4" aria-hidden /> Down
        </Button>
        <Button variant="danger" size="sm" className="ml-auto" onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden /> Remove
        </Button>
      </div>
    </div>
  );
}

function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(!!value);
  if (!editing)
    return (
      <button type="button" onClick={() => setEditing(true)} className="flex w-fit items-center gap-1.5 px-2 text-[14px] font-semibold text-s1-muted hover:text-white">
        <PencilLine className="size-4" aria-hidden /> Write a note
      </button>
    );
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      maxLength={LIMITS.note}
      placeholder="A note just for this exercise, e.g. use the blue bench"
      aria-label="Exercise note"
      className="w-full resize-none rounded-2xl bg-s1-surface-3 px-4 py-3 text-[15px] leading-[21px] outline-none placeholder:text-s1-faint focus:ring-2 focus:ring-s1-blue/60"
    />
  );
}

function DaySheet({
  open,
  onOpenChange,
  name,
  canLeft,
  canRight,
  onRename,
  onMove,
  onDuplicate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  canLeft: boolean;
  canRight: boolean;
  onRename: (n: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet open={open} onOpenChange={(o) => { setConfirm(false); onOpenChange(o); }} title="Gym day">
      <div className="flex flex-col gap-4">
        <Field label="Name" htmlFor="day-name">
          <input id="day-name" key={name} defaultValue={name} maxLength={LIMITS.name} onBlur={(e) => onRename(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" className="rounded-2xl" disabled={!canLeft} onClick={() => onMove(-1)}>
            Move earlier
          </Button>
          <Button variant="secondary" size="lg" className="rounded-2xl" disabled={!canRight} onClick={() => onMove(1)}>
            Move later
          </Button>
        </div>
        <Button variant="secondary" size="lg" className="rounded-2xl" onClick={onDuplicate}>
          <Copy className="size-5" aria-hidden /> Duplicate day
        </Button>
        {confirm ? (
          <Button variant="danger" size="lg" className="rounded-2xl" onClick={onDelete}>
            Yes, delete {name}
          </Button>
        ) : (
          <Button variant="danger" size="lg" className="rounded-2xl" onClick={() => setConfirm(true)}>
            <Trash2 className="size-5" aria-hidden /> Delete day
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function ProgramsSheet({
  open,
  onOpenChange,
  templates,
  canSaveAs,
  onLoad,
  onSaveAs,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templates: TemplateOption[];
  canSaveAs: boolean;
  onLoad: (t: TemplateOption) => void;
  onSaveAs: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Programs" description="Load one of your programs, or keep this workout as a program for other clients.">
      <div className="flex flex-col gap-5">
        {templates.length ? (
          <section className="flex flex-col gap-2">
            <h3 className="px-1 text-[13px] font-semibold text-s1-muted">Load a program (replaces what&apos;s here until you save)</h3>
            <Group>
              {templates.map((t) => (
                <button key={t.id} type="button" onClick={() => onLoad(t)} className="tap flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[0.03]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{t.name}</span>
                    <span className="block text-[13px] text-s1-muted">{t.doc.days.map((d) => d.name).join(", ") || "Empty"}</span>
                  </span>
                  <Pill tone="blue">Load</Pill>
                </button>
              ))}
            </Group>
          </section>
        ) : (
          <p className="rounded-2xl bg-s1-surface-2 p-4 text-[15px] text-s1-muted">No programs yet. Save this workout as one, or build them in Programs.</p>
        )}
        {canSaveAs ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onSaveAs(name.trim());
            }}
          >
            <Field label="Save this workout as a program" htmlFor="save-as">
              <input id="save-as" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="e.g. Upper / lower 4 days" className={inputCls} />
            </Field>
            <Button type="submit" variant="tinted" className="self-end" disabled={!name.trim()}>
              Save as program
            </Button>
          </form>
        ) : null}
      </div>
    </Sheet>
  );
}
