import { FrontDesk } from "@/components/admin/check-in/front-desk";
import { recentCheckIns, todayCount } from "@/lib/admin/queries";

export const metadata = { title: "Check-in" };

export default async function CheckInPage() {
  const [feed, count] = await Promise.all([recentCheckIns(14), todayCount()]);
  return <FrontDesk initialFeed={feed} initialCount={count} />;
}
