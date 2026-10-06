import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { btn, Card, Disc, Dock, Group, PageTitle, Row, TopBar } from "@/components/pt/ui";
import { getDb } from "@/lib/db";
import { cueText } from "@/lib/pt/library";
import { daySummary, exerciseSummary, findDay } from "@/lib/pt/program";
import { dayHeadline, dayHistory, lastTime, setLabel, bestSet } from "@/lib/pt/progress";
import { getPlans, workoutHistory } from "@/lib/pt/queries";
import { requireClient } from "@/lib/pt/session";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const me = await requireClient();
  const db = await getDb();
  const [plans, history] = await Promise.all([getPlans(db, me.client.id), workoutHistory(db, me.client.id, 60)]);
  const day = me.visibility.workouts ? findDay(plans.workout.doc, dayId) : undefined;
  if (!day) notFound();
  const h = dayHistory(day, history);

  return (
    <>
      <TopBar back={{ href: "/app/workout", label: "My gym days" }} />
      <main className="flex flex-col gap-5 px-4 pt-2 pb-36">
        <PageTitle title={day.name} sub={daySummary(day)} />
        {h.count ? (
          <Link href={`/app/workout/${day.id}/history`} className="tap">
            <Card className="flex items-center gap-3.5 p-4 transition-colors hover:bg-s1-surface-3">
              <Disc tone="blue">
                <TrendingUp />
              </Disc>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold">My history</span>
                <span className="block text-[14px] text-s1-muted">{dayHeadline(h)}</span>
              </span>
            </Card>
          </Link>
        ) : null}
        <Group>
          {day.exercises.map((e) => {
            const last = lastTime(history, e.exerciseId);
            const best = last ? bestSet({ log: e.log, sets: last.sets }) : null;
            return (
              <Row
                key={e.uid}
                title={e.name}
                sub={
                  <>
                    {best ? `Last ${setLabel(e.log, best)}` : "New for you"}
                    {e.cues.length ? <span className="block text-s1-blue">{e.cues.map((c) => cueText(c, me.lang)).join(" · ")}</span> : null}
                  </>
                }
                trail={<span className="num shrink-0 text-[15px] font-semibold text-s1-muted">{exerciseSummary(e)}</span>}
              />
            );
          })}
        </Group>
      </main>
      {day.exercises.length ? (
        <Dock>
          <Link href={`/app/workout/${day.id}/log`} className={btn({ variant: "primary", size: "lg", block: true, className: "h-[58px] text-[18px]" })}>
            Start {day.name}
          </Link>
        </Dock>
      ) : null}
    </>
  );
}
