import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Dumbbell, ListChecks, Send, Utensils } from "lucide-react";
import { ClientMenu, SessionsCard, VisibilitySwitches } from "@/components/pt/coach/client-controls";
import { InviteButton } from "@/components/pt/coach/invite-sheet";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import { Card, Disc, Group, Pill, Row, SectionTitle } from "@/components/pt/ui";
import { getDb, t } from "@/lib/db";
import { localDate } from "@/lib/membership/dates";
import { mediumDate } from "@/lib/pt/clients";
import { kg } from "@/lib/pt/progress";
import { clientOverview } from "@/lib/pt/queries";
import { clientForCoach, markRead, seesAllClients } from "@/lib/pt/service";
import { requireCoach } from "@/lib/pt/session";

export const dynamic = "force-dynamic";

const short = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coach = await requireCoach();
  const db = await getDb();
  const client = await clientForCoach(db, coach, id).catch(() => null);
  if (!client) notFound();
  const c = await clientOverview(client);
  // opening the client clears their notices for this coach
  await markRead(db, "coach", [client.id]);
  const coaches = seesAllClients(coach)
    ? await db.select({ id: t.staff.id, name: t.staff.name }).from(t.staff).where(and(eq(t.staff.role, "coach"), eq(t.staff.active, true))).orderBy(t.staff.name)
    : null;
  const base = `/coach/clients/${c.id}`;

  const sub =
    c.status === "active"
      ? `On the app since ${c.joinedAt ? short(c.joinedAt) : "—"} · #${c.memberNo}`
      : c.status === "invited"
        ? `#${c.memberNo} · ${c.inviteSentAt ? `Invited ${short(c.inviteSentAt)}${c.inviteExpired ? ", link expired" : ""}` : "Not invited yet"}`
        : `#${c.memberNo} · Archived`;

  return (
    <>
      <CoachHeader
        back={{ href: "/coach", label: "Clients" }}
        title={c.name}
        sub={
          <>
            {sub}
            {seesAllClients(coach) && c.coach ? (
              <Pill tone="pink" className="ml-2 align-middle">
                {c.coach.name}
              </Pill>
            ) : null}
          </>
        }
        actions={<ClientMenu clientId={c.id} name={c.firstName} archived={c.status === "archived"} coaches={coaches} currentCoachId={c.coach?.id ?? null} />}
      />
      <CoachBody className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          <SessionsCard clientId={c.id} firstName={c.firstName} left={c.pack?.sessionsLeft ?? null} total={c.pack?.total ?? 0} endsOn={c.pack?.endsOn ?? null} />

          {c.status === "invited" ? (
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <Disc tone="blue">
                  <Send />
                </Disc>
                <span className="text-[17px] font-semibold">Not on the app yet</span>
              </div>
              <p className="text-[15px] leading-[21px] text-s1-muted">
                Send a link by LINE, SMS or email. {c.firstName} signs in once and sees the plan you build. You can build it now.
              </p>
              <InviteButton clientId={c.id} name={c.name} hasEmail={!!c.email} label={c.inviteSentAt ? "Send a new link" : "Send app invite"} />
            </Card>
          ) : null}

          <Group>
            <Row
              href={`${base}/workout`}
              lead={
                <Disc>
                  <Dumbbell />
                </Disc>
              }
              title="Workout"
              sub={c.workout.days.length ? `${c.workout.days.length} gym day${c.workout.days.length === 1 ? "" : "s"}${c.workout.updatedAt ? ` · updated ${short(c.workout.updatedAt)}` : ""}` : <span className="text-s1-faint">Not set up</span>}
            />
            <Row
              href={`${base}/nutrition`}
              lead={
                <Disc>
                  <Utensils />
                </Disc>
              }
              title="Nutrition"
              sub={c.diet.set ? `${c.diet.kcal.toLocaleString("en-US")} kcal${c.diet.showDailyPlan ? ". Daily plan on" : ""}` : <span className="text-s1-faint">Not set up</span>}
            />
            <Row
              href={`${base}/feedback`}
              lead={
                <Disc>
                  <ListChecks />
                </Disc>
              }
              title="Daily feedback"
              sub={c.visibility.feedback && c.feedbackQuestions ? `${c.feedbackQuestions} questions` : <span className="text-s1-faint">Off</span>}
            />
          </Group>

          <section className="flex flex-col gap-2">
            <SectionTitle>What {c.firstName} sees</SectionTitle>
            <VisibilitySwitches clientId={c.id} firstName={c.firstName} initial={c.visibility} />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          {c.status === "active" ? (
            <div className="flex gap-2">
              <Card className="flex-1 px-4 py-3">
                <p className="text-[12px] font-medium text-s1-muted">Avg steps, 7 days</p>
                <p className="num text-[20px] font-bold">{c.stats.avgSteps != null ? Math.round(c.stats.avgSteps).toLocaleString("en-US") : "—"}</p>
              </Card>
              <Card className="flex-1 px-4 py-3">
                <p className="text-[12px] font-medium text-s1-muted">Weight</p>
                <p className="num text-[20px] font-bold">{c.stats.weight ? `${kg(c.stats.weight.value)} kg` : "—"}</p>
              </Card>
            </div>
          ) : null}

          {c.visibility.feedback && c.feedbackQuestions ? (
            <section className="flex flex-col gap-2">
              <SectionTitle>Feedback</SectionTitle>
              <Group>
                {c.feedbackDays.map((d) => (
                  <Row
                    key={d.date}
                    href={`${base}/feedback/${d.date}`}
                    title={d.date === c.today ? "Today" : mediumDate(d.date)}
                    sub={
                      d.status === "complete" ? (
                        <span className="text-s1-green">Completed</span>
                      ) : d.date === c.today ? (
                        <span className="text-s1-yellow">{d.status === "started" ? "Started, not complete yet" : "Not complete yet"}</span>
                      ) : (
                        <span className="text-s1-faint">{d.status === "started" ? "Started, not completed" : "Not completed"}</span>
                      )
                    }
                  />
                ))}
              </Group>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <SectionTitle>Workouts logged</SectionTitle>
            {c.workouts.length ? (
              <Group>
                {c.workouts.map((w) => (
                  <Row
                    key={w.id}
                    href={`${base}/workouts/${w.id}`}
                    title={w.dayName}
                    sub={
                      <>
                        {mediumDate(localDate(new Date(w.at)))} · {Math.round(w.volume).toLocaleString("en-US")} kg
                        {w.note ? <span className="block truncate text-s1-pink">“{w.note}”</span> : null}
                      </>
                    }
                  />
                ))}
              </Group>
            ) : (
              <p className="rounded-[20px] bg-s1-surface-2 px-4 py-5 text-[15px] text-s1-muted">Nothing logged yet.</p>
            )}
          </section>

          {c.email || c.phone || c.lineId ? (
            <section className="flex flex-col gap-2">
              <SectionTitle>Contact</SectionTitle>
              <Group>
                {c.phone ? <Row href={`tel:${c.phone}`} title={c.phone} sub="Phone" chevron={false} /> : null}
                {c.lineId ? <Row title={`@${c.lineId}`} sub="LINE" /> : null}
                {c.email ? <Row href={`mailto:${c.email}`} title={c.email} sub="Email" chevron={false} /> : null}
              </Group>
            </section>
          ) : null}
        </div>
      </CoachBody>
    </>
  );
}
