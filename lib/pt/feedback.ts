import { addDays, type ISODate } from "@/lib/membership/dates";
import { clampInt } from "./library";
import { newId } from "./program";

/*
 * Daily feedback: the questions a client answers each day (steps, water, sleep…) and taps
 * Complete. The coach picks which questions are on and sets targets; answers save as the
 * client goes, so a half-filled day is never lost.
 */

export type QuestionType =
  /** free number with a unit: steps, bodyweight */
  | "number"
  /** pick one of a few values: water in litres */
  | "choice"
  /** − / + in fixed steps: sleep hours */
  | "stepper"
  /** 1 to 5, bad to great */
  | "rate"
  | "yesno"
  | "text";

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
  unit?: string;
  /** the coach's goal, shown to the client: 10,000 steps */
  target?: number;
  options?: number[];
  step?: number;
  min?: number;
  max?: number;
  /** decimals allowed for number answers */
  decimals?: number;
  enabled: boolean;
  builtin: boolean;
};

export type FeedbackSetup = { v: 1; questions: Question[] };
export type AnswerValue = number | boolean | string;
export type Answers = Record<string, AnswerValue>;

export const BUILTIN_QUESTIONS: Question[] = [
  { id: "steps", label: "Steps", type: "number", unit: "steps", target: 10000, min: 0, max: 100000, decimals: 0, enabled: true, builtin: true },
  { id: "water", label: "Water", type: "choice", unit: "L", target: 3, options: [1, 1.5, 2, 2.5, 3, 3.5], enabled: true, builtin: true },
  { id: "sleep", label: "Sleep", type: "stepper", unit: "h", step: 0.5, min: 0, max: 14, enabled: true, builtin: true },
  { id: "digestion", label: "Digestion", type: "rate", min: 1, max: 5, enabled: true, builtin: true },
  { id: "energy", label: "Energy", type: "rate", min: 1, max: 5, enabled: true, builtin: true },
  { id: "bodyweight", label: "Bodyweight", type: "number", unit: "kg", min: 20, max: 300, decimals: 1, enabled: true, builtin: true },
  { id: "hunger", label: "Hunger", type: "rate", min: 1, max: 5, enabled: false, builtin: true },
  { id: "stress", label: "Stress", type: "rate", min: 1, max: 5, enabled: false, builtin: true },
];

export const CUSTOM_TYPES: { id: Extract<QuestionType, "rate" | "number" | "yesno" | "text">; label: string }[] = [
  { id: "rate", label: "Rate 1 to 5" },
  { id: "number", label: "Number" },
  { id: "yesno", label: "Yes or no" },
  { id: "text", label: "Short answer" },
];

export function defaultSetup(): FeedbackSetup {
  return { v: 1, questions: BUILTIN_QUESTIONS.map((q) => ({ ...q })) };
}

export function activeQuestions(setup: FeedbackSetup): Question[] {
  return setup.questions.filter((q) => q.enabled);
}

/** What the coach sees under a question: "Target 10,000", "Rate 1 to 5", "kg". */
export function questionHint(q: Question): string {
  if (q.target != null && q.type === "number") return `Target ${q.target.toLocaleString("en-US")}`;
  if (q.target != null) return `Target ${q.target} ${q.unit ?? ""}`.trim();
  if (q.type === "rate") return "Rate 1 to 5";
  if (q.type === "stepper") return q.unit === "h" ? "Hours" : (q.unit ?? "");
  if (q.type === "yesno") return "Yes or no";
  if (q.type === "text") return "Short answer";
  return q.unit ?? "Number";
}

export function toggleQuestion(setup: FeedbackSetup, id: string, enabled: boolean): FeedbackSetup {
  return { ...setup, questions: setup.questions.map((q) => (q.id === id ? { ...q, enabled } : q)) };
}

export function setTarget(setup: FeedbackSetup, id: string, target: number | null): FeedbackSetup {
  return {
    ...setup,
    questions: setup.questions.map((q) => {
      if (q.id !== id) return q;
      if (target == null || !Number.isFinite(target)) return { ...q, target: undefined };
      return { ...q, target: q.type === "choice" ? target : clampNumber(target, q) };
    }),
  };
}

export function addQuestion(setup: FeedbackSetup, input: { label: string; type: string; unit?: string }, id = `q-${newId()}`): FeedbackSetup {
  const label = input.label?.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!label) throw new Error("Write the question.");
  const type = CUSTOM_TYPES.find((t) => t.id === input.type)?.id;
  if (!type) throw new Error("Pick an answer type.");
  if (setup.questions.length >= 16) throw new Error("That's the most questions a day can have.");
  const q: Question = {
    id,
    label,
    type,
    enabled: true,
    builtin: false,
    ...(type === "rate" ? { min: 1, max: 5 } : {}),
    ...(type === "number" ? { unit: input.unit?.trim().slice(0, 10) || undefined, min: 0, max: 100000, decimals: 1 } : {}),
  };
  return { ...setup, questions: [...setup.questions, q] };
}

export function removeQuestion(setup: FeedbackSetup, id: string): FeedbackSetup {
  return { ...setup, questions: setup.questions.filter((q) => q.id !== id || q.builtin) };
}

/** Keep only answers to switched-on questions, each checked against its type. */
export function sanitizeAnswers(setup: FeedbackSetup, raw: unknown): Answers {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Answers = {};
  for (const q of activeQuestions(setup)) {
    const v = src[q.id];
    if (v === undefined || v === null || v === "") continue;
    const clean = cleanAnswer(q, v);
    if (clean !== undefined) out[q.id] = clean;
  }
  return out;
}

export function cleanAnswer(q: Question, v: unknown): AnswerValue | undefined {
  switch (q.type) {
    case "yesno":
      return typeof v === "boolean" ? v : undefined;
    case "text":
      return typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined;
    case "rate": {
      const n = Number(v);
      return Number.isFinite(n) ? clampInt(n, q.min ?? 1, q.max ?? 5) : undefined;
    }
    case "choice": {
      const n = Number(v);
      return q.options?.includes(n) ? n : undefined;
    }
    default: {
      const n = Number(typeof v === "string" ? v.replace(/,/g, "") : v);
      return Number.isFinite(n) ? clampNumber(n, q) : undefined;
    }
  }
}

function clampNumber(n: number, q: Question): number {
  const step = q.step ?? (q.decimals ? 10 ** -q.decimals : 1);
  const snapped = Math.round(n / step) * step;
  const v = Math.min(q.max ?? Infinity, Math.max(q.min ?? -Infinity, snapped));
  return Number(v.toFixed(q.decimals ?? (q.step && q.step < 1 ? 1 : 0)));
}

export function answeredCount(setup: FeedbackSetup, answers: Answers): { answered: number; total: number } {
  const qs = activeQuestions(setup);
  return { answered: qs.filter((q) => answers[q.id] !== undefined).length, total: qs.length };
}

/** "8,420", "2.5 L", "7 h", "4 / 5", "Yes", "82.4 kg" */
export function formatAnswer(q: Question, v: AnswerValue | undefined): string {
  if (v === undefined) return "—";
  if (q.type === "yesno") return v ? "Yes" : "No";
  if (q.type === "text") return String(v);
  if (q.type === "rate") return `${v} / ${q.max ?? 5}`;
  const n = Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (q.id === "steps") return n;
  return q.unit ? `${n} ${q.unit}` : n;
}

/* ── over time ───────────────────────────────────────────── */

export type FeedbackDay = { date: ISODate; answers: Answers; completedAt: string | Date | null };

/** Average of a number answer over the last `days` days (today included), ignoring blanks. */
export function average(entries: FeedbackDay[], questionId: string, today: ISODate, days = 7): number | null {
  const from = addDays(today, -(days - 1));
  const vals = entries
    .filter((e) => e.date >= from && e.date <= today)
    .map((e) => Number(e.answers[questionId]))
    .filter((n) => Number.isFinite(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Most recent answer, e.g. the latest bodyweight. */
export function latest(entries: FeedbackDay[], questionId: string): { date: ISODate; value: number } | null {
  const hit = [...entries].sort((a, b) => b.date.localeCompare(a.date)).find((e) => Number.isFinite(Number(e.answers[questionId])));
  return hit ? { date: hit.date, value: Number(hit.answers[questionId]) } : null;
}

export type DayStatus = "complete" | "started" | "missing";

export function dayStatus(entry: FeedbackDay | undefined): DayStatus {
  if (!entry) return "missing";
  if (entry.completedAt) return "complete";
  return Object.keys(entry.answers).length ? "started" : "missing";
}

/** Days in a row with feedback completed, counting back from today (or yesterday if today isn't done yet). */
export function streak(entries: FeedbackDay[], today: ISODate): number {
  const done = new Set(entries.filter((e) => e.completedAt).map((e) => e.date));
  let day = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function sanitizeSetup(input: unknown): FeedbackSetup {
  const src = input as { questions?: unknown };
  if (!src || !Array.isArray(src.questions)) throw new Error("Those questions couldn't be read.");
  const questions: Question[] = [];
  const seen = new Set<string>();
  for (const raw of src.questions.slice(0, 16) as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const builtin = BUILTIN_QUESTIONS.find((b) => b.id === raw.id);
    if (builtin) {
      const q = { ...builtin, enabled: raw.enabled === true };
      const target = Number(raw.target);
      questions.push(raw.target != null && Number.isFinite(target) ? (setTarget({ v: 1, questions: [q] }, q.id, target).questions[0]) : { ...q, target: undefined });
      continue;
    }
    try {
      const added = addQuestion({ v: 1, questions: [] }, { label: String(raw.label ?? ""), type: String(raw.type ?? ""), unit: typeof raw.unit === "string" ? raw.unit : undefined }, raw.id.slice(0, 24));
      questions.push({ ...added.questions[0], enabled: raw.enabled !== false });
    } catch {
      /* skip unusable custom questions */
    }
  }
  // built-ins always present so they can be switched back on
  for (const b of BUILTIN_QUESTIONS) if (!seen.has(b.id)) questions.push({ ...b, enabled: false });
  return { v: 1, questions };
}
