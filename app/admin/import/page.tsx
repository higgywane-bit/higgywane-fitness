import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ImportWizard } from "@/components/admin/import-wizard";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Import from Glofox" };

export default function ImportPage() {
  return (
    <div className="pb-12">
      <div className="px-4 pt-4 md:px-8 md:pt-6">
        <Link href="/admin/members" className="tap -ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm text-text-secondary hover:text-white">
          <ChevronLeft className="size-4" aria-hidden />
          Members
        </Link>
      </div>
      <PageHeader eyebrow="Move off Glofox" title="Import members" className="pt-2 md:pt-2" />
      <div className="px-4 md:px-8">
        <ImportWizard />
      </div>
    </div>
  );
}
