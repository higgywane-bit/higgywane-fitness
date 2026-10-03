import { FrontDesk } from "@/components/admin/check-in/front-desk";
import { PLANS } from "@/content/plans";
import { recentCheckIns, todayCount } from "@/lib/admin/queries";

export const metadata = { title: "Check-in" };

export default async function CheckInPage() {
  const [feed, count] = await Promise.all([recentCheckIns(14), todayCount()]);
  return <FrontDesk initialFeed={feed} initialCount={count} plans={PLANS} promptPayId={process.env.PROMPTPAY_ID ?? null} />;
}
