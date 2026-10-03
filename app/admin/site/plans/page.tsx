import { PlansEditor } from "@/components/admin/site/plans-editor";
import { getCatalog } from "@/lib/catalog/server";

export const metadata = { title: "Plans & prices · Site & content" };

export default async function SitePlansPage() {
  const c = await getCatalog();
  return <PlansEditor plans={c.plans} />;
}
