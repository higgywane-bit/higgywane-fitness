import { CoachesEditor } from "@/components/admin/site/coaches-editor";
import { getCatalog } from "@/lib/catalog/server";

export const metadata = { title: "Coaches · Site & content" };

export default async function SiteCoachesPage() {
  const c = await getCatalog();
  return <CoachesEditor coaches={c.coaches} />;
}
