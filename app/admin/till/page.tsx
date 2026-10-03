import { Till } from "@/components/admin/till/till";
import { business, planList } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalog/server";

export const metadata = { title: "Till" };

export default async function TillPage() {
  await getCatalog();
  return <Till plans={planList()} promptPayId={business().promptPayId || process.env.PROMPTPAY_ID || null} />;
}
