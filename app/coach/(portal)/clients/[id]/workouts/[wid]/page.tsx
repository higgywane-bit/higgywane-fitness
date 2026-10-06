import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import { Card, Group, Row, SectionTitle, Stat } from "@/components/pt/ui";
import { getDb, t } from "@/lib/db";
import { localDate } from "@/lib/membership/dates";
import { fullName } from "@/lib/membership/service";
import { mediumDate } from "@/lib/pt/clients";
import { deltaLabel, doneSets, improvements, setsDone, setsLabel, workoutVolume } from "@/lib/pt/progress";
import { clientForCoach, getWorkout, workoutHistory } from "@/lib/pt/service";
import { requireCoach } from "@/lib/pt/session";

export const metadata = { title: "Workout" };
export const dynamic = "force-dynamic";

export default async function LoggedWorkoutPage({ params }: { params: Promise<{ id: string; wid: string }> }) {
  const { id, wid } = await params;
  const coach = await requireCoach();
  const db = await getDb();
  const client = await clientForCoach(db, coach, id).catch(() => null);
  if (!client) notFound();
  const [[member], w] = await Promise.all([db.select().from(t.members).where(eq(t.members.id, client.memberId)).limit(1), getWorkout(db, client.id, wid)]);
  if (!w) notFound();
  const earlier = (await workoutHistory(db, client.id, 120)).filter((x) => x.finishedAt < w.finishedAt);
  const ups = improvements(w, earlier);
  const minutes = Math.round((new Date(w.finishedAt).getTime() - new Date(w.startedAt).getTime()) / 60_000);

  return (
    <>
      <CoachHeader back={{ href: `/coach/clients/${client.id}`, label: fullName(member) }} title={w.dayName} sub={mediumDate(localDate(new Date(w.finishedAt)))} />
      <CoachBody className="max-w-2xl lg:mx-0">
        <div className="flex gap-2">
          <Stat label="Lifted" value={`${Math.round(workoutVolume(w)).toLocaleString("en-US")} kg`} />
          <Stat label="Sets" value={setsDone(w)} />
          <Stat label="Time" value={minutes > 0 && minutes < 600 ? `${minutes} min` : "—"} />
        </div>
        {w.note ? (
          <section className="flex flex-col gap-2">
            <SectionTitle>Note from {member.nickname || member.firstName}</SectionTitle>
            <Card className="p-4 text-[16px] leading-[23px] text-s1-pink">{w.note}</Card>
          </section>
        ) : null}
        {ups.length ? (
          <section className="flex flex-col gap-2">
            <SectionTitle>Up on last time</SectionTitle>
            <Group>
              {ups.map((u) => (
                <Row key={u.exerciseId} title={u.name} sub={setsLabel(u.log, [u.best])} trail={<span className="num rounded-full bg-s1-green-tint px-2.5 py-1 text-[13px] font-bold text-s1-green">{deltaLabel(u)}</span>} />
              ))}
            </Group>
          </section>
        ) : null}
        <section className="flex flex-col gap-2">
          <SectionTitle>Every set</SectionTitle>
          <Group>
            {w.entries.map((e) => (
              <Row key={e.uid || e.exerciseId} title={e.name} sub={doneSets(e).length ? setsLabel(e.log, doneSets(e)) : <span className="text-s1-yellow">Skipped</span>} />
            ))}
          </Group>
        </section>
      </CoachBody>
    </>
  );
}
