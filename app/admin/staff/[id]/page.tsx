import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ActiveToggle, StaffFormButton } from "@/components/admin/staff-forms";
import { StatTile } from "@/components/admin/stat-tile";
import { getCoach } from "@/lib/catalog";
import { formatPhone, formatTHB } from "@/lib/format";
import { formatDate, formatMoment, formatTime, localDate } from "@/lib/membership/dates";
import { AREAS, ROLES } from "@/lib/staff/rules";
import { staffDetail } from "@/lib/staff/queries";

export const metadata = { title: "Staff member" };

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await staffDetail(id);
  if (!d) notFound();
  const p = d.person;

  return (
    <div className="pb-12">
      <div className="px-4 pt-4 md:px-8 md:pt-6">
        <Link href="/admin/staff" className="tap -ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm text-text-secondary hover:text-white">
          <ChevronLeft className="size-4" aria-hidden />
          Staff
        </Link>
      </div>
      <PageHeader eyebrow={`${ROLES[p.role].label}${p.coachSlug ? ` · ${getCoach(p.coachSlug)?.title ?? ""}` : ""}${p.active ? "" : " · inactive"}`} title={p.name} className="pt-2 md:pt-2">
        <ActiveToggle id={p.id} active={p.active} />
        <StaffFormButton
          label="Edit"
          variant="outline"
          initial={{ id: p.id, name: p.name, role: p.role, phone: p.phone ?? "", email: p.email ?? "", coachSlug: p.coachSlug ?? "", hourlyRate: p.hourlyRate?.toString() ?? "", ptCommissionPct: p.ptCommissionPct?.toString() ?? "", hasPin: !!p.pinHash }}
        />
      </PageHeader>
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
          <MemberAvatar name={p.name} className="size-10" />
          {p.phone ? <a href={`tel:${p.phone}`} className="hover:text-white">{formatPhone(p.phone)}</a> : null}
          {p.email ? <a href={`mailto:${p.email}`} className="hover:text-white">{p.email}</a> : null}
          <span>{p.pinHash ? "PIN set" : "No PIN"}</span>
          {p.hourlyRate ? <span>{formatTHB(p.hourlyRate)}/h</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Hours this month" value={d.hours} />
          <StatTile label="Wages this month (est.)" value={d.wages != null ? formatTHB(d.wages) : "—"} sub={p.hourlyRate ? undefined : "Set an hourly rate"} />
          {d.pt ? <StatTile label="PT sessions this month" value={d.pt.sessions} /> : <StatTile label="Shifts next 2 weeks" value={d.upcoming.length} />}
          {d.pt ? <StatTile label="PT pay due (est.)" value={d.pt.commission != null ? formatTHB(d.pt.commission) : "—"} sub={p.ptCommissionPct != null ? `${p.ptCommissionPct}% commission` : "Set a commission %"} /> : <StatTile label="Actions logged" value={d.actions.length} sub="Last 25 shown below" />}
        </div>
        <div className="grid gap-3 md:gap-4 xl:grid-cols-2">
          <Panel title="Upcoming shifts">
            {d.upcoming.length ? (
              <ul className="divide-y divide-hairline text-sm">
                {d.upcoming.map((s) => (
                  <li key={s.id} className="flex min-h-11 items-center justify-between gap-3">
                    <span className="font-medium">{formatDate(s.date, d.today)}</span>
                    <span className="text-text-secondary">{AREAS[s.area as keyof typeof AREAS] ?? s.area}</span>
                    <span className="tabular">{s.start}–{s.end} · {s.hours} h</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-tertiary">No shifts on the rota. <Link href="/admin/staff/rota" className="underline underline-offset-4">Open the rota</Link>.</p>
            )}
          </Panel>
          <Panel title="Time clock · last 5 weeks">
            {d.entries.length ? (
              <ul className="divide-y divide-hairline text-sm">
                {d.entries.slice(0, 14).map((e) => (
                  <li key={e.id} className="flex min-h-11 items-center justify-between gap-3">
                    <span className="font-medium">{formatDate(localDate(new Date(e.clockIn)), d.today)}</span>
                    <span className="tabular text-text-secondary">
                      {formatTime(new Date(e.clockIn))} – {e.clockOut ? formatTime(new Date(e.clockOut)) : <span className="text-success">now</span>}
                    </span>
                    <span className="tabular w-14 text-right">{e.hours.toFixed(1)} h</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-tertiary">No clock-ins yet. Staff clock in from the “who&apos;s working” button.</p>
            )}
          </Panel>
        </div>
        <Panel title="What they did">
          {d.actions.length ? (
            <ol className="space-y-2.5">
              {d.actions.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/40" />
                  <span className="flex-1">
                    {a.memberId && a.memberName ? (
                      <Link href={`/admin/members/${a.memberId}`} className="font-medium hover:underline">
                        {a.memberName}:{" "}
                      </Link>
                    ) : null}
                    {a.message}
                  </span>
                  <span className="shrink-0 text-xs text-text-tertiary">{formatMoment(new Date(a.at))}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-text-tertiary">Nothing logged under {p.name} yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
