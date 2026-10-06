import { Utensils } from "lucide-react";
import { Card, Empty, PageTitle, SectionTitle, TopBar } from "@/components/pt/ui";
import { getDb, t } from "@/lib/db";
import { eq } from "drizzle-orm";
import { kcalOf, macroSplit, MACROS } from "@/lib/pt/diet";
import { getPlans } from "@/lib/pt/queries";
import { requireClient } from "@/lib/pt/session";

export const metadata = { title: "My nutrition" };
export const dynamic = "force-dynamic";

const MACRO_COLOR = { protein: "bg-s1-blue", carbs: "bg-white", fat: "bg-s1-pink" } as const;

export default async function NutritionPage() {
  const me = await requireClient();
  const db = await getDb();
  const [plans, [coach]] = await Promise.all([
    getPlans(db, me.client.id),
    me.client.coachId ? db.select({ name: t.staff.name }).from(t.staff).where(eq(t.staff.id, me.client.coachId)) : Promise.resolve([] as { name: string }[]),
  ]);
  const diet = plans.diet.doc;
  const show = me.visibility.nutrition && plans.diet.exists;
  const split = macroSplit(diet);

  return (
    <>
      <TopBar back={{ href: "/app", label: "Home" }} />
      <main className="flex flex-col gap-6 px-4 pt-2 pb-12">
        <PageTitle title="My nutrition" sub={coach ? `Set by ${coach.name}` : undefined} />
        {!show ? (
          <Empty icon={<Utensils />} title="Not set up yet">
            Your coach is working out your macros. They show here as soon as they&apos;re saved.
          </Empty>
        ) : (
          <>
            <Card className="flex flex-col gap-4 p-5">
              <div>
                <p className="num text-[44px] leading-[46px] font-bold tracking-[-0.03em]">{kcalOf(diet).toLocaleString("en-US")}</p>
                <p className="text-[15px] text-s1-muted">kcal a day</p>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-s1-surface-3" role="img" aria-label={`Protein ${split.protein}%, carbs ${split.carbs}%, fat ${split.fat}% of calories`}>
                {MACROS.map((m) => (
                  <span key={m.id} className={MACRO_COLOR[m.id]} style={{ width: `${split[m.id]}%` }} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MACROS.map((m) => (
                  <div key={m.id} className="rounded-2xl bg-s1-surface-3 px-3 py-2.5">
                    <p className="num text-[22px] leading-7 font-bold">{diet[m.id]} g</p>
                    <p className="flex items-center gap-1.5 text-[13px] text-s1-muted">
                      <span className={`size-2 rounded-full ${MACRO_COLOR[m.id]}`} aria-hidden />
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {diet.note ? <Card className="p-4 text-[15px] leading-[22px] text-s1-muted">{diet.note}</Card> : null}

            {diet.showDailyPlan && me.visibility.dailyPlan && diet.meals.length ? (
              <section className="flex flex-col gap-3">
                <SectionTitle>My daily plan</SectionTitle>
                {diet.meals.map((meal) => (
                  <Card key={meal.id} className="p-4">
                    <h2 className="mb-2 text-[17px] font-semibold">{meal.name}</h2>
                    <ul className="flex flex-col divide-y divide-s1-hairline">
                      {meal.foods.map((f) => (
                        <li key={f.id} className="flex min-h-11 items-center justify-between gap-3 text-[16px]">
                          <span>{f.name}</span>
                          <span className="num shrink-0 text-s1-muted">{f.amount}</span>
                        </li>
                      ))}
                      {!meal.foods.length ? <li className="py-2 text-[14px] text-s1-faint">Nothing added yet</li> : null}
                    </ul>
                  </Card>
                ))}
              </section>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
