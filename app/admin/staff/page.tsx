import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { PageHeader } from "@/components/admin/page-header";
import { StaffFormButton } from "@/components/admin/staff-forms";
import { StatTile } from "@/components/admin/stat-tile";
import { Button } from "@/components/ui/button";
import { formatPhone, formatTHB } from "@/lib/format";
import { formatTime } from "@/lib/membership/dates";
import { AREAS, ROLES } from "@/lib/staff/rules";
import { teamOverview } from "@/lib/staff/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const { people } = await teamOverview();
  const active = people.filter((p) => p.active);
  const inNow = active.filter((p) => p.clockedInAt).length;
  const hours = active.reduce((a, p) => a + p.hoursMonth, 0);
  const wages = active.reduce((a, p) => a + (p.wagesMonth ?? 0), 0);

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Team" title="Staff">
        <Button asChild variant="outline">
          <Link href="/admin/staff/rota">Rota & hours</Link>
        </Button>
        <StaffFormButton />
      </PageHeader>
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Team" value={active.length} sub={`${active.filter((p) => p.role === "coach").length} coaches`} />
          <StatTile label="Clocked in now" value={inNow} />
          <StatTile label="Hours this month" value={Math.round(hours)} />
          <StatTile label="Wages this month (est.)" value={wages ? formatTHB(wages) : "—"} sub="Hours × hourly rate" />
        </div>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/staff/${p.id}`} className={cn("tap group flex items-center gap-3 rounded-3xl border border-hairline bg-surface-1 p-4 hover:border-hairline-strong", !p.active && "opacity-50")}>
                <span className="relative">
                  <MemberAvatar name={p.name} className="size-12 text-base" />
                  <span aria-hidden className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2 ring-surface-1" style={{ backgroundColor: p.color ?? "#fff" }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-text-secondary">{ROLES[p.role].label}</span>
                  </span>
                  <span className={cn("block text-sm", p.clockedInAt ? "text-success" : "text-text-secondary")}>
                    {!p.active
                      ? "Inactive"
                      : p.clockedInAt
                        ? `Clocked in ${formatTime(new Date(p.clockedInAt))}`
                        : p.shiftsToday.length
                          ? `Today ${p.shiftsToday.map((s) => `${s.start}–${s.end} ${AREAS[s.area as keyof typeof AREAS] ?? s.area}`).join(", ")}`
                          : "Off today"}
                  </span>
                  <span className="block text-xs text-text-tertiary">
                    {p.hoursMonth} h this month{p.phone ? ` · ${formatPhone(p.phone)}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 text-text-tertiary group-hover:text-white" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        {!people.length ? <p className="text-sm text-text-tertiary">No staff yet. Add the team so check-ins, sales and notes say who did them.</p> : null}
      </div>
    </div>
  );
}
