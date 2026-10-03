import { recentCheckIns, todayCount } from "@/lib/admin/queries";
import { AccessDesk } from "@/components/admin/access/access-desk";

export const metadata = { title: "Superfit Access" };

export default async function AccessPage() {
  const [feed, count] = await Promise.all([recentCheckIns(14), todayCount()]);
  return <AccessDesk initialFeed={feed} initialCount={count} />;
}
