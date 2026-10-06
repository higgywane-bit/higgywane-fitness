import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CircleCheck } from "lucide-react";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import { Group, Row } from "@/components/pt/ui";
import { getDb, t } from "@/lib/db";
import { isISODate, localDate } from "@/lib/membership/dates";
import { fullName } from "@/lib/membership/service";
import { mediumDate } from "@/lib/pt/clients";
import { activeQuestions, formatAnswer } from "@/lib/pt/feedback";
import { clientForCoach, feedbackRange, getPlan } from "@/lib/pt/service";
import { requireCoach } from "@/lib/pt/session";

export const metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

export default async function FeedbackDayPage({ params }: { params: Promise<{ id: string; date: string }> }) {
  const { id, date } = await params;
  if (!isISODate(date)) notFound();
  const coach = await requireCoach();
  const db = await getDb();
  const client = await clientForCoach(db, coach, id).catch(() => null);
  if (!client) notFound();
  const [[member], plan, [entry]] = await Promise.all([
    db.select().from(t.members).where(eq(t.members.id, client.memberId)).limit(1),
    getPlan(db, client.id, "feedback"),
    feedbackRange(db, client.id, date, date),
  ]);
  const answers = entry?.answers ?? {};
  // switched-on questions, plus any answered question that has since been switched off
  const questions = plan.doc.questions.filter((q) => q.enabled || answers[q.id] !== undefined);
  const title = date === localDate() ? "Today" : mediumDate(date);

  return (
    <>
      <CoachHeader back={{ href: `/coach/clients/${client.id}`, label: fullName(member) }} title={title} sub="Daily feedback" />
      <CoachBody className="max-w-2xl lg:mx-0">
        {entry?.completedAt ? (
          <div className="flex items-center gap-2.5 rounded-2xl bg-s1-green-tint px-4 py-3.5 text-[15px] font-semibold text-s1-green">
            <CircleCheck className="size-5" aria-hidden />
            Completed at {new Date(entry.completedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}
          </div>
        ) : (
          <div className="rounded-2xl bg-s1-yellow-tint px-4 py-3.5 text-[15px] font-semibold text-s1-yellow">{Object.keys(answers).length ? "Started, not completed" : "Nothing filled in"}</div>
        )}
        <Group>
          {(questions.length ? questions : activeQuestions(plan.doc)).map((q) => (
            <Row key={q.id} title={q.label} trail={<span className="num text-[17px] font-semibold">{formatAnswer(q, answers[q.id])}</span>} />
          ))}
        </Group>
      </CoachBody>
    </>
  );
}
