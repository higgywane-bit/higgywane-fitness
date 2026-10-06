import raw from "@/content/pt-library.json";

/*
 * The PT exercise library and coaching cues (content/pt-library.json), typed.
 * Every coach starts with these; custom exercises and cues are stored per coach in
 * the database (pt_library_items) and merged on top with mergeLibrary().
 */

export type Lang = "en" | "th";
export type LogKind = "weight_reps" | "reps" | "time";
export type GroupId = "chest" | "back" | "shoulders" | "arms" | "legs" | "glutes" | "core" | "cardio";
export type CueGroupId = "form" | "tempo" | "effort";

export type Group = { id: GroupId; en: string; th: string };
export type CueGroup = { id: CueGroupId; en: string; th: string };

/** What a new exercise starts with in a workout: every set gets the same target. */
export type ExerciseDefault = { sets: number; reps?: number; seconds?: number; minutes?: number };

export type LibraryExercise = {
  id: string;
  name: string;
  group: GroupId;
  muscle: string;
  equipment: string;
  log: LogKind;
  default: ExerciseDefault;
  /** added by a coach, not in the shared library */
  custom?: boolean;
};

export type Cue = { id: string; group: CueGroupId; en: string; th: string; custom?: boolean };

export const LOG_KINDS: Record<LogKind, string> = {
  weight_reps: "Weight and reps",
  reps: "Reps only",
  time: "Time",
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const GROUPS = raw.groups as Group[];
export const CUE_GROUPS = raw.cue_groups as CueGroup[];
export const EQUIPMENT = raw.equipment as string[];
export const EXERCISES = raw.exercises as LibraryExercise[];
export const CUES: Cue[] = (raw.cues as Omit<Cue, "id">[]).map((c) => ({ ...c, id: slugify(c.en) }));

export function groupLabel(id: string, lang: Lang = "en"): string {
  const g = GROUPS.find((x) => x.id === id);
  return g ? g[lang] : id;
}

export function cueGroupLabel(id: string, lang: Lang = "en"): string {
  const g = CUE_GROUPS.find((x) => x.id === id);
  return g ? g[lang] : id;
}

export function cueText(cue: { en: string; th?: string | null }, lang: Lang = "en"): string {
  return lang === "th" && cue.th ? cue.th : cue.en;
}

/** Shared library plus a coach's own exercises and cues. Custom items with a clashing id are ignored. */
export function mergeLibrary(custom: { exercises?: LibraryExercise[]; cues?: Cue[] } = {}) {
  const exIds = new Set(EXERCISES.map((e) => e.id));
  const cueIds = new Set(CUES.map((c) => c.id));
  const exercises = [...EXERCISES, ...(custom.exercises ?? []).filter((e) => !exIds.has(e.id)).map((e) => ({ ...e, custom: true }))];
  const cues = [...CUES, ...(custom.cues ?? []).filter((c) => !cueIds.has(c.id)).map((c) => ({ ...c, custom: true }))];
  return { exercises, cues };
}

export function findExercise(id: string, list: LibraryExercise[] = EXERCISES): LibraryExercise | undefined {
  return list.find((e) => e.id === id);
}

/** Exercises grouped in library order, for the coach's picker. */
export function byGroup(list: LibraryExercise[] = EXERCISES): { group: Group; exercises: LibraryExercise[] }[] {
  return GROUPS.map((group) => ({ group, exercises: list.filter((e) => e.group === group.id) }));
}

/** Search by name, muscle or equipment; every word must match somewhere. */
export function searchExercises(query: string, list: LibraryExercise[] = EXERCISES): LibraryExercise[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((e) => {
    const hay = `${e.name} ${e.muscle} ${e.equipment} ${e.group}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Validate a coach's custom exercise before it's stored. */
export function customExercise(input: {
  name: string;
  group: string;
  equipment?: string;
  muscle?: string;
  log: string;
  sets?: number;
  reps?: number;
  seconds?: number;
}): LibraryExercise {
  const name = input.name?.trim().slice(0, 60);
  if (!name) throw new Error("Give the exercise a name.");
  if (!GROUPS.some((g) => g.id === input.group)) throw new Error("Pick a body part.");
  if (!(input.log in LOG_KINDS)) throw new Error("Pick how it's logged.");
  const log = input.log as LogKind;
  const sets = clampInt(input.sets ?? 3, 1, 10);
  const target = log === "time" ? { seconds: clampInt(input.seconds ?? 60, 5, 7200) } : { reps: clampInt(input.reps ?? 10, 1, 100) };
  return {
    id: `custom-${slugify(name)}`,
    name,
    group: input.group as GroupId,
    muscle: input.muscle?.trim().slice(0, 40) || groupLabel(input.group),
    equipment: EQUIPMENT.includes(input.equipment ?? "") ? input.equipment! : "Bodyweight",
    log,
    default: { sets, ...target },
    custom: true,
  };
}

export function customCue(input: { group: string; en: string; th?: string }): Cue {
  const en = input.en?.trim().slice(0, 80);
  if (!en) throw new Error("Write the cue.");
  if (!CUE_GROUPS.some((g) => g.id === input.group)) throw new Error("Pick a cue group.");
  return { id: `custom-${slugify(en)}`, group: input.group as CueGroupId, en, th: input.th?.trim().slice(0, 80) || "", custom: true };
}

export function clampInt(n: number, min: number, max: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}
