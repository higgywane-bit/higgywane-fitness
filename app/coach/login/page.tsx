import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { CoachLogin } from "@/components/pt/coach/coach-login";
import { Wordmark } from "@/components/pt/ui";
import { getDb, t } from "@/lib/db";
import { initials } from "@/lib/pt/clients";
import { COACH_ROLES } from "@/lib/pt/service";
import { currentCoach } from "@/lib/pt/session";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function CoachLoginPage() {
  if (await currentCoach()) redirect("/coach");
  const db = await getDb();
  const rows = await db
    .select({ id: t.staff.id, name: t.staff.name, role: t.staff.role, pinHash: t.staff.pinHash })
    .from(t.staff)
    .where(and(eq(t.staff.active, true), inArray(t.staff.role, [...COACH_ROLES])))
    .orderBy(t.staff.role, t.staff.name);
  // coaches first, then owner / manager
  const people = [...rows.filter((r) => r.role === "coach"), ...rows.filter((r) => r.role !== "coach")].map((r) => ({
    id: r.id,
    name: r.name,
    initials: initials(r.name),
    role: r.role === "coach" ? "Coach" : r.role === "owner" ? "Owner" : "Manager",
    hasPin: !!r.pinHash,
  }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col gap-3 px-1">
        <Wordmark className="text-[30px]" />
        <h1 className="text-[34px] leading-10 font-bold tracking-[-0.022em]">Coach portal</h1>
        <p className="text-[15px] text-s1-muted">Pick your name and enter your staff PIN.</p>
      </div>
      <CoachLogin people={people} />
    </main>
  );
}
