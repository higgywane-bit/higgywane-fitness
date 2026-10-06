import Link from "next/link";
import { notFound } from "next/navigation";
import { btn, Card, Dock, Group, Row, SectionTitle, Stat, TopBar } from "@/components/pt/ui";
import { getDb } from "@/lib/db";
import { localDate } from "@/lib/membership/dates";
import { mediumDate } from "@/lib/pt/clients";
import { deltaLabel, improvements, setsDone, setsLabel, doneSets, workoutVolume } from "@/lib/pt/progress";
import { getWorkout, workoutHistory } from "@/lib/pt/service";
import { requireClient } from "@/lib/pt/session";

export const metadata = { title: "Workout" };
export const dynamic = "force-dynamic";

export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const me = await requireClient();
  const db = await getDb();
  const w = await getWorkout(db, me.client.id, id);
  if (!w) notFound();
  const history = (await workoutHistory(db, me.client.id, 120)).filter((x) => x.finishedAt < w.finishedAt);
  const prevSame = history.find((x) => x.dayId === w.dayId);
  const volume = workoutVolume(w);
  const diff = prevSame ? Math.round(volume - workoutVolume(prevSame)) : null;
  const ups = improvements(w, history);
  const celebrate = done === "1";

  return (
    <>
      <TopBar
        back={celebrate ? undefined : { href: `/app/workout/${w.dayId}/history`, label: "My history" }}
        right={
          celebrate ? (
            <Link href="/app" className={btn({ variant: "plain", className: "font-semibold" })}>
              Done
            </Link>
          ) : undefined
        }
      />
      <main className="flex flex-col gap-6 px-4 pt-2 pb-36">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          {celebrate ? (
            <svg viewBox="0 0 120 120" aria-hidden className="size-[84px] [animation:s1-pop_.45s_cubic-bezier(.2,1.4,.4,1)]">
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--s1-green)" strokeWidth="8" />
              <path d="M37 61l15 15 31-33" fill="none" stroke="var(--s1-green)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="120" className="[animation:s1-draw_.5s_.2s_ease-out_both]" />
            </svg>
          ) : null}
          <div>
            <h1 className="text-[30px] leading-9 font-bold tracking-tight">{celebrate ? "Workout done" : w.dayName}</h1>
            <p className="text-[15px] text-s1-muted">{celebrate ? w.dayName : mediumDate(localDate(new Date(w.finishedAt)))}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Stat
            className="items-center px-2 py-4 text-center"
            label={diff == null ? "Lifted" : diff >= 0 ? `Lifted, up ${diff.toLocaleString("en-US")} kg` : `Lifted, ${Math.abs(diff).toLocaleString("en-US")} kg less`}
            value={`${Math.round(volume).toLocaleString("en-US")} kg`}
          />
          <Stat className="items-center px-2 py-4 text-center" label="Sets" value={setsDone(w)} />
        </div>

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
              <Row key={e.uid || e.exerciseId} title={e.name} sub={doneSets(e).length ? setsLabel(e.log, doneSets(e)) : "Skipped"} />
            ))}
          </Group>
        </section>

        {w.note ? (
          <section className="flex flex-col gap-2">
            <SectionTitle>Note</SectionTitle>
            <Card className="p-4 text-[16px] leading-[23px]">{w.note}</Card>
          </section>
        ) : null}
      </main>
      {celebrate ? (
        <Dock>
          <Link href="/app" className={btn({ variant: "primary", size: "lg", block: true, className: "h-[58px] text-[18px]" })}>
            Done
          </Link>
        </Dock>
      ) : null}
    </>
  );
}
