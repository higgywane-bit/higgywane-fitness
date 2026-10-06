import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { DietEditor } from "@/components/pt/coach/diet-editor";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import { getDb, t } from "@/lib/db";
import { fullName } from "@/lib/membership/service";
import { emptyDiet, sanitizeDiet } from "@/lib/pt/diet";
import { clientForCoach, getPlan, listTemplates } from "@/lib/pt/service";
import { requireCoach } from "@/lib/pt/session";

export const metadata = { title: "Nutrition" };
export const dynamic = "force-dynamic";

export default async function ClientNutritionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coach = await requireCoach();
  const db = await getDb();
  const client = await clientForCoach(db, coach, id).catch(() => null);
  if (!client) notFound();
  const [[member], plan, templates] = await Promise.all([
    db.select().from(t.members).where(eq(t.members.id, client.memberId)).limit(1),
    getPlan(db, client.id, "diet"),
    listTemplates(db, coach.id),
  ]);
  const first = member.nickname || member.firstName;
  return (
    <>
      <CoachHeader back={{ href: `/coach/clients/${client.id}`, label: fullName(member) }} title="Nutrition" sub={plan.exists ? `What ${first} eats.` : `Not set up yet. Set the macros and save to send it to ${first}.`} />
      <CoachBody>
        <DietEditor
          initial={plan.exists ? plan.doc : emptyDiet()}
          unsaved={!plan.exists}
          target={{ kind: "client", clientId: client.id, firstName: first, version: plan.version }}
          templates={templates.filter((x) => x.kind === "diet").map((x) => ({ id: x.id, name: x.name, doc: sanitizeDiet(x.doc) }))}
        />
      </CoachBody>
    </>
  );
}
