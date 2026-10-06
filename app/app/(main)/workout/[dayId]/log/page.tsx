import { notFound } from "next/navigation";
import { WorkoutLogger } from "@/components/pt/client/workout-logger";
import { getDb } from "@/lib/db";
import { cueText } from "@/lib/pt/library";
import { exerciseSummary, findDay } from "@/lib/pt/program";
import { lastTime, setsLabel, startEntries } from "@/lib/pt/progress";
import { getPlans, workoutHistory } from "@/lib/pt/queries";
import { requireClient } from "@/lib/pt/session";

export const metadata = { title: "Workout" };
export const dynamic = "force-dynamic";

export default async function LogPage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const me = await requireClient();
  const db = await getDb();
  const [plans, history] = await Promise.all([getPlans(db, me.client.id), workoutHistory(db, me.client.id, 60)]);
  const day = me.visibility.workouts ? findDay(plans.workout.doc, dayId) : undefined;
  if (!day) notFound();

  const meta = day.exercises.map((e) => {
    const last = lastTime(history, e.exerciseId);
    return {
      uid: e.uid,
      name: e.name,
      cues: e.cues.map((c) => cueText(c, me.lang)),
      note: e.note,
      target: exerciseSummary(e),
      last: last ? setsLabel(e.log, last.sets) : null,
    };
  });

  return <WorkoutLogger clientId={me.client.id} dayId={day.id} dayName={day.name} fresh={startEntries(day, history)} meta={meta} />;
}
