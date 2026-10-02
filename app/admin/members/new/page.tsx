import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MemberForm } from "@/components/admin/member-form";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "New member" };

export default function NewMemberPage() {
  return (
    <div className="pb-12">
      <div className="px-4 pt-4 md:px-8 md:pt-6">
        <Link href="/admin/members" className="tap -ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm text-text-secondary hover:text-white">
          <ChevronLeft className="size-4" aria-hidden />
          Members
        </Link>
      </div>
      <PageHeader title="New member" className="pt-2 md:pt-2" />
      <div className="max-w-3xl px-4 md:px-8">
        <p className="mb-8 text-text-secondary">
          They get a personal QR code straight away. Send them the pass link and they scan in with their phone.
        </p>
        <MemberForm />
      </div>
    </div>
  );
}
