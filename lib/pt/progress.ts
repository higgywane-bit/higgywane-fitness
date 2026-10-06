import type { LogKind } from "./library";
import { LIMITS, type PlanExercise, type WorkoutDay } from "./program";

/*
 * What the client logged in the gym, and everything worked out from it: "last time",
 * volume lifted, best sets, "up on last time". Pure functions over plain data so the
 * live workout screen, the done screen, history and the coach all agree.
 */

export type LoggedSet = { weight?: number | null; reps?: number | null; seconds?: number | null; done: boolean };

export type LoggedExercise = {
  uid: string;
  exerciseId: string;
  name: string;
  log: LogKind;
  sets: LoggedSet[];
};

export type WorkoutLog = {
  dayId: string;
  dayName: string;
  startedAt: string;
  finishedAt: string;
  entries: LoggedExercise[];
  note?: string;
};

/** A finished workout as read back from the database, newest first in lists. */
export type PastWorkout = WorkoutLog & { id: string };

export const WEIGHT_STEP = 2.5;
const MAX_WEIGHT = 1000;

export function doneSets(e: Pick<LoggedExercise, "sets">): LoggedSet[] {
  return e.sets.filter((s) => s.done);
}

/** kg × reps for a done weighted set; 0 for anything else. */
export function setVolume(s: LoggedSet): number {
  return s.done && s.weight && s.reps ? s.weight * s.reps : 0;
}

export function workoutVolume(w: Pick<WorkoutLog, "entries">): number {
  return round1(w.entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + setVolume(s), 0), 0));
}

export function setsDone(w: Pick<WorkoutLog, "entries">): number {
  return w.entries.reduce((a, e) => a + doneSets(e).length, 0);
}

export function exercisesDone(w: Pick<WorkoutLog, "entries">): number {
  return w.entries.filter((e) => e.sets.length > 0 && e.sets.every((s) => s.done)).length;
}

/** Heaviest done set (most reps breaks a tie); for bodyweight, most reps; for time, longest. */
export function bestSet(e: Pick<LoggedExercise, "sets" | "log">): LoggedSet | null {
  const done = doneSets(e);
  if (!done.length) return null;
  const score = (s: LoggedSet) =>
    e.log === "weight_reps" ? (s.weight ?? 0) * 10_000 + (s.reps ?? 0) : e.log === "reps" ? (s.reps ?? 0) : (s.seconds ?? 0);
  return done.reduce((best, s) => (score(s) > score(best) ? s : best));
}

/** The most recent workout containing this exercise, and its done sets. */
export function lastTime(history: PastWorkout[], exerciseId: string): { at: string; sets: LoggedSet[]; log: LogKind } | null {
  for (const w of history) {
    const e = w.entries.find((x) => x.exerciseId === exerciseId && doneSets(x).length);
    if (e) return { at: w.finishedAt, sets: doneSets(e), log: e.log };
  }
  return null;
}

export function kg(n: number | null | undefined): string {
  if (n == null) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

/** "80 kg × 8", "12 reps", "45 s" */
export function setLabel(log: LogKind, s: LoggedSet): string {
  if (log === "time") return durationShort(s.seconds ?? 0);
  if (log === "reps" || !s.weight) return `${s.reps ?? 0} reps`;
  return `${kg(s.weight)} kg × ${s.reps ?? 0}`;
}

/** "70 kg × 10, 10, 9, 8" when the weight held; "70 × 10, 72.5 × 8" when it changed. */
export function setsLabel(log: LogKind, sets: LoggedSet[]): string {
  if (!sets.length) return "";
  if (log === "time") return sets.map((s) => durationShort(s.seconds ?? 0)).join(", ");
  if (log === "reps") return `${sets.map((s) => s.reps ?? 0).join(", ")} reps`;
  const same = sets.every((s) => s.weight === sets[0].weight);
  if (same) return `${kg(sets[0].weight)} kg × ${sets.map((s) => s.reps ?? 0).join(", ")}`;
  return sets.map((s) => `${kg(s.weight)} × ${s.reps ?? 0}`).join(", ");
}

export function durationShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, "0")}` : `${m} min`;
}

/**
 * Start a workout from the plan: one row per planned set, reps (or time) from the
 * coach's target and weight from the same set last time (or the last set done).
 */
export function startEntries(day: WorkoutDay, history: PastWorkout[]): LoggedExercise[] {
  return day.exercises.map((ex) => ({
    uid: ex.uid,
    exerciseId: ex.exerciseId,
    name: ex.name,
    log: ex.log,
    sets: prefill(ex, lastTime(history, ex.exerciseId)?.sets ?? []),
  }));
}

function prefill(ex: PlanExercise, last: LoggedSet[]): LoggedSet[] {
  return ex.sets.map((t, i) => {
    const prev = last[i] ?? last.at(-1);
    if (ex.log === "time") return { seconds: t.seconds ?? prev?.seconds ?? 60, done: false };
    if (ex.log === "reps") return { reps: t.reps ?? null, done: false };
    return { weight: prev?.weight ?? null, reps: t.reps ?? null, done: false };
  });
}

export type Improvement = { exerciseId: string; name: string; best: LoggedSet; log: LogKind; delta: number; unit: "kg" | "reps" | "s" };

/** Exercises where today's best set beat last time's best set. */
export function improvements(current: Pick<WorkoutLog, "entries">, history: PastWorkout[]): Improvement[] {
  const out: Improvement[] = [];
  for (const e of current.entries) {
    const best = bestSet(e);
    const prev = lastTime(history, e.exerciseId);
    if (!best || !prev) continue;
    const prevBest = bestSet({ log: e.log, sets: prev.sets });
    if (!prevBest) continue;
    if (e.log === "weight_reps" && (best.weight ?? 0) > (prevBest.weight ?? 0)) {
      out.push({ exerciseId: e.exerciseId, name: e.name, best, log: e.log, delta: round1((best.weight ?? 0) - (prevBest.weight ?? 0)), unit: "kg" });
    } else if (e.log === "weight_reps" && best.weight === prevBest.weight && (best.reps ?? 0) > (prevBest.reps ?? 0)) {
      out.push({ exerciseId: e.exerciseId, name: e.name, best, log: e.log, delta: (best.reps ?? 0) - (prevBest.reps ?? 0), unit: "reps" });
    } else if (e.log === "reps" && (best.reps ?? 0) > (prevBest.reps ?? 0)) {
      out.push({ exerciseId: e.exerciseId, name: e.name, best, log: e.log, delta: (best.reps ?? 0) - (prevBest.reps ?? 0), unit: "reps" });
    } else if (e.log === "time" && (best.seconds ?? 0) > (prevBest.seconds ?? 0)) {
      out.push({ exerciseId: e.exerciseId, name: e.name, best, log: e.log, delta: (best.seconds ?? 0) - (prevBest.seconds ?? 0), unit: "s" });
    }
  }
  return out;
}

export function deltaLabel(i: Pick<Improvement, "delta" | "unit">): string {
  return i.unit === "kg" ? `+${kg(i.delta)} kg` : i.unit === "reps" ? `+${i.delta} rep${i.delta === 1 ? "" : "s"}` : `+${i.delta} s`;
}

/* ── history for one gym day ─────────────────────────────── */

export type DayHistory = {
  count: number;
  /** oldest → newest, for the chart */
  series: { at: string; volume: number }[];
  /** per exercise in the current plan: best set ever on this day and how far it moved since the first time */
  best: { exerciseId: string; name: string; log: LogKind; best: LoggedSet; delta: number | null; unit: "kg" | "reps" | "s" }[];
  sessions: { id: string; at: string; volume: number; sets: number }[];
};

export function dayHistory(day: WorkoutDay, history: PastWorkout[]): DayHistory {
  const mine = history.filter((w) => w.dayId === day.id).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const best: DayHistory["best"] = [];
  for (const ex of day.exercises) {
    const hits = mine.map((w) => w.entries.find((e) => e.exerciseId === ex.exerciseId)).filter((e): e is LoggedExercise => !!e && doneSets(e).length > 0);
    if (!hits.length) continue;
    const bests = hits.map((h) => bestSet(h)!);
    const top = bestSet({ log: ex.log, sets: bests })!;
    const first = bests[0];
    const unit = ex.log === "weight_reps" ? "kg" : ex.log === "reps" ? "reps" : "s";
    const value = (s: LoggedSet) => (unit === "kg" ? (s.weight ?? 0) : unit === "reps" ? (s.reps ?? 0) : (s.seconds ?? 0));
    const delta = hits.length > 1 ? round1(value(top) - value(first)) : null;
    best.push({ exerciseId: ex.exerciseId, name: ex.name, log: ex.log, best: top, delta, unit });
  }
  return {
    count: mine.length,
    series: mine.map((w) => ({ at: w.finishedAt, volume: workoutVolume(w) })),
    best,
    sessions: [...mine].reverse().map((w) => ({ id: w.id, at: w.finishedAt, volume: workoutVolume(w), sets: setsDone(w) })),
  };
}

/** One-line headline for a day card: "Done 6 times. Bench press up 7.5 kg since 24 Aug". */
export function dayHeadline(h: DayHistory): string {
  if (!h.count) return "Not done yet";
  const times = h.count === 1 ? "Done once" : `Done ${h.count} times`;
  const top = h.best.filter((b) => b.delta && b.delta > 0 && b.unit === "kg").sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0];
  return top ? `${times}. ${top.name} up ${kg(top.delta)} kg` : times;
}

/* ── validation ──────────────────────────────────────────── */

export function sanitizeLog(input: unknown): WorkoutLog {
  const src = input as Record<string, unknown>;
  if (!src || typeof src !== "object" || !Array.isArray(src.entries)) throw new Error("That workout couldn't be read.");
  const started = new Date(String(src.startedAt));
  const finished = new Date(String(src.finishedAt));
  if (Number.isNaN(started.getTime()) || Number.isNaN(finished.getTime())) throw new Error("Workout times are missing.");
  const entries: LoggedExercise[] = [];
  for (const e of src.entries.slice(0, LIMITS.exercises) as Record<string, unknown>[]) {
    if (!e || typeof e !== "object" || typeof e.exerciseId !== "string" || typeof e.name !== "string") continue;
    const log: LogKind = e.log === "time" || e.log === "reps" ? e.log : "weight_reps";
    const sets = (Array.isArray(e.sets) ? e.sets : []).slice(0, LIMITS.sets + 5).map((s: Record<string, unknown>) => ({
      weight: log === "weight_reps" ? num(s?.weight, 0, MAX_WEIGHT, 2) : null,
      reps: log !== "time" ? num(s?.reps, 0, 500, 0) : null,
      seconds: log === "time" ? num(s?.seconds, 0, 6 * 3600, 0) : null,
      done: s?.done === true,
    }));
    entries.push({ uid: String(e.uid ?? "").slice(0, 24), exerciseId: e.exerciseId.slice(0, 80), name: e.name.slice(0, 60), log, sets });
  }
  const note = typeof src.note === "string" ? src.note.trim().slice(0, 500) : "";
  return {
    dayId: String(src.dayId ?? "").slice(0, 24),
    dayName: String(src.dayName ?? "Workout").slice(0, 40),
    startedAt: started.toISOString(),
    finishedAt: (finished < started ? started : finished).toISOString(),
    entries,
    ...(note ? { note } : {}),
  };
}

function num(v: unknown, min: number, max: number, decimals: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** decimals;
  return Math.min(max, Math.max(min, Math.round(n * f) / f));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
