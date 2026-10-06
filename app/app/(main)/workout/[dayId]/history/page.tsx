import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { Card, Empty, Group, PageTitle, Row, SectionTitle, TopBar } from "@/components/pt/ui";
import { getDb } from "@/lib/db";
import { localDate } from "@/lib/membership/dates";
import { mediumDate } from "@/lib/pt/clients";
import { findDay } from "@/lib/pt/program";
import { dayHistory, kg, setLabel } from "@/lib/pt/progress";
import { getPlans, workoutHistory } from "@/lib/pt/queries";
import { requireClient } from "@/lib/pt/session";

export const metadata = { title: "My history" };
export const dynamic = "force-dynamic";

const short = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

export default async function HistoryPage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const me = await requireClient();
  const db = await getDb();
  const [plans, history] = await Promise.all([getPlans(db, me.client.id), workoutHistory(db, me.client.id, 120)]);
  const day = findDay(plans.workout.doc, dayId);
  if (!day) notFound();
  const h = dayHistory(day, history);
  const series = h.series.slice(-12);
  const max = Math.max(1, ...series.map((s) => s.volume));
  const min = Math.min(...series.map((s) => s.volume));
  const floor = Math.max(0, min - (max - min) * 0.6);

  return (
    <>
      <TopBar back={{ href: `/app/workout/${day.id}`, label: day.name }} />
      <main className="flex flex-col gap-6 px-4 pt-2 pb-12">
        <PageTitle title="My history" sub={`${day.name}, done ${h.count} time${h.count === 1 ? "" : "s"}`} />
        {!h.count ? (
          <Empty icon={<History />} title="Nothing yet">
            Finish {day.name} once and your progress shows here.
          </Empty>
        ) : (
          <>
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-semibold">Total kg lifted</span>
                <span className="num text-[20px] font-bold">{Math.round(series.at(-1)!.volume).toLocaleString("en-US")}</span>
              </div>
              <div className="flex h-28 items-end gap-1.5" role="img" aria-label={`Kg lifted per session: ${series.map((s) => Math.round(s.volume)).join(", ")}`}>
                {series.map((s, i) => (
                  <i
                    key={s.at}
                    className={i === series.length - 1 ? "flex-1 rounded-t-md bg-s1-blue" : "flex-1 rounded-t-md bg-s1-surface-4"}
                    style={{ height: `${Math.max(8, ((s.volume - floor) / (max - floor || 1)) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[12px] text-s1-faint">
                <span>{short(series[0].at)}</span>
                <span>{short(series.at(-1)!.at)}</span>
              </div>
            </Card>

            {h.best.length ? (
              <section className="flex flex-col gap-2">
                <SectionTitle>Best sets</SectionTitle>
                <Group>
                  {h.best.map((b) => (
                    <Row
                      key={b.exerciseId}
                      title={b.name}
                      sub={setLabel(b.log, b.best)}
                      trail={b.delta && b.delta > 0 ? <span className="num rounded-full bg-s1-green-tint px-2.5 py-1 text-[13px] font-bold text-s1-green">+{b.unit === "kg" ? `${kg(b.delta)} kg` : `${b.delta} ${b.unit}`}</span> : null}
                    />
                  ))}
                </Group>
              </section>
            ) : null}

            <section className="flex flex-col gap-2">
              <SectionTitle>Sessions</SectionTitle>
              <Group>
                {h.sessions.map((s) => (
                  <Row key={s.id} href={`/app/workout/session/${s.id}`} title={mediumDate(localDate(new Date(s.at)))} sub={`${Math.round(s.volume).toLocaleString("en-US")} kg · ${s.sets} sets`} />
                ))}
              </Group>
            </section>
          </>
        )}
      </main>
    </>
  );
}
