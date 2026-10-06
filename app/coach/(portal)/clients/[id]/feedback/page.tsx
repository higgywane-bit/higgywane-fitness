import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { FeedbackEditor } from "@/components/pt/coach/feedback-editor";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import { getDb, t } from "@/lib/db";
import { fullName } from "@/lib/membership/service";
import { clientForCoach, getPlan } from "@/lib/pt/service";
import { requireCoach } from "@/lib/pt/session";

export const metadata = { title: "Daily feedback" };
export const dynamic = "force-dynamic";

export default async function FeedbackSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coach = await requireCoach();
  const db = await getDb();
  const client = await clientForCoach(db, coach, id).catch(() => null);
  if (!client) notFound();
  const [[member], plan] = await Promise.all([db.select().from(t.members).where(eq(t.members.id, client.memberId)).limit(1), getPlan(db, client.id, "feedback")]);
  const first = member.nickname || member.firstName;
  return (
    <>
      <CoachHeader back={{ href: `/coach/clients/${client.id}`, label: fullName(member) }} title="Daily feedback" />
      <CoachBody>
        <FeedbackEditor initial={plan.doc} clientId={client.id} firstName={first} version={plan.version} unsaved={!plan.exists} />
      </CoachBody>
    </>
  );
}
