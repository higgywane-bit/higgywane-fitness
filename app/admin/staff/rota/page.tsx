import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { AddShift, CopyWeekButton, ShiftChip } from "@/components/admin/staff-forms";
import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
import { addDays, isISODate, localDate } from "@/lib/membership/dates";
import { AREAS, ROLES, weekDays, weekStart } from "@/lib/staff/rules";
import { rotaWeek } from "@/lib/staff/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rota & hours" };

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const today = localDate();
  const monday = weekStart(week && isISODate(week) ? week : today);
  const days = weekDays(monday);
  const d = await rotaWeek(monday);
  const staffOpts = d.people.map((p) => ({ id: p.id, name: p.name }));
  const totals = new Map(d.totals.map((x) => [x.id, x]));
  const sum = d.totals.reduce((a, x) => ({ planned: a.planned + x.planned, worked: a.worked + x.worked, wages: a.wages + (x.wages ?? 0) }), { planned: 0, worked: 0, wages: 0 });

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Team" title="Rota & hours">
        <Button asChild variant="ghost" size="icon" aria-label="Previous week">
          <Link href={`?week=${addDays(monday, -7)}`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <span className="tabular min-w-36 text-center text-sm font-semibold">
          {DAY.format(new Date(`${monday}T00:00:00Z`))} – {DAY.format(new Date(`${days[6]}T00:00:00Z`))}
        </span>
        <Button asChild variant="ghost" size="icon" aria-label="Next week">
          <Link href={`?week=${addDays(monday, 7)}`}>
            <ChevronRight className="size-5" />
          </Link>
        </Button>
        {monday !== weekStart(today) ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/staff/rota">This week</Link>
          </Button>
        ) : null}
        <CopyWeekButton from={addDays(monday, -7)} to={monday} />
      </PageHeader>

      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="overflow-x-auto rounded-3xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-text-tertiary">
                <th className="w-44 p-3 font-medium">Staff</th>
                {days.map((day) => (
                  <th key={day} className={cn("p-3 font-medium", day === today && "text-white")}>
                    {DAY.format(new Date(`${day}T00:00:00Z`))}
                  </th>
                ))}
                <th className="w-28 p-3 text-right font-medium">Planned / worked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {d.people.map((p) => {
                const tot = totals.get(p.id)!;
                return (
                  <tr key={p.id} className="align-top">
                    <td className="p-3">
                      <Link href={`/admin/staff/${p.id}`} className="font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <span className="block text-xs text-text-tertiary">{ROLES[p.role].label}</span>
                    </td>
                    {days.map((day) => (
                      <td key={day} className={cn("space-y-1 p-1.5", day === today && "bg-white/[0.03]")}>
                        {d.shifts
                          .filter((s) => s.staffId === p.id && s.date === day)
                          .sort((a, b) => a.start.localeCompare(b.start))
                          .map((s) => (
                            <ShiftChip key={s.id} id={s.id} label={`${s.start}–${s.end}`} sub={AREAS[s.area as keyof typeof AREAS] ?? s.area} color={p.color} />
                          ))}
                        <AddShift staff={staffOpts} date={day} staffId={p.id} />
                      </td>
                    ))}
                    <td className="tabular p-3 text-right">
                      <span className="block">{tot.planned} h</span>
                      <span className={cn("block text-xs", tot.worked > tot.planned + 2 ? "text-energy" : "text-text-tertiary")}>{tot.worked} h worked</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Panel title="This week in hours">
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-text-secondary">Planned</dt>
              <dd className="font-display tabular mt-1 text-[34px] leading-none">{Math.round(sum.planned)} h</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Worked (clocked)</dt>
              <dd className="font-display tabular mt-1 text-[34px] leading-none">{Math.round(sum.worked)} h</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Wages (est.)</dt>
              <dd className="font-display tabular mt-1 text-[34px] leading-none">{sum.wages ? formatTHB(sum.wages) : "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-text-tertiary">Worked hours come from clock-ins (the “who&apos;s working” button). Wages use each person&apos;s hourly rate. Export timesheets from Settings → Exports.</p>
        </Panel>
      </div>
    </div>
  );
}
