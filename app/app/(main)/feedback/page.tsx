import { ListChecks } from "lucide-react";
import { FeedbackForm } from "@/components/pt/client/feedback-form";
import { Empty, PageTitle, TopBar } from "@/components/pt/ui";
import { getDb } from "@/lib/db";
import { addDays, isISODate, localDate } from "@/lib/membership/dates";
import { activeQuestions } from "@/lib/pt/feedback";
import { feedbackRange, getPlans } from "@/lib/pt/queries";
import { canEditFeedback } from "@/lib/pt/service";
import { requireClient } from "@/lib/pt/session";

export const metadata = { title: "Daily feedback" };
export const dynamic = "force-dynamic";

/** Clients can look back two weeks. */
const LOOK_BACK = 14;

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const me = await requireClient();
  const today = localDate();
  const { date: raw } = await searchParams;
  const date = raw && isISODate(raw) && raw <= today && raw > addDays(today, -LOOK_BACK) ? raw : today;
  const db = await getDb();
  const [plans, [entry]] = await Promise.all([getPlans(db, me.client.id), feedbackRange(db, me.client.id, date, date)]);
  const questions = me.visibility.feedback ? activeQuestions(plans.feedback.doc) : [];

  return (
    <>
      <TopBar back={{ href: "/app", label: "Home" }} />
      <main className="flex flex-col gap-3 px-4 pt-2 pb-36">
        <PageTitle title="Daily feedback" className="mb-1" />
        {questions.length ? (
          <FeedbackForm
            key={date}
            date={date}
            today={today}
            prev={date > addDays(today, -LOOK_BACK + 1) ? addDays(date, -1) : null}
            next={date < today ? addDays(date, 1) : null}
            editable={canEditFeedback(date, today) && (!entry?.completedAt || date === today)}
            questions={questions}
            initial={entry?.answers ?? {}}
            completedAt={entry?.completedAt ? new Date(entry.completedAt).toISOString() : null}
          />
        ) : (
          <Empty icon={<ListChecks />} title="Nothing to fill in">
            Your coach hasn&apos;t switched daily feedback on.
          </Empty>
        )}
      </main>
    </>
  );
}
