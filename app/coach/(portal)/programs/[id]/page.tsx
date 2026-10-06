import { notFound } from "next/navigation";
import { DietEditor } from "@/components/pt/coach/diet-editor";
import { ProgramActions } from "@/components/pt/coach/programs-bits";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import { WorkoutEditor } from "@/components/pt/coach/workout-editor";
import { getDb } from "@/lib/db";
import { emptyDiet, sanitizeDiet } from "@/lib/pt/diet";
import { mergeLibrary } from "@/lib/pt/library";
import { emptyPlan, sanitizePlan } from "@/lib/pt/program";
import { coachClientList } from "@/lib/pt/queries";
import { customLibrary, getTemplate } from "@/lib/pt/service";
import { coachLang, requireCoach } from "@/lib/pt/session";

export const metadata = { title: "Program" };
export const dynamic = "force-dynamic";

/** /coach/programs/new?kind=workout|diet, or /coach/programs/<id> */
export default async function ProgramPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const [{ id }, { kind: k }] = await Promise.all([params, searchParams]);
  const coach = await requireCoach();
  const db = await getDb();
  const isNew = id === "new";
  const row = isNew ? null : await getTemplate(db, coach.id, id).catch(() => null);
  if (!isNew && !row) notFound();
  const kind = (row?.kind ?? (k === "diet" ? "diet" : "workout")) as "workout" | "diet";
  const [custom, lang, lists] = await Promise.all([customLibrary(db, coach.id), coachLang(), coachClientList(coach)]);
  const lib = mergeLibrary(custom);
  const clients = [...lists.active, ...lists.setup].map((c) => ({ id: c.id, name: c.name, initials: c.initials }));

  return (
    <>
      <CoachHeader
        back={{ href: "/coach/programs", label: "Programs" }}
        title={row?.name ?? (kind === "workout" ? "New workout program" : "New diet")}
        sub={kind === "workout" ? "Workout program" : "Diet"}
        actions={row ? <ProgramActions id={row.id} name={row.name} clients={clients} /> : null}
      />
      <CoachBody>
        {kind === "workout" ? (
          <WorkoutEditor
            initial={row ? sanitizePlan(row.doc) : emptyPlan()}
            target={{ kind: "template", id: row?.id, name: row?.name ?? "" }}
            library={lib.exercises}
            cues={lib.cues}
            lang={lang}
          />
        ) : (
          <DietEditor initial={row ? sanitizeDiet(row.doc) : emptyDiet()} target={{ kind: "template", id: row?.id, name: row?.name ?? "" }} />
        )}
      </CoachBody>
    </>
  );
}
