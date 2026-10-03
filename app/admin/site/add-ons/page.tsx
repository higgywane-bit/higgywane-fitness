import { AddonsEditor } from "@/components/admin/site/addons-editor";
import { getCatalog } from "@/lib/catalog/server";

export const metadata = { title: "Add-ons · Site & content" };

export default async function SiteAddonsPage() {
  const c = await getCatalog();
  return <AddonsEditor groups={c.optionGroups} menu={c.menu} ingredients={c.ingredients} />;
}
