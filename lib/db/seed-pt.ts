import { eq, inArray } from "drizzle-orm";
import { addDays, localDate } from "@/lib/membership/dates";
import { hashPassword } from "@/lib/pt/auth";
import { DEFAULT_VISIBILITY } from "@/lib/pt/clients";
import { addFood, addMeal, emptyDiet, type DietPlan } from "@/lib/pt/diet";
import { defaultSetup } from "@/lib/pt/feedback";
import { CUES, findExercise } from "@/lib/pt/library";
import { addDay, emptyPlan, fromLibrary, setTargetAt, toggleCue, type WorkoutPlan } from "@/lib/pt/program";
import { setsDone, workoutVolume, type LoggedExercise } from "@/lib/pt/progress";
import type { DB } from "./client";
import { clientAccounts, dailyFeedback, leads, members, ptClients, ptNotifications, ptPlans, workoutLogs, type MembershipRow, type Staff } from "./schema";

/*
 * Demo PT app data: each coach gets clients on the app (plans, 6 weeks of logged
 * workouts, daily feedback, notices) and one waiting to set up, plus programs and leads.
 * Demo client sign-in: the member's email (or demo-<member no>@superfit.test) / superfit1
 */

export const DEMO_CLIENT_PASSWORD = "superfit1";

type R = () => number;

const DAYS: [string, [string, string?][]][] = [
  ["Chest and Back #1", [["barbell-bench-press", "squeeze-at-the-top"], ["incline-dumbbell-press", "slow-on-the-way-down-3-seconds"], ["lat-pulldown"], ["seated-cable-row"], ["pec-deck"]]],
  ["Legs", [["back-squat", "brace-your-core"], ["romanian-deadlift", "hips-back"], ["leg-press"], ["lying-leg-curl"], ["standing-calf-raise", "pause-at-the-bottom"]]],
  ["Shoulders and Arms", [["seated-dumbbell-shoulder-press"], ["dumbbell-lateral-raise", "don-t-swing"], ["face-pull"], ["ez-bar-curl"], ["rope-pushdown"]]],
  ["Chest and Back #2", [["incline-barbell-bench-press"], ["chest-supported-t-bar-row"], ["cable-fly"], ["pull-up"], ["plank"]]],
];

const START_KG: Record<string, number> = { Barbell: 60, Dumbbell: 20, Machine: 50, Cable: 40, "Smith machine": 50, Kettlebell: 16, Bodyweight: 0 };

export function demoWorkout(): WorkoutPlan {
  let plan = emptyPlan();
  DAYS.forEach(([name, list], i) => {
    plan = addDay(plan, name, `day-${i + 1}`);
    plan.days[i].exercises = list.map(([id, cue], j) => {
      let ex = fromLibrary(findExercise(id)!, `d${i + 1}e${j + 1}`);
      if (cue) ex = toggleCue(ex, CUES.find((c) => c.id === cue)!);
      return ex;
    });
  });
  // Lat pulldown: a pyramid, to show "edit each set"
  const lat = plan.days[0].exercises[2];
  plan.days[0].exercises[2] = [12, 10, 8, 8].reduce((e, reps, i) => setTargetAt(e, i, reps), lat);
  return plan;
}

export function demoDiet(): DietPlan {
  let d: DietPlan = { ...emptyDiet(), protein: 180, carbs: 250, fat: 70, showDailyPlan: true };
  const meals: [string, [string, string][]][] = [
    ["Breakfast", [["Rolled oats", "80 g"], ["Whey protein", "30 g"], ["Banana", "1 medium"], ["Peanut butter", "15 g"]]],
    ["Lunch", [["Chicken breast", "180 g"], ["Jasmine rice", "200 g"], ["Greens", "150 g"]]],
    ["Snack", [["Greek yogurt", "200 g"], ["Berries", "100 g"]]],
    ["Dinner", [["Salmon", "150 g"], ["Sweet potato", "250 g"], ["Broccoli", "150 g"]]],
  ];
  meals.forEach(([name, foods], i) => {
    d = addMeal(d, name, `meal-${i + 1}`);
    for (const [f, a] of foods) d = addFood(d, `meal-${i + 1}`, { name: f, amount: a });
  });
  return d;
}

export async function seedPt(db: DB, r: R, now: Date, coaches: Staff[], ms: MembershipRow[], packCoach: Map<string, string>) {
  const today = localDate(now);
  const at = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);
  const passwordHash = await hashPassword(DEMO_CLIENT_PASSWORD);
  const workout = demoWorkout();
  const diet = demoDiet();

  // members with an open PT pack, grouped by the coach who's been training them
  const open = ms.filter((m) => m.kind === "pt" && !m.cancelledAt && m.endsOn >= today && m.startsOn <= today && (m.sessionsTotal ?? 0) > m.sessionsUsed);
  const byCoach = new Map<string, string[]>();
  for (const m of open) {
    const coachId = packCoach.get(m.memberId) ?? coaches[0]?.id;
    if (!coachId) continue;
    const list = byCoach.get(coachId) ?? [];
    if (!list.includes(m.memberId)) list.push(m.memberId);
    byCoach.set(coachId, list);
  }
  const memberRows = open.length ? await db.select().from(members).where(inArray(members.id, open.map((m) => m.memberId))) : [];
  const memberBy = new Map(memberRows.map((m) => [m.id, m]));

  for (const coach of coaches) {
    const ids = (byCoach.get(coach.id) ?? []).slice(0, 4);
    for (const [k, memberId] of ids.entries()) {
      const m = memberBy.get(memberId)!;
      const invited = k === ids.length - 1 && ids.length > 1;
      const [client] = await db
        .insert(ptClients)
        .values({
          memberId,
          coachId: coach.id,
          status: invited ? "invited" : "active",
          joinedAt: invited ? null : at(addDays(today, -45), "10:00"),
          inviteSentAt: invited ? at(addDays(today, -2), "11:00") : null,
          inviteExpiresAt: invited ? at(addDays(today, 12), "11:00") : null,
          inviteChannel: invited ? "email" : null,
          visibility: { ...DEFAULT_VISIBILITY },
          demo: true,
          createdAt: at(addDays(today, -46), "09:00"),
        })
        .returning();
      if (invited) continue;

      const email = (m.email ?? `demo-${m.memberNo}@superfit.test`).toLowerCase();
      await db.insert(clientAccounts).values({ memberId, email, passwordHash, createdAt: at(addDays(today, -45), "10:00") }).onConflictDoNothing();
      if (!m.email) await db.update(members).set({ email }).where(eq(members.id, memberId));

      await db.insert(ptPlans).values([
        { clientId: client.id, coachId: coach.id, kind: "workout", doc: workout, version: 3, demo: true, updatedAt: at(addDays(today, -1), "20:15") },
        { clientId: client.id, coachId: coach.id, kind: "diet", doc: diet, version: 1, demo: true },
        { clientId: client.id, coachId: coach.id, kind: "feedback", doc: defaultSetup(), version: 1, demo: true },
      ]);

      // six weeks of training, getting a little stronger every couple of weeks
      const logs: (typeof workoutLogs.$inferInsert)[] = [];
      for (let week = 6; week >= 1; week--) {
        workout.days.forEach((day, d) => {
          if (r() < 0.12) return; // the odd missed day
          const date = addDays(today, -(week * 7) + d * 2 + 1);
          if (date >= today) return;
          const bump = Math.floor((6 - week) / 2) * 2.5;
          const entries: LoggedExercise[] = day.exercises.map((ex) => {
            const lib = findExercise(ex.exerciseId)!;
            const base = START_KG[lib.equipment] ?? 30;
            return {
              uid: ex.uid,
              exerciseId: ex.exerciseId,
              name: ex.name,
              log: ex.log,
              sets: ex.sets.map((s, i) =>
                ex.log === "time"
                  ? { seconds: (s.seconds ?? 45) + (6 - week) * 5, done: true }
                  : ex.log === "reps"
                    ? { reps: Math.max(1, (s.reps ?? 8) - (i > 1 ? 1 : 0) + Math.floor((6 - week) / 2)), done: true }
                    : { weight: base ? base + bump : null, reps: Math.max(1, (s.reps ?? 10) - (i === ex.sets.length - 1 ? 1 : 0)), done: true },
              ),
            };
          });
          const finished = at(date, "18:45");
          logs.push({
            clientId: client.id,
            dayId: day.id,
            dayName: day.name,
            startedAt: at(date, "17:40"),
            finishedAt: finished,
            entries,
            note: week === 1 && d === 0 ? "Felt sick on the last set." : null,
            volumeKg: Math.round(workoutVolume({ entries })),
            setsDone: setsDone({ entries }),
            planVersion: 3,
            createdAt: finished,
          });
        });
      }
      if (logs.length) await db.insert(workoutLogs).values(logs);

      // daily feedback: the last 10 days, mostly complete; today started but not done
      const weight = 70 + Math.round(r() * 200) / 10;
      const days: (typeof dailyFeedback.$inferInsert)[] = [];
      for (let i = 0; i < 10; i++) {
        const date = addDays(today, -i);
        if (i === 3) continue;
        const answers: Record<string, number> = { steps: 6500 + Math.round(r() * 5000), water: [2, 2.5, 3, 3.5][Math.floor(r() * 4)], sleep: 6 + Math.round(r() * 4) / 2, digestion: 3 + Math.floor(r() * 3), energy: 3 + Math.floor(r() * 3), bodyweight: Math.round((weight + i * 0.08) * 10) / 10 };
        if (i === 0) days.push({ clientId: client.id, date, answers: { steps: answers.steps, water: answers.water }, completedAt: null, updatedAt: now });
        else days.push({ clientId: client.id, date, answers, completedAt: at(date, "21:14"), updatedAt: at(date, "21:14") });
      }
      await db.insert(dailyFeedback).values(days);

      await db.insert(ptNotifications).values([
        { clientId: client.id, audience: "client", kind: "plan.updated", title: `${coach.name} updated your workout`, body: "Barbell bench press: 4 × 8 → 4 × 6. Legs: added Standing calf raise", href: "/app/workout", createdAt: at(addDays(today, -1), "20:15") },
        { clientId: client.id, audience: "coach", kind: "workout.done", title: `${m.firstName} ${m.lastName} finished ${workout.days[0].name}`.trim(), body: "11,240 kg · 17 sets · Note: Felt sick on the last set.", href: `/coach/clients/${client.id}`, createdAt: at(addDays(today, -1), "18:45") },
      ]);
    }

    // programs to reuse
    await db.insert(ptPlans).values([
      { coachId: coach.id, kind: "workout", name: "Upper / lower 4 days", doc: workout, demo: true },
      { coachId: coach.id, kind: "diet", name: "Lean bulk 2,350", doc: diet, demo: true },
    ]);
  }

  // a couple of PT enquiries passed to each coach
  const names = ["Chris Hurd", "Mint Ch", "Tom B", "Fah S", "Jay P", "Noon K", "Ice T", "Bank W"];
  await db.insert(leads).values(
    coaches.flatMap((c, i) => [
      { name: names[(i * 2) % names.length], phone: `+6681${String(2000000 + i * 17).padStart(7, "0")}`, source: "walk-in", interest: "pt", stage: "new" as const, notes: "Lose fat. Sent by the front desk", ownerId: c.id, demo: true, createdAt: new Date(now.getTime() - (12 + i * 30) * 60_000) },
      { name: names[(i * 2 + 1) % names.length], lineId: `demo${i}`, source: "instagram", interest: "pt", stage: "contacted" as const, notes: "Wants to build muscle, evenings only", ownerId: c.id, demo: true, createdAt: new Date(now.getTime() - (2 + i) * 86_400_000) },
    ]),
  );
}
