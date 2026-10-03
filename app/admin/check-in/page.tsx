import { FrontDesk } from "@/components/admin/check-in/front-desk";
import { business, planList } from "@/lib/catalog";
import { recentCheckIns, todayCount } from "@/lib/admin/queries";

export const metadata = { title: "Check-in" };

export default async function CheckInPage() {
  const [feed, count] = await Promise.all([recentCheckIns(14), todayCount()]);
  return <FrontDesk initialFeed={feed} initialCount={count} plans={planList("membership")} promptPayId={business().promptPayId || process.env.PROMPTPAY_ID || null} />;
}
