import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import { WorkoutEditor } from "@/components/pt/coach/workout-editor";
import { getDb, t } from "@/lib/db";
import { fullName } from "@/lib/membership/service";
import { mergeLibrary } from "@/lib/pt/library";
import { sanitizePlan } from "@/lib/pt/program";
import { clientForCoach, customLibrary, getPlan, listTemplates } from "@/lib/pt/service";
import { coachLang, requireCoach } from "@/lib/pt/session";

export const metadata = { title: "Workout" };
export const dynamic = "force-dynamic";

export default async function ClientWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coach = await requireCoach();
  const db = await getDb();
  const client = await clientForCoach(db, coach, id).catch(() => null);
  if (!client) notFound();
  const [[member], plan, custom, templates, lang] = await Promise.all([
    db.select().from(t.members).where(eq(t.members.id, client.memberId)).limit(1),
    getPlan(db, client.id, "workout"),
    customLibrary(db, coach.id),
    listTemplates(db, coach.id),
    coachLang(),
  ]);
  const lib = mergeLibrary(custom);
  const first = member.nickname || member.firstName;

  return (
    <>
      <CoachHeader back={{ href: `/coach/clients/${client.id}`, label: fullName(member) }} title="Workout" sub={`What ${first} trains. Saving sends it to ${first}'s app.`} />
      <CoachBody>
        <WorkoutEditor
          initial={plan.doc}
          target={{ kind: "client", clientId: client.id, firstName: first, version: plan.version }}
          library={lib.exercises}
          cues={lib.cues}
          lang={lang}
          templates={templates.filter((x) => x.kind === "workout").map((x) => ({ id: x.id, name: x.name, doc: sanitizePlan(x.doc) }))}
        />
      </CoachBody>
    </>
  );
}
