import { AddClientButton, ClientsView } from "@/components/pt/coach/clients-view";
import { CoachBody, CoachHeader } from "@/components/pt/coach/shell";
import { coachClientList } from "@/lib/pt/queries";
import { seesAllClients } from "@/lib/pt/service";
import { requireCoach } from "@/lib/pt/session";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const coach = await requireCoach();
  const lists = await coachClientList(coach);
  return (
    <>
      <CoachHeader title="Clients" sub={seesAllClients(coach) ? "Every coach's clients" : undefined} actions={<AddClientButton />} />
      <CoachBody>
        <ClientsView lists={lists} showCoach={seesAllClients(coach)} />
      </CoachBody>
    </>
  );
}
