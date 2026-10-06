"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Delete, PencilLine, Plus, Minus, Timer, X } from "lucide-react";
import { finishWorkoutAction } from "@/app/app/actions";
import { Sheet, Switch, toast } from "@/components/pt/controls";
import { Button, btn } from "@/components/pt/ui";
import { PT_APP } from "@/content/pt-app";
import { useHydrated } from "@/hooks/use-hydrated";
import type { LogKind } from "@/lib/pt/library";
import { durationShort, kg, WEIGHT_STEP, type LoggedExercise, type LoggedSet } from "@/lib/pt/progress";
import { useWorkout } from "@/lib/pt/workout-store";
import { cn } from "@/lib/utils";

export type LoggerExercise = { uid: string; name: string; cues: string[]; note?: string; target: string; last: string | null };

type Field = "weight" | "reps" | "seconds";
type Editing = { uid: string; index: number; field: Field; buffer: string; fresh: boolean };

const fieldsFor = (log: LogKind): Field[] => (log === "time" ? ["seconds"] : log === "reps" ? ["reps"] : ["weight", "reps"]);
const STEP: Record<Field, number> = { weight: WEIGHT_STEP, reps: 1, seconds: 5 };
const UNIT: Record<Field, string> = { weight: "kg", reps: "reps", seconds: "sec" };

function display(field: Field, v: number | null | undefined) {
  if (v == null) return "–";
  return field === "weight" ? kg(v) : String(v);
}

/* ── sound + buzz when rest is up ────────────────────────── */

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22, 0.44].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.18);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    /* no audio */
  }
  navigator.vibrate?.([200, 100, 200]);
}

function useRest() {
  const { restEndsAt, stopRest, beep: wantsBeep } = useWorkout();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!restEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);
  const left = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : null;
  const fired = useRef<number | null>(null);
  useEffect(() => {
    if (restEndsAt && left === 0 && fired.current !== restEndsAt) {
      fired.current = restEndsAt;
      if (wantsBeep) beep();
      toast.info("Rest's up", "Next set.");
      stopRest();
    }
  }, [left, restEndsAt, stopRest, wantsBeep]);
  return left;
}

/* ── the screen ──────────────────────────────────────────── */

export function WorkoutLogger({
  clientId,
  dayId,
  dayName,
  fresh,
  meta,
}: {
  clientId: string;
  dayId: string;
  dayName: string;
  /** entries prefilled from the plan and last time */
  fresh: LoggedExercise[];
  meta: LoggerExercise[];
}) {
  const hydrated = useHydrated();
  const router = useRouter();
  const w = useWorkout();
  const active = w.active && w.active.clientId === clientId ? w.active : null;
  const other = active && active.dayId !== dayId ? active : null;
  const mine = active && active.dayId === dayId ? active : null;

  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sheet, setSheet] = useState<"end" | "rest" | "note" | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const rest = useRest();

  // start a fresh workout the first time this screen opens
  useEffect(() => {
    if (hydrated && !active) w.start({ clientId, dayId, dayName, entries: fresh });
  }, [hydrated, active, clientId, dayId, dayName, fresh, w]);

  const entries = mine?.entries ?? [];
  const metaBy = useMemo(() => new Map(meta.map((m) => [m.uid, m])), [meta]);
  const doneCount = entries.filter((e) => e.sets.length && e.sets.every((s) => s.done)).length;
  const current = open ?? entries.find((e) => e.sets.some((s) => !s.done))?.uid ?? null;

  if (!hydrated) return <div className="p-6 text-center text-s1-muted">Loading…</div>;

  if (other) {
    return (
      <div className="flex min-h-dvh flex-col justify-center gap-4 px-5 text-center">
        <h1 className="text-[26px] font-bold tracking-tight">{other.dayName} is still open</h1>
        <p className="text-[15px] text-s1-muted">Finish or discard it before starting {dayName}.</p>
        <Button variant="primary" size="lg" block onClick={() => router.push(`/app/workout/${other.dayId}/log`)}>
          Back to {other.dayName}
        </Button>
        <Button variant="danger" size="lg" block onClick={() => w.discard()}>
          Discard it and start {dayName}
        </Button>
      </div>
    );
  }
  if (!mine) return <div className="p-6 text-center text-s1-muted">Loading…</div>;

  /* keypad */
  const entryOf = (uid: string) => entries.find((e) => e.uid === uid)!;
  const startEdit = (uid: string, index: number, field: Field) => {
    const s = entryOf(uid).sets[index];
    const v = s[field];
    setOpen(uid);
    setEditing({ uid, index, field, buffer: v == null ? "" : field === "weight" ? kg(v) : String(v), fresh: true });
  };
  const commit = (e: Editing) => {
    const n = e.buffer === "" ? null : Number(e.buffer);
    w.setSet(e.uid, e.index, { [e.field]: n == null || !Number.isFinite(n) ? null : Math.max(0, n) });
  };
  const key = (k: string) => {
    if (!editing) return;
    let buffer = editing.fresh ? "" : editing.buffer;
    if (k === "del") buffer = (editing.fresh ? editing.buffer : buffer).slice(0, -1);
    else if (k === ".") buffer = editing.field === "weight" && !buffer.includes(".") ? (buffer || "0") + "." : buffer;
    else if (buffer.length < 6) buffer = buffer === "0" ? k : buffer + k;
    const next = { ...editing, buffer, fresh: false };
    setEditing(next);
    commit(next);
  };
  const nudge = (dir: -1 | 1) => {
    if (!editing) return;
    const n = Math.max(0, (Number(editing.buffer) || 0) + dir * STEP[editing.field]);
    const next = { ...editing, buffer: editing.field === "weight" ? kg(n) : String(n), fresh: true };
    setEditing(next);
    commit(next);
  };
  const logSet = () => {
    if (!editing) return;
    commit(editing);
    w.setSet(editing.uid, editing.index, { done: true });
    w.startRest();
    setEditing(null);
  };
  const toggleDone = (uid: string, index: number) => {
    const s = entryOf(uid).sets[index];
    w.setSet(uid, index, { done: !s.done });
    if (!s.done) w.startRest();
    setEditing(null);
  };

  const finish = () => {
    start(async () => {
      const res = await finishWorkoutAction({ ...mine, finishedAt: new Date().toISOString() });
      if (!res.ok) return toast.bad(res.error);
      w.discard();
      router.replace(`/app/workout/session/${res.data.id}?done=1`);
    });
  };

  const editingEntry = editing ? entryOf(editing.uid) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="s1-glass sticky top-0 z-30 grid h-14 grid-cols-[84px_1fr_84px] items-center px-2">
        <button type="button" onClick={() => setSheet("end")} className={btn({ variant: "plain", className: "justify-start font-medium text-s1-muted" })}>
          End
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-[16px] font-semibold">{dayName}</p>
          <p className="num text-[12px] text-s1-muted">
            {doneCount} of {entries.length} done
          </p>
        </div>
        <div className="flex justify-end">
          <button type="button" aria-label="Rest timer settings" onClick={() => setSheet("rest")} className="grid size-11 place-items-center rounded-full text-s1-blue hover:bg-white/5">
            <Timer className="size-[22px]" />
          </button>
          <button
            type="button"
            aria-label="Note for your coach"
            onClick={() => {
              setNote(mine.note);
              setSheet("note");
            }}
            className={cn("grid size-11 place-items-center rounded-full hover:bg-white/5", mine.note ? "text-s1-pink" : "text-s1-blue")}
          >
            <PencilLine className="size-[22px]" />
          </button>
        </div>
      </header>

      <main className={cn("flex flex-col gap-3 px-4 pt-3", editing ? "pb-[360px]" : "pb-36")}>
        {rest != null ? (
          <div className="sticky top-16 z-20 flex justify-center">
            <button type="button" onClick={() => w.stopRest()} aria-label="Rest timer running, tap to stop" className="tap num inline-flex h-11 items-center gap-2 rounded-full bg-s1-blue px-4 text-[17px] font-bold text-s1-on-blue shadow-[0_10px_30px_rgba(0,180,255,0.35)]">
              <Timer className="size-5" aria-hidden />
              {durationShort(rest).replace(" s", "s")}
              <span className="grid size-6 place-items-center rounded-full bg-black/20">
                <X className="size-3.5" strokeWidth={3} />
              </span>
            </button>
          </div>
        ) : null}

        {entries.map((e) => {
          const m = metaBy.get(e.uid);
          const isOpen = current === e.uid;
          const done = e.sets.length > 0 && e.sets.every((s) => s.done);
          const fields = fieldsFor(e.log);
          if (!isOpen) {
            return (
              <button key={e.uid} type="button" onClick={() => setOpen(e.uid)} className="tap flex min-h-[64px] items-center gap-3 rounded-[20px] bg-s1-surface-2 px-4 py-3 text-left hover:bg-s1-surface-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", done ? "bg-s1-green text-black" : "bg-s1-surface-3 text-s1-muted")} aria-hidden>
                  {done ? <Check className="size-4.5" strokeWidth={3} /> : <span className="num text-[13px] font-semibold">{e.sets.filter((s) => s.done).length}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[17px] font-semibold", done && "text-s1-muted")}>{e.name}</span>
                  <span className="block truncate text-[14px] text-s1-muted">
                    {m?.target}
                    {m?.last ? `. Last ${m.last}` : ""}
                  </span>
                </span>
              </button>
            );
          }
          return (
            <section key={e.uid} aria-label={e.name} className="flex flex-col gap-2 rounded-[24px] bg-s1-surface-2 p-3 pt-4 ring-1 ring-s1-blue/30">
              <div className="px-1">
                <h3 className="text-[20px] leading-6 font-bold tracking-tight">{e.name}</h3>
                <p className="mt-0.5 text-[14px] text-s1-muted">{m?.last ? `Last time ${m.last}` : `Target ${m?.target}`}</p>
                {m?.cues.length ? <p className="mt-1 text-[14px] font-medium text-s1-blue">{m.cues.join(" · ")}</p> : null}
                {m?.note ? <p className="mt-1 text-[14px] text-s1-pink">{m.note}</p> : null}
              </div>
              <div className="flex flex-col gap-1.5">
                {e.sets.map((s, i) => (
                  <SetRow
                    key={i}
                    index={i}
                    set={s}
                    fields={fields}
                    editing={editing && editing.uid === e.uid && editing.index === i ? editing.field : null}
                    onEdit={(f) => startEdit(e.uid, i, f)}
                    onToggle={() => toggleDone(e.uid, i)}
                  />
                ))}
              </div>
              <div className="flex justify-between px-1">
                <button type="button" onClick={() => w.removeSet(e.uid)} disabled={e.sets.length <= 1} className={btn({ variant: "plain", size: "sm", className: "text-s1-muted disabled:opacity-30" })}>
                  <Minus className="size-4" aria-hidden /> Remove set
                </button>
                <button type="button" onClick={() => w.addSet(e.uid)} className={btn({ variant: "plain", size: "sm" })}>
                  <Plus className="size-4" aria-hidden /> Add set
                </button>
              </div>
            </section>
          );
        })}
      </main>

      {editing && editingEntry ? (
        <Keypad
          label={`Set ${editing.index + 1} ${editing.field === "weight" ? "weight" : editing.field === "reps" ? "reps" : "time"}`}
          hint={metaBy.get(editing.uid)?.last ?? null}
          field={editing.field}
          onKey={key}
          onNudge={nudge}
          onClose={() => setEditing(null)}
          onLog={logSet}
          logLabel={`Log set ${editing.index + 1}`}
          onNextField={
            fieldsFor(editingEntry.log).indexOf(editing.field) === 0 && fieldsFor(editingEntry.log).length > 1
              ? () => startEdit(editing.uid, editing.index, fieldsFor(editingEntry.log)[1])
              : null
          }
        />
      ) : (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto max-w-md">
            <Button variant="primary" size="lg" block onClick={finish} disabled={pending} className="h-[58px] text-[18px]">
              {pending ? "Saving…" : "Finish workout"}
            </Button>
          </div>
        </div>
      )}

      <Sheet open={sheet === "end"} onOpenChange={(o) => setSheet(o ? "end" : null)} title="End workout?">
        <div className="flex flex-col gap-2.5">
          <Button variant="primary" size="lg" block onClick={() => { setSheet(null); finish(); }} disabled={pending}>
            Finish and save
          </Button>
          <Button variant="secondary" size="lg" block onClick={() => setSheet(null)}>
            Keep going
          </Button>
          <Button
            variant="danger"
            size="lg"
            block
            onClick={() => {
              w.discard();
              router.replace(`/app/workout/${dayId}`);
            }}
          >
            Discard this workout
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === "rest"} onOpenChange={(o) => setSheet(o ? "rest" : null)} title="Rest timer" description="Starts when you tick a set">
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 px-1 text-[13px] font-semibold text-s1-muted">Rest between sets</legend>
            <div className="grid grid-cols-3 gap-2">
              {PT_APP.restOptions.map((s) => (
                <button key={s} type="button" aria-pressed={w.restSeconds === s} onClick={() => w.setRest(s)} className={cn("tap num h-14 rounded-2xl text-[17px] font-semibold", w.restSeconds === s ? "bg-s1-blue text-s1-on-blue" : "bg-s1-surface-2 hover:bg-s1-surface-3")}>
                  {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center justify-between rounded-2xl bg-s1-surface-2 px-4 py-3">
            <span className="text-[17px] font-medium">Beep when rest is up</span>
            <Switch checked={w.beep} onChange={w.setBeep} label="Beep when rest is up" />
          </div>
          <Button variant="tinted" size="lg" block onClick={() => { w.startRest(); setSheet(null); }}>
            Start rest now
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={sheet === "note"}
        onOpenChange={(o) => setSheet(o ? "note" : null)}
        title="Note"
        description="Your coach sees this with the workout"
        left={
          <button type="button" onClick={() => setSheet(null)} className={btn({ variant: "plain", className: "font-medium text-s1-muted" })}>
            Cancel
          </button>
        }
        right={
          <button type="button" onClick={() => { w.setNote(note); setSheet(null); }} className={btn({ variant: "plain" })}>
            Save
          </button>
        }
      >
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} aria-label="Note" placeholder="How did it feel? Anything hurt?" className="w-full resize-none rounded-2xl bg-s1-surface-2 p-4 text-[16px] leading-6 outline-none ring-1 ring-s1-hairline placeholder:text-s1-faint focus:ring-2 focus:ring-s1-blue/60" />
      </Sheet>
    </div>
  );
}

function SetRow({ index, set, fields, editing, onEdit, onToggle }: { index: number; set: LoggedSet; fields: Field[]; editing: Field | null; onEdit: (f: Field) => void; onToggle: () => void }) {
  return (
    <div className={cn("grid items-center gap-2", fields.length === 2 ? "grid-cols-[32px_1fr_1fr_48px]" : "grid-cols-[32px_1fr_48px]")}>
      <span className={cn("num grid size-8 place-items-center rounded-full text-[14px] font-semibold", set.done ? "bg-s1-green-tint text-s1-green" : "bg-s1-surface-3 text-s1-muted")}>{index + 1}</span>
      {fields.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onEdit(f)}
          aria-label={`Set ${index + 1} ${f}`}
          className={cn(
            "tap num flex h-12 items-baseline justify-center gap-1 rounded-full text-[19px] font-semibold transition-colors",
            editing === f ? "bg-s1-blue text-s1-on-blue" : set.done ? "bg-s1-surface-3 text-white" : "bg-s1-surface-3 text-s1-muted",
          )}
        >
          {display(f, set[f])}
          <small className={cn("text-[12px] font-medium", editing === f ? "text-black/60" : "text-s1-faint")}>{UNIT[f]}</small>
        </button>
      ))}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={set.done}
        aria-label={set.done ? `Set ${index + 1} done, tap to undo` : `Tick set ${index + 1}`}
        className={cn("tap grid size-12 place-items-center rounded-full transition-colors", set.done ? "bg-s1-green text-black" : "bg-s1-surface-3 text-s1-muted hover:text-white")}
      >
        <Check className="size-5" strokeWidth={set.done ? 3 : 2.25} />
      </button>
    </div>
  );
}

function Keypad({
  label,
  hint,
  field,
  onKey,
  onNudge,
  onClose,
  onLog,
  logLabel,
  onNextField,
}: {
  label: string;
  hint: string | null;
  field: Field;
  onKey: (k: string) => void;
  onNudge: (d: -1 | 1) => void;
  onClose: () => void;
  onLog: () => void;
  logLabel: string;
  onNextField: (() => void) | null;
}) {
  const k = "tap grid h-[52px] place-items-center rounded-2xl bg-s1-surface-3 text-[22px] font-semibold active:bg-s1-surface-4";
  const fn = "tap grid h-[52px] place-items-center rounded-2xl bg-s1-surface-2 text-[17px] font-semibold text-s1-blue active:bg-s1-surface-3";
  return (
    <div role="group" aria-label="Number pad" className="s1-glass fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md rounded-t-[28px] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 [animation:s1-rise_.2s_ease-out]">
      <div className="mb-2.5 flex items-center justify-between px-2">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="flex items-center gap-2">
          {hint ? <span className="num max-w-[11rem] truncate text-[13px] text-s1-muted">Last {hint}</span> : null}
          <button type="button" onClick={onClose} aria-label="Close number pad" className="grid size-8 place-items-center rounded-full bg-s1-surface-3 text-s1-muted">
            <X className="size-4" />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {["1", "2", "3"].map((d) => (
          <button key={d} type="button" className={k} onClick={() => onKey(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={fn} onClick={() => onKey("del")} aria-label="Delete">
          <Delete className="size-6" />
        </button>
        {["4", "5", "6"].map((d) => (
          <button key={d} type="button" className={k} onClick={() => onKey(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={fn} onClick={() => onNudge(-1)}>
          −{field === "weight" ? kg(WEIGHT_STEP) : STEP[field]}
        </button>
        {["7", "8", "9"].map((d) => (
          <button key={d} type="button" className={k} onClick={() => onKey(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={fn} onClick={() => onNudge(1)}>
          +{field === "weight" ? kg(WEIGHT_STEP) : STEP[field]}
        </button>
        <button type="button" className={cn(k, field !== "weight" && "invisible")} onClick={() => onKey(".")} aria-label="Decimal point">
          .
        </button>
        <button type="button" className={k} onClick={() => onKey("0")}>
          0
        </button>
        {onNextField ? (
          <>
            <button type="button" className={fn} onClick={onNextField}>
              Reps
            </button>
            <button type="button" className="tap grid h-[52px] place-items-center rounded-2xl bg-s1-blue text-[16px] font-bold text-s1-on-blue" onClick={onLog}>
              Log
            </button>
          </>
        ) : (
          <button type="button" className="tap col-span-2 grid h-[52px] place-items-center rounded-2xl bg-s1-blue text-[17px] font-bold text-s1-on-blue" onClick={onLog}>
            {logLabel}
          </button>
        )}
      </div>
    </div>
  );
}
