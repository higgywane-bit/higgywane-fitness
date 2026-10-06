import { ProgramsList } from "@/components/pt/coach/programs-bits";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import { getDb } from "@/lib/db";
import { kcalOf, sanitizeDiet } from "@/lib/pt/diet";
import { sanitizePlan } from "@/lib/pt/program";
import { listTemplates } from "@/lib/pt/service";
import { requireCoach } from "@/lib/pt/session";

export const metadata = { title: "Programs" };
export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const coach = await requireCoach();
  const rows = await listTemplates(await getDb(), coach.id);
  const workouts = rows
    .filter((r) => r.kind === "workout")
    .map((r) => {
      const p = sanitizePlan(r.doc);
      return { id: r.id, name: r.name, sub: `${p.days.length} day${p.days.length === 1 ? "" : "s"}: ${p.days.map((d) => d.name).join(", ") || "empty"}` };
    });
  const diets = rows
    .filter((r) => r.kind === "diet")
    .map((r) => {
      const d = sanitizeDiet(r.doc);
      return { id: r.id, name: r.name, sub: `${kcalOf(d).toLocaleString("en-US")} kcal · ${d.protein} g protein${d.showDailyPlan ? ` · ${d.meals.length} meals` : ""}` };
    });
  return (
    <>
      <CoachHeader title="Programs" sub="Your own workouts and diets, ready to load for any client" />
      <CoachBody>
        <ProgramsList workouts={workouts} diets={diets} />
      </CoachBody>
    </>
  );
}
