import { describe, expect, it } from "vitest";
import { clientRowParts, initials, sectionOf, visibilityOf } from "@/lib/pt/clients";
import { addFood, addMeal, diffDiet, emptyDiet, kcalOf, macroSplit, mealSummary, sanitizeDiet, stepMacro } from "@/lib/pt/diet";
import {
  activeQuestions,
  addQuestion,
  answeredCount,
  average,
  defaultSetup,
  formatAnswer,
  latest,
  sanitizeAnswers,
  sanitizeSetup,
  streak,
  toggleQuestion,
  type FeedbackDay,
} from "@/lib/pt/feedback";
import { CUES, EXERCISES, findExercise, GROUPS, mergeLibrary, searchExercises, customExercise } from "@/lib/pt/library";
import {
  addDay,
  addExercises,
  diffPlans,
  emptyPlan,
  exerciseSummary,
  fromLibrary,
  moveExercise,
  removeExercise,
  sanitizePlan,
  setAllTargets,
  setSetCount,
  setTargetAt,
  stepTarget,
  toggleCue,
  updateExercise,
  type WorkoutPlan,
} from "@/lib/pt/program";
import { bestSet, dayHeadline, dayHistory, improvements, sanitizeLog, setsLabel, startEntries, workoutVolume, type PastWorkout } from "@/lib/pt/progress";

const ex = (id: string) => findExercise(id)!;

describe("library", () => {
  it("loads the owner's library", () => {
    expect(GROUPS.map((g) => g.id)).toEqual(["chest", "back", "shoulders", "arms", "legs", "glutes", "core", "cardio"]);
    expect(EXERCISES).toHaveLength(107);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(CUES).toHaveLength(30);
    expect(CUES[0]).toMatchObject({ id: "squeeze-at-the-top", group: "form", th: "บีบค้างที่จุดบนสุด" });
  });

  it("searches by name, muscle and equipment", () => {
    expect(searchExercises("incline dumbbell").map((e) => e.id)).toEqual(["incline-dumbbell-press", "incline-dumbbell-curl"]);
    expect(searchExercises("rear delts").map((e) => e.id)).toEqual(["rear-delt-fly", "reverse-pec-deck", "face-pull"]);
    expect(searchExercises("").length).toBe(EXERCISES.length);
  });

  it("adds custom exercises without overriding the library", () => {
    const mine = customExercise({ name: "Sissy squat", group: "legs", log: "reps", sets: 3, reps: 12 });
    expect(mine).toMatchObject({ id: "custom-sissy-squat", log: "reps", default: { sets: 3, reps: 12 }, custom: true });
    const merged = mergeLibrary({ exercises: [mine, { ...mine, id: "deadlift" }] });
    expect(merged.exercises).toHaveLength(EXERCISES.length + 1);
    expect(() => customExercise({ name: " ", group: "legs", log: "reps" })).toThrow();
  });
});

describe("workout plan", () => {
  const base = (): WorkoutPlan => {
    let p = addDay(emptyPlan(), "Chest and Back #1", "d1");
    p = addExercises(p, "d1", [ex("barbell-bench-press"), ex("lat-pulldown"), ex("plank"), ex("treadmill-run")]);
    return p;
  };

  it("starts exercises from the library default, every set the same", () => {
    const [bench, lat, plank, run] = base().days[0].exercises;
    expect(exerciseSummary(bench)).toBe("4 × 8");
    expect(exerciseSummary(lat)).toBe("4 × 10");
    expect(exerciseSummary(plank)).toBe("3 × 45 s");
    expect(exerciseSummary(run)).toBe("20 min");
  });

  it("edits sets: same for all, or each set", () => {
    let lat = fromLibrary(ex("lat-pulldown"));
    lat = setTargetAt(lat, 0, 12);
    lat = setTargetAt(lat, 2, 8);
    lat = setTargetAt(lat, 3, 8);
    expect(exerciseSummary(lat)).toBe("12, 10, 8, 8");
    expect(exerciseSummary(setAllTargets(lat, 10))).toBe("4 × 10");
    expect(exerciseSummary(setSetCount(lat, 5))).toBe("12, 10, 8, 8, 8");
    expect(exerciseSummary(setSetCount(lat, 2))).toBe("12, 10");
    expect(setSetCount(lat, 99).sets).toHaveLength(10);
    expect(setAllTargets(lat, 0).sets[0].reps).toBe(1);
  });

  it("steps reps by 1 and time by sensible amounts", () => {
    expect(stepTarget("weight_reps", 8, 1)).toBe(9);
    expect(stepTarget("weight_reps", 1, -1)).toBe(1);
    expect(stepTarget("time", 45, 1)).toBe(50);
    expect(stepTarget("time", 60, 1)).toBe(75);
    expect(stepTarget("time", 60, -1)).toBe(55);
    expect(stepTarget("time", 300, 1)).toBe(360);
  });

  it("toggles cues (max 4) and reorders and removes exercises", () => {
    let p = base();
    const uid = p.days[0].exercises[0].uid;
    p = updateExercise(p, "d1", uid, (e) => toggleCue(e, CUES[0]));
    expect(p.days[0].exercises[0].cues).toEqual([{ id: "squeeze-at-the-top", en: "Squeeze at the top", th: "บีบค้างที่จุดบนสุด" }]);
    p = updateExercise(p, "d1", uid, (e) => toggleCue(e, CUES[0]));
    expect(p.days[0].exercises[0].cues).toEqual([]);
    let e = p.days[0].exercises[0];
    for (const c of CUES.slice(0, 6)) e = toggleCue(e, c);
    expect(e.cues).toHaveLength(4);

    p = moveExercise(p, "d1", uid, 1);
    expect(p.days[0].exercises[1].uid).toBe(uid);
    p = moveExercise(p, "d1", p.days[0].exercises[0].uid, -1);
    expect(p.days[0].exercises[1].uid).toBe(uid);
    p = removeExercise(p, "d1", uid);
    expect(p.days[0].exercises).toHaveLength(3);
  });

  it("describes what changed for the client's notice", () => {
    const before = base();
    let after = updateExercise(before, "d1", before.days[0].exercises[0].uid, (e) => setAllTargets(setSetCount(e, 5), 5));
    after = removeExercise(after, "d1", before.days[0].exercises[3].uid);
    after = addExercises(after, "d1", [ex("pec-deck")]);
    after = addDay(after, "Legs", "d2");
    expect(diffPlans(before, after)).toEqual([
      "Chest and Back #1: added Pec deck",
      "Chest and Back #1: removed Treadmill run",
      "Barbell bench press: 4 × 8 → 5 × 5",
      "New day: Legs",
    ]);
    expect(diffPlans(before, before)).toEqual([]);
  });

  it("sanitizes plans sent from a browser", () => {
    const evil = {
      days: [
        {
          id: "d1",
          name: "  Push   day  ",
          extra: "<script>",
          exercises: [
            { uid: "a", exerciseId: "x", name: "Bench", log: "weight_reps", sets: [{ reps: 9999 }, { reps: -4 }, { reps: "8" }], cues: [{ id: "c", en: "Cue" }, {}] },
            { uid: "a", exerciseId: "y", name: "Plank", log: "time", sets: [] },
            { name: "no id" },
          ],
        },
        "nope",
      ],
    };
    const p = sanitizePlan(evil);
    expect(p.days).toHaveLength(1);
    expect(p.days[0].name).toBe("Push day");
    expect(p.days[0].exercises).toHaveLength(2);
    expect(p.days[0].exercises[0].sets).toEqual([{ reps: 100 }, { reps: 1 }, { reps: 8 }]);
    expect(p.days[0].exercises[0].cues).toEqual([{ id: "c", en: "Cue", th: undefined }]);
    expect(p.days[0].exercises[1].uid).not.toBe("a");
    expect(p.days[0].exercises[1].sets).toEqual([{ seconds: 60 }]);
    expect(() => sanitizePlan(null)).toThrow();
  });
});

describe("progress", () => {
  const day = addExercises(addDay(emptyPlan(), "Chest and Back #1", "d1"), "d1", [ex("lat-pulldown"), ex("push-up")]).days[0];
  const lat = day.exercises[0];
  const push = day.exercises[1];
  const workout = (id: string, at: string, latSets: [number, number][], pushReps: number[]): PastWorkout => ({
    id,
    dayId: "d1",
    dayName: "Chest and Back #1",
    startedAt: at,
    finishedAt: at,
    entries: [
      { uid: lat.uid, exerciseId: lat.exerciseId, name: lat.name, log: "weight_reps", sets: latSets.map(([weight, reps]) => ({ weight, reps, done: true })) },
      { uid: push.uid, exerciseId: push.exerciseId, name: push.name, log: "reps", sets: pushReps.map((reps) => ({ reps, done: true })) },
    ],
  });
  const older = workout("w1", "2026-09-21T10:00:00Z", [[65, 10], [65, 10], [65, 9], [65, 8]], [15, 12, 10]);
  const last = workout("w2", "2026-09-28T10:00:00Z", [[70, 10], [70, 10], [70, 9], [70, 8]], [15, 13, 11]);
  const history = [last, older];

  it("works out volume and best sets", () => {
    expect(workoutVolume(last)).toBe(70 * 37);
    expect(bestSet(last.entries[0])).toEqual({ weight: 70, reps: 10, done: true });
    expect(bestSet(last.entries[1])).toEqual({ reps: 15, done: true });
  });

  it("labels last time compactly", () => {
    expect(setsLabel("weight_reps", last.entries[0].sets)).toBe("70 kg × 10, 10, 9, 8");
    expect(setsLabel("weight_reps", [{ weight: 70, reps: 10, done: true }, { weight: 72.5, reps: 8, done: true }])).toBe("70 × 10, 72.5 × 8");
    expect(setsLabel("reps", last.entries[1].sets)).toBe("15, 13, 11 reps");
  });

  it("prefills a new workout from the plan and last time", () => {
    const entries = startEntries(day, history);
    expect(entries[0].sets).toEqual([
      { weight: 70, reps: 10, done: false },
      { weight: 70, reps: 10, done: false },
      { weight: 70, reps: 10, done: false },
      { weight: 70, reps: 10, done: false },
    ]);
    expect(entries[1].sets[0]).toEqual({ reps: 15, done: false });
    expect(startEntries(day, [])[0].sets[0]).toEqual({ weight: null, reps: 10, done: false });
  });

  it("finds what went up on last time", () => {
    const today = workout("w3", "2026-10-05T10:00:00Z", [[72.5, 10], [72.5, 9], [72.5, 8]], [16, 12]);
    expect(improvements(today, history).map((i) => [i.name, i.delta, i.unit])).toEqual([
      ["Lat pulldown", 2.5, "kg"],
      ["Push-up", 1, "reps"],
    ]);
  });

  it("summarises a gym day's history", () => {
    const h = dayHistory(day, history);
    expect(h.count).toBe(2);
    expect(h.series.map((s) => s.volume)).toEqual([65 * 37, 70 * 37]);
    expect(h.best[0]).toMatchObject({ name: "Lat pulldown", delta: 5, unit: "kg" });
    expect(h.sessions[0].id).toBe("w2");
    expect(dayHeadline(h)).toBe("Done 2 times. Lat pulldown up 5 kg");
  });

  it("sanitizes logs", () => {
    const log = sanitizeLog({
      dayId: "d1",
      dayName: "Chest",
      startedAt: "2026-10-05T10:00:00Z",
      finishedAt: "2026-10-05T09:00:00Z",
      entries: [{ exerciseId: "x", name: "X", log: "weight_reps", sets: [{ weight: "72.555", reps: 8.4, done: true }, { weight: -5, reps: 9000 }] }],
    });
    expect(log.finishedAt).toBe(log.startedAt);
    expect(log.entries[0].sets).toEqual([
      { weight: 72.56, reps: 8, seconds: null, done: true },
      { weight: 0, reps: 500, seconds: null, done: false },
    ]);
    expect(() => sanitizeLog({ entries: [] })).toThrow();
  });
});

describe("nutrition", () => {
  it("works out calories from the macros", () => {
    const d = { ...emptyDiet(), protein: 180, carbs: 250, fat: 70 };
    expect(kcalOf(d)).toBe(2350);
    expect(macroSplit(d)).toEqual({ protein: 31, carbs: 42, fat: 27 });
    expect(stepMacro(d, "protein", 1).protein).toBe(185);
    expect(stepMacro({ ...d, fat: 0 }, "fat", -1).fat).toBe(0);
  });

  it("builds a meal plan", () => {
    let d = addMeal(emptyDiet(), undefined, "m1");
    d = addFood(d, "m1", { name: "Rolled oats", amount: "80 g" });
    d = addFood(d, "m1", { name: "Whey protein", amount: "30 g" });
    d = addFood(d, "m1", { name: " ", amount: "x" });
    expect(d.meals[0].name).toBe("Breakfast");
    expect(mealSummary(d.meals[0])).toBe("Rolled oats, whey protein");
    expect(addMeal(d).meals[1].name).toBe("Lunch");
    expect(sanitizeDiet({ protein: "5000", meals: [{ name: "x", foods: [{ name: "Rice", amount: "200 g" }, { amount: "1" }] }] })).toMatchObject({
      protein: 1000,
      carbs: 0,
      meals: [{ name: "x", foods: [{ name: "Rice", amount: "200 g" }] }],
    });
    expect(diffDiet({ ...d }, { ...d, protein: d.protein + 5 })[0]).toMatch(/^Macros: 155 g protein/);
  });
});

describe("daily feedback", () => {
  const setup = defaultSetup();

  it("has six questions on by default", () => {
    expect(activeQuestions(setup).map((q) => q.id)).toEqual(["steps", "water", "sleep", "digestion", "energy", "bodyweight"]);
  });

  it("keeps only valid answers to switched-on questions", () => {
    const a = sanitizeAnswers(setup, { steps: "8,420", water: 2.5, sleep: 7.26, digestion: 9, energy: "x", bodyweight: 82.44, hunger: 3, other: 1 });
    expect(a).toEqual({ steps: 8420, water: 2.5, sleep: 7.5, digestion: 5, bodyweight: 82.4 });
    expect(sanitizeAnswers(setup, { water: 2.2 })).toEqual({});
    expect(answeredCount(setup, a)).toEqual({ answered: 5, total: 6 });
  });

  it("formats answers", () => {
    const q = (id: string) => setup.questions.find((x) => x.id === id)!;
    expect(formatAnswer(q("steps"), 9105)).toBe("9,105");
    expect(formatAnswer(q("water"), 3)).toBe("3 L");
    expect(formatAnswer(q("sleep"), 7.5)).toBe("7.5 h");
    expect(formatAnswer(q("energy"), 4)).toBe("4 / 5");
    expect(formatAnswer(q("bodyweight"), 82.6)).toBe("82.6 kg");
  });

  it("lets the coach switch questions and add their own", () => {
    let s = toggleQuestion(setup, "hunger", true);
    s = addQuestion(s, { label: "Took creatine", type: "yesno" }, "q-creatine");
    expect(activeQuestions(s).map((q) => q.id)).toContain("q-creatine");
    expect(sanitizeAnswers(s, { "q-creatine": true, hunger: 2 })).toEqual({ "q-creatine": true, hunger: 2 });
    const round = sanitizeSetup(JSON.parse(JSON.stringify(s)));
    expect(round).toEqual(s);
    expect(sanitizeSetup({ questions: [{ id: "steps", enabled: true, target: 12000 }] }).questions.find((q) => q.id === "water")?.enabled).toBe(false);
  });

  it("averages, latest and streaks", () => {
    const days: FeedbackDay[] = [
      { date: "2026-10-06", answers: { steps: 8000 }, completedAt: null },
      { date: "2026-10-05", answers: { steps: 9000, bodyweight: 82.6 }, completedAt: "x" },
      { date: "2026-10-04", answers: { steps: 10000, bodyweight: 82.9 }, completedAt: "x" },
      { date: "2026-09-20", answers: { steps: 1 }, completedAt: "x" },
    ];
    expect(average(days, "steps", "2026-10-06")).toBe(9000);
    expect(latest(days, "bodyweight")).toEqual({ date: "2026-10-05", value: 82.6 });
    expect(streak(days, "2026-10-06")).toBe(2);
  });
});

describe("clients", () => {
  it("sorts clients into Active and To set up", () => {
    expect(sectionOf("active")).toBe("active");
    expect(sectionOf("invited")).toBe("setup");
    expect(sectionOf("archived")).toBe("archived");
  });

  it("writes the row the way the design does", () => {
    const text = (p: { text: string }[]) => p.map((x) => x.text).join(". ");
    expect(text(clientRowParts({ status: "active", sessionsLeft: 3, feedbackToday: "started", feedbackOn: true, workedOutToday: false }))).toBe("3 sessions left. Today's feedback not in");
    expect(text(clientRowParts({ status: "active", sessionsLeft: 1, feedbackToday: "complete", feedbackOn: true, workedOutToday: false }))).toBe("1 session left");
    expect(text(clientRowParts({ status: "invited", sessionsLeft: 10, feedbackToday: null, feedbackOn: true, workedOutToday: false }))).toBe("10 sessions left. Not on the app yet");
    expect(text(clientRowParts({ status: "active", sessionsLeft: 8, feedbackToday: "missing", feedbackOn: true, workedOutToday: true }))).toBe("8 sessions left. Trained today");
  });

  it("defaults visibility to everything on", () => {
    expect(visibilityOf({ nutrition: false, junk: 1 })).toEqual({ workouts: true, nutrition: false, dailyPlan: true, feedback: true, homeStats: true });
    expect(initials("Pete Hudson")).toBe("PH");
    expect(initials("Bella")).toBe("B");
  });
});
