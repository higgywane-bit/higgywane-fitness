import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { SiteTabs } from "@/components/admin/site/site-tabs";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader eyebrow="Edit the website and the till" title="Site & content">
        <Link href="/" target="_blank" className="tap glass inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
          View website <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </PageHeader>
      <div className="px-4 pb-5 md:px-8">
        <SiteTabs />
      </div>
      {children}
    </div>
  );
}
