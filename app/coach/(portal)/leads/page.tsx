import { LeadsView, type LeadItem } from "@/components/pt/coach/leads-view";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import type { Lead } from "@/lib/db/schema";
import { coachLeads } from "@/lib/pt/queries";
import { requireCoach } from "@/lib/pt/session";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

const item = (l: Lead): LeadItem => ({
  id: l.id,
  name: l.name,
  phone: l.phone,
  email: l.email,
  lineId: l.lineId,
  source: l.source,
  interest: l.interest,
  stage: l.stage,
  notes: l.notes,
  createdAt: l.createdAt.toISOString(),
});

export default async function LeadsPage() {
  const coach = await requireCoach();
  const leads = await coachLeads(coach.id);
  return (
    <>
      <CoachHeader title="Leads" sub="Enquiries the desk has passed to you" />
      <CoachBody>
        <LeadsView active={leads.active.map(item)} archived={leads.archived.map(item)} />
      </CoachBody>
    </>
  );
}
