import Link from "next/link";
import { ChevronRight, Dumbbell, ListChecks, Utensils } from "lucide-react";
import { AccountButton, Notices } from "@/components/pt/client/home-bits";
import { Mark, Stat, TopBar } from "@/components/pt/ui";
import { localClock } from "@/lib/membership/dates";
import { fullName } from "@/lib/membership/service";
import { firstName, greeting, initials, longDate } from "@/lib/pt/clients";
import { kg } from "@/lib/pt/progress";
import { clientHome } from "@/lib/pt/queries";
import { requireClient } from "@/lib/pt/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function BigLink({ href, icon, title, sub, tone = "default" }: { href: string; icon: React.ReactNode; title: string; sub: string; tone?: "go" | "warn" | "default" }) {
  return (
    <Link
      href={href}
      className={cn(
        "tap flex min-h-[78px] items-center gap-4 rounded-[22px] px-4 py-3.5 transition-colors",
        tone === "go" ? "bg-s1-blue text-s1-on-blue" : "bg-s1-surface-2 hover:bg-s1-surface-3",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full [&_svg]:size-[22px]",
          tone === "go" ? "bg-black/15" : tone === "warn" ? "bg-s1-yellow-tint text-s1-yellow" : "bg-s1-surface-3",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[19px] leading-6 font-bold tracking-tight">{title}</span>
        <span className={cn("block text-[14px]", tone === "go" ? "text-black/70" : tone === "warn" ? "text-s1-yellow" : "text-s1-muted")}>{sub}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 opacity-50" aria-hidden />
    </Link>
  );
}

export default async function ClientHomePage() {
  const me = await requireClient();
  const home = await clientHome(me.client);
  const name = fullName(me.member);
  const v = me.visibility;
  const { hour } = localClock(new Date());

  return (
    <>
      <TopBar left={<Mark className="ml-2" />} right={<AccountButton initials={initials(name)} name={name} email={me.email} lang={me.lang} coachName={home.coachName} />} />
      <main className="flex flex-col gap-6 px-4 pt-3 pb-12">
        <div className="px-1">
          <h1 className="text-[34px] leading-10 font-bold tracking-[-0.022em]">
            {greeting(hour)} {me.member.nickname || firstName(me.member.firstName)}
          </h1>
          <p className="text-[15px] text-s1-muted">{longDate(home.today)}</p>
        </div>

        <Notices notices={home.inbox} />

        <div className="flex flex-col gap-2.5">
          {v.workouts ? (
            <BigLink href="/app/workout" tone="go" icon={<Dumbbell />} title="Workout now" sub={home.days ? `${home.days} gym day${home.days === 1 ? "" : "s"}` : "Your coach is building it"} />
          ) : null}
          {v.nutrition ? (
            <BigLink href="/app/nutrition" icon={<Utensils />} title="My nutrition" sub={home.kcal != null ? `${home.kcal.toLocaleString("en-US")} kcal a day` : "Your coach is setting it up"} />
          ) : null}
          {v.feedback && home.feedbackQuestions ? (
            <BigLink
              href="/app/feedback"
              tone={home.feedbackToday === "complete" ? "default" : "warn"}
              icon={<ListChecks />}
              title="Daily feedback"
              sub={home.feedbackToday === "complete" ? "Done for today. Nice." : home.feedbackToday === "started" ? "Today isn't complete. Tap to finish." : "Tap to fill in today"}
            />
          ) : null}
        </div>

        <div className="flex gap-2">
          <Stat label="Sessions left" value={home.pack ? home.pack.sessionsLeft : "—"} />
          {v.homeStats ? (
            <>
              <Stat label="Avg steps" value={home.avgSteps != null ? Math.round(home.avgSteps).toLocaleString("en-US") : "—"} />
              <Stat label="Weight" value={home.weight ? `${kg(home.weight.value)} kg` : "—"} />
            </>
          ) : null}
        </div>
        {home.pack ? (
          <p className="-mt-3 px-1 text-[13px] text-s1-faint">
            {home.pack.planName} with {home.coachName ?? "your coach"}, valid until {new Date(`${home.pack.endsOn}T12:00:00+07:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        ) : null}
      </main>
    </>
  );
}
