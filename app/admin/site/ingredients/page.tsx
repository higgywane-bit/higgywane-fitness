import { IngredientsEditor } from "@/components/admin/site/ingredients-editor";
import { getCatalog } from "@/lib/catalog/server";

export const metadata = { title: "Ingredients · Site & content" };

export default async function SiteIngredientsPage() {
  const c = await getCatalog();
  return <IngredientsEditor ingredients={c.ingredients} />;
}
