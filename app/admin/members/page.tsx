import Link from "next/link";
import { Suspense } from "react";
import { FileUp, UserPlus } from "lucide-react";
import { MembersTable } from "@/components/admin/members-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { listMembers } from "@/lib/admin/queries";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const rows = await listMembers();
  const live = rows.filter((r) => !r.archived).length;
  return (
    <div className="pb-12">
      <PageHeader eyebrow={`${live} members`} title="Members">
        <Button asChild variant="outline">
          <Link href="/admin/import">
            <FileUp className="size-4" aria-hidden />
            Import from Glofox
          </Link>
        </Button>
        <Button asChild>
          <Link href="/admin/members/new">
            <UserPlus className="size-4" aria-hidden />
            New member
          </Link>
        </Button>
      </PageHeader>
      <div className="px-4 md:px-8">
        <Suspense>
          <MembersTable rows={rows} />
        </Suspense>
      </div>
    </div>
  );
}
