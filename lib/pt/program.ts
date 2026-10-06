import { clampInt, type Cue, type LibraryExercise, type LogKind } from "./library";

/*
 * A client's workout: gym days ("Chest and Back #1", "Legs"…), each a list of exercises
 * with a target per set. Stored as one JSON document per client (pt_plans.doc), edited by
 * the coach, read by the client app. Every edit is a pure function returning a new plan,
 * so the editor, the server and the tests share the same rules.
 */

export type SetTarget = { reps?: number; seconds?: number };

/** A cue as shown to the client. Text is copied in so a template or old plan never loses it. */
export type PlanCue = { id: string; en: string; th?: string };

export type PlanExercise = {
  /** unique within the plan */
  uid: string;
  exerciseId: string;
  name: string;
  log: LogKind;
  sets: SetTarget[];
  cues: PlanCue[];
  note?: string;
};

export type WorkoutDay = { id: string; name: string; exercises: PlanExercise[] };

export type WorkoutPlan = { v: 1; days: WorkoutDay[] };

export const LIMITS = { days: 14, exercises: 30, sets: 10, cues: 4, name: 40, note: 280, reps: 100, seconds: 7200 } as const;

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

export const emptyPlan = (): WorkoutPlan => ({ v: 1, days: [] });

/* ── reading ─────────────────────────────────────────────── */

/** "8", "45 s", "20 min", "1 min 30 s" */
export function targetLabel(log: LogKind, t: SetTarget): string {
  if (log === "time") return durationLabel(t.seconds ?? 0);
  return String(t.reps ?? 0);
}

export function durationLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

export function isUniform(ex: Pick<PlanExercise, "sets">): boolean {
  const [first, ...rest] = ex.sets;
  return !!first && rest.every((s) => s.reps === first.reps && s.seconds === first.seconds);
}

/** "4 × 8", "12, 10, 8, 8", "3 × 45 s", "20 min" (one timed set) */
export function exerciseSummary(ex: Pick<PlanExercise, "sets" | "log">): string {
  if (!ex.sets.length) return "No sets";
  if (ex.log === "time" && ex.sets.length === 1) return targetLabel(ex.log, ex.sets[0]);
  if (isUniform(ex)) return `${ex.sets.length} × ${targetLabel(ex.log, ex.sets[0])}`;
  return ex.sets.map((s) => targetLabel(ex.log, s).replace(" ", "")).join(", ");
}

export function daySummary(day: WorkoutDay): string {
  const n = day.exercises.length;
  return n === 1 ? "1 exercise" : `${n} exercises`;
}

export function totalSets(day: WorkoutDay): number {
  return day.exercises.reduce((a, e) => a + e.sets.length, 0);
}

export function findDay(plan: WorkoutPlan, dayId: string): WorkoutDay | undefined {
  return plan.days.find((d) => d.id === dayId);
}

/* ── days ────────────────────────────────────────────────── */

export function addDay(plan: WorkoutPlan, name?: string, id = newId()): WorkoutPlan {
  if (plan.days.length >= LIMITS.days) return plan;
  const label = cleanName(name) || nextDayName(plan);
  return { ...plan, days: [...plan.days, { id, name: label, exercises: [] }] };
}

export function nextDayName(plan: WorkoutPlan): string {
  return `Day ${plan.days.length + 1}`;
}

export function renameDay(plan: WorkoutPlan, dayId: string, name: string): WorkoutPlan {
  const label = cleanName(name);
  if (!label) return plan;
  return mapDay(plan, dayId, (d) => ({ ...d, name: label }));
}

export function removeDay(plan: WorkoutPlan, dayId: string): WorkoutPlan {
  return { ...plan, days: plan.days.filter((d) => d.id !== dayId) };
}

export function duplicateDay(plan: WorkoutPlan, dayId: string, id = newId()): WorkoutPlan {
  const i = plan.days.findIndex((d) => d.id === dayId);
  if (i < 0 || plan.days.length >= LIMITS.days) return plan;
  const src = plan.days[i];
  const copy: WorkoutDay = {
    id,
    name: cleanName(`${src.name} copy`),
    exercises: src.exercises.map((e) => ({ ...e, uid: newId(), sets: e.sets.map((s) => ({ ...s })), cues: [...e.cues] })),
  };
  return { ...plan, days: [...plan.days.slice(0, i + 1), copy, ...plan.days.slice(i + 1)] };
}

export function moveDay(plan: WorkoutPlan, dayId: string, dir: -1 | 1): WorkoutPlan {
  return { ...plan, days: move(plan.days, plan.days.findIndex((d) => d.id === dayId), dir) };
}

/* ── exercises ───────────────────────────────────────────── */

/** A library exercise as it starts in a workout: the library default for every set. */
export function fromLibrary(ex: LibraryExercise, uid = newId()): PlanExercise {
  const sets = clampInt(ex.default.sets, 1, LIMITS.sets);
  const target: SetTarget =
    ex.log === "time"
      ? { seconds: clampInt(ex.default.seconds ?? (ex.default.minutes ?? 1) * 60, 5, LIMITS.seconds) }
      : { reps: clampInt(ex.default.reps ?? 10, 1, LIMITS.reps) };
  return { uid, exerciseId: ex.id, name: ex.name, log: ex.log, sets: Array.from({ length: sets }, () => ({ ...target })), cues: [] };
}

export function addExercises(plan: WorkoutPlan, dayId: string, list: LibraryExercise[]): WorkoutPlan {
  return mapDay(plan, dayId, (d) => ({
    ...d,
    exercises: [...d.exercises, ...list.map((e) => fromLibrary(e))].slice(0, LIMITS.exercises),
  }));
}

export function updateExercise(plan: WorkoutPlan, dayId: string, uid: string, fn: (e: PlanExercise) => PlanExercise): WorkoutPlan {
  return mapDay(plan, dayId, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.uid === uid ? fn(e) : e)) }));
}

export function removeExercise(plan: WorkoutPlan, dayId: string, uid: string): WorkoutPlan {
  return mapDay(plan, dayId, (d) => ({ ...d, exercises: d.exercises.filter((e) => e.uid !== uid) }));
}

export function moveExercise(plan: WorkoutPlan, dayId: string, uid: string, dir: -1 | 1): WorkoutPlan {
  return mapDay(plan, dayId, (d) => ({ ...d, exercises: move(d.exercises, d.exercises.findIndex((e) => e.uid === uid), dir) }));
}

/** More sets copy the last one; fewer drop from the end. */
export function setSetCount(ex: PlanExercise, count: number): PlanExercise {
  const n = clampInt(count, 1, LIMITS.sets);
  const last = ex.sets.at(-1) ?? (ex.log === "time" ? { seconds: 60 } : { reps: 10 });
  const sets = n <= ex.sets.length ? ex.sets.slice(0, n) : [...ex.sets, ...Array.from({ length: n - ex.sets.length }, () => ({ ...last }))];
  return { ...ex, sets };
}

/** One target for every set ("Same for all sets"). */
export function setAllTargets(ex: PlanExercise, value: number): PlanExercise {
  const t = clampTarget(ex.log, value);
  return { ...ex, sets: ex.sets.map(() => ({ ...t })) };
}

/** Edit one set ("Edit each set"). */
export function setTargetAt(ex: PlanExercise, index: number, value: number): PlanExercise {
  if (index < 0 || index >= ex.sets.length) return ex;
  const t = clampTarget(ex.log, value);
  return { ...ex, sets: ex.sets.map((s, i) => (i === index ? { ...t } : s)) };
}

/** The number a stepper shows and changes: reps, or seconds for timed work. */
export function targetValue(log: LogKind, t: SetTarget | undefined): number {
  return log === "time" ? (t?.seconds ?? 60) : (t?.reps ?? 10);
}

/** Stepper increments: 1 rep; 5 s under a minute, 15 s under 5 min, then a minute. */
export function stepTarget(log: LogKind, value: number, dir: -1 | 1): number {
  if (log !== "time") return clampInt(value + dir, 1, LIMITS.reps);
  const step = (v: number) => (v < 60 ? 5 : v < 300 ? 15 : 60);
  const next = dir > 0 ? value + step(value) : value - step(value - 1);
  return clampInt(next, 5, LIMITS.seconds);
}

export function toggleCue(ex: PlanExercise, cue: Pick<Cue, "id" | "en"> & { th?: string }): PlanExercise {
  const has = ex.cues.some((c) => c.id === cue.id);
  if (has) return { ...ex, cues: ex.cues.filter((c) => c.id !== cue.id) };
  if (ex.cues.length >= LIMITS.cues) return ex;
  return { ...ex, cues: [...ex.cues, { id: cue.id, en: cue.en, th: cue.th || undefined }] };
}

export function setNote(ex: PlanExercise, note: string): PlanExercise {
  const v = note.trim().slice(0, LIMITS.note);
  return { ...ex, note: v || undefined };
}

/* ── validation (anything arriving from a browser) ───────── */

/**
 * Rebuild a plan from untrusted JSON: unknown fields dropped, numbers clamped,
 * lengths capped. Throws only when the shape is unusable.
 */
export function sanitizePlan(input: unknown): WorkoutPlan {
  const src = input as { days?: unknown };
  if (!src || typeof src !== "object" || !Array.isArray(src.days)) throw new Error("That workout couldn't be read.");
  const seenDays = new Set<string>();
  const days: WorkoutDay[] = [];
  for (const d of src.days.slice(0, LIMITS.days) as Record<string, unknown>[]) {
    if (!d || typeof d !== "object") continue;
    let id = str(d.id, 24) || newId();
    if (seenDays.has(id)) id = newId();
    seenDays.add(id);
    const seenEx = new Set<string>();
    const exercises: PlanExercise[] = [];
    for (const e of (Array.isArray(d.exercises) ? d.exercises : []).slice(0, LIMITS.exercises) as Record<string, unknown>[]) {
      if (!e || typeof e !== "object") continue;
      const name = str(e.name, 60);
      const exerciseId = str(e.exerciseId, 80);
      if (!name || !exerciseId) continue;
      const log: LogKind = e.log === "time" || e.log === "reps" ? e.log : "weight_reps";
      let uid = str(e.uid, 24) || newId();
      if (seenEx.has(uid)) uid = newId();
      seenEx.add(uid);
      const sets = (Array.isArray(e.sets) ? e.sets : [])
        .slice(0, LIMITS.sets)
        .map((s: Record<string, unknown>) => clampTarget(log, Number(log === "time" ? s?.seconds : s?.reps)));
      if (!sets.length) sets.push(clampTarget(log, log === "time" ? 60 : 10));
      const cues = (Array.isArray(e.cues) ? e.cues : [])
        .slice(0, LIMITS.cues)
        .map((c: Record<string, unknown>) => ({ id: str(c?.id, 80), en: str(c?.en, 80), th: str(c?.th, 80) || undefined }))
        .filter((c: PlanCue) => c.id && c.en);
      const note = str(e.note, LIMITS.note);
      exercises.push({ uid, exerciseId, name, log, sets, cues, ...(note ? { note } : {}) });
    }
    days.push({ id, name: cleanName(str(d.name, LIMITS.name)) || `Day ${days.length + 1}`, exercises });
  }
  return { v: 1, days };
}

/* ── what changed (for the client's "updated" notice) ────── */

export function diffPlans(before: WorkoutPlan | null, after: WorkoutPlan): string[] {
  const out: string[] = [];
  const prev = new Map((before?.days ?? []).map((d) => [d.id, d]));
  for (const d of after.days) {
    const old = prev.get(d.id);
    if (!old) {
      out.push(`New day: ${d.name}`);
      continue;
    }
    if (old.name !== d.name) out.push(`${old.name} is now ${d.name}`);
    const oldEx = new Map(old.exercises.map((e) => [e.uid, e]));
    const added = d.exercises.filter((e) => !oldEx.has(e.uid));
    const removed = old.exercises.filter((e) => !d.exercises.some((x) => x.uid === e.uid));
    if (added.length) out.push(`${d.name}: added ${list(added.map((e) => e.name))}`);
    if (removed.length) out.push(`${d.name}: removed ${list(removed.map((e) => e.name))}`);
    for (const e of d.exercises) {
      const o = oldEx.get(e.uid);
      if (!o) continue;
      const a = exerciseSummary(o);
      const b = exerciseSummary(e);
      if (a !== b) out.push(`${e.name}: ${a} → ${b}`);
      else if (JSON.stringify(o.cues) !== JSON.stringify(e.cues) || (o.note ?? "") !== (e.note ?? "")) out.push(`${e.name}: new coaching notes`);
    }
    const order = (x: WorkoutDay) => x.exercises.map((e) => e.uid).filter((u) => old.exercises.some((o) => o.uid === u) && d.exercises.some((n) => n.uid === u)).join();
    if (!added.length && !removed.length && order(old) !== order(d)) out.push(`${d.name}: new order`);
  }
  for (const d of before?.days ?? []) if (!after.days.some((x) => x.id === d.id)) out.push(`Removed day: ${d.name}`);
  return out;
}

/* ── helpers ─────────────────────────────────────────────── */

/** Clamp into range; a missing or unreadable value falls back to a sensible default. */
function clampTarget(log: LogKind, value: number): SetTarget {
  const ok = Number.isFinite(value);
  return log === "time" ? { seconds: clampInt(ok ? value : 60, 5, LIMITS.seconds) } : { reps: clampInt(ok ? value : 10, 1, LIMITS.reps) };
}

function mapDay(plan: WorkoutPlan, dayId: string, fn: (d: WorkoutDay) => WorkoutDay): WorkoutPlan {
  return { ...plan, days: plan.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function cleanName(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.name);
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function list(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}
