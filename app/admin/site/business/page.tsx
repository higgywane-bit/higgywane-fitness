import { BusinessEditor } from "@/components/admin/site/business-editor";
import { getCatalog } from "@/lib/catalog/server";

export const metadata = { title: "Business · Site & content" };

export default async function SiteBusinessPage() {
  const c = await getCatalog();
  return <BusinessEditor business={c.business} />;
}
