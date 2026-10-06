import { CoachShell } from "@/components/pt/coach/shell";
import { RefreshOnFocus } from "@/components/pt/refresh-on-focus";
import { initials } from "@/lib/pt/clients";
import { coachOverview } from "@/lib/pt/queries";
import { coachLang, requireCoach } from "@/lib/pt/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const coach = await requireCoach();
  const [overview, lang] = await Promise.all([coachOverview(coach), coachLang()]);
  return (
    <CoachShell
      coach={{ name: coach.name, initials: initials(coach.name), role: coach.role === "coach" ? "Coach" : coach.role === "owner" ? "Owner" : "Manager" }}
      lang={lang}
      unread={overview.unread}
      newLeads={overview.newLeads}
    >
      <RefreshOnFocus every={60_000} />
      {children}
    </CoachShell>
  );
}
