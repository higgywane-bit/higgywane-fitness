import { MenuEditor } from "@/components/admin/site/menu-editor";
import { getCatalog } from "@/lib/catalog/server";

export const metadata = { title: "Menu · Site & content" };

export default async function SiteMenuPage() {
  const c = await getCatalog();
  return <MenuEditor menu={c.menu} categories={c.categories} groups={c.optionGroups} ingredients={c.ingredients} />;
}
