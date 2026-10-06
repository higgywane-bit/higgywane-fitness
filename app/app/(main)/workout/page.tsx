import { Dumbbell } from "lucide-react";
import { ResumeBanner } from "@/components/pt/client/resume-banner";
import { Empty, Group, PageTitle, Row, TopBar } from "@/components/pt/ui";
import { getDb, t } from "@/lib/db";
import { eq } from "drizzle-orm";
import { mediumDate } from "@/lib/pt/clients";
import { localDate } from "@/lib/membership/dates";
import { getPlans, workoutHistory } from "@/lib/pt/queries";
import { requireClient } from "@/lib/pt/session";

export const metadata = { title: "My gym days" };
export const dynamic = "force-dynamic";

export default async function GymDaysPage() {
  const me = await requireClient();
  const db = await getDb();
  const [plans, history, [coach]] = await Promise.all([
    getPlans(db, me.client.id),
    workoutHistory(db, me.client.id, 60),
    me.client.coachId ? db.select({ name: t.staff.name }).from(t.staff).where(eq(t.staff.id, me.client.coachId)) : Promise.resolve([] as { name: string }[]),
  ]);
  const days = me.visibility.workouts ? plans.workout.doc.days : [];
  const lastDone = (dayId: string) => history.find((w) => w.dayId === dayId)?.finishedAt;

  return (
    <>
      <TopBar back={{ href: "/app", label: "Home" }} />
      <main className="flex flex-col gap-5 px-4 pt-2 pb-12">
        <PageTitle title="My gym days" sub={coach ? `Set by ${coach.name}` : undefined} />
        <ResumeBanner clientId={me.client.id} />
        {days.length ? (
          <Group>
            {days.map((d, i) => {
              const last = lastDone(d.id);
              return (
                <Row
                  key={d.id}
                  href={`/app/workout/${d.id}`}
                  lead={
                    <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-s1-surface-3 text-[14px] font-semibold" aria-hidden>
                      {i + 1}
                    </span>
                  }
                  title={d.name}
                  sub={last ? `Last done ${mediumDate(localDate(new Date(last)))}` : `${d.exercises.length} exercises. Not done yet`}
                />
              );
            })}
          </Group>
        ) : (
          <Empty icon={<Dumbbell />} title="No gym days yet">
            {coach ? `${coach.name} is building your workout. It shows up here as soon as it's saved.` : "Your coach is building your workout."}
          </Empty>
        )}
      </main>
    </>
  );
}
