import Link from "next/link";
import { BookingButtons, LogSession } from "@/components/admin/coaching-actions";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { BOOKING_STATUS } from "@/lib/coaching/service";
import { coachingData } from "@/lib/coaching/queries";
import { formatTHB } from "@/lib/format";
import { formatDate, formatMoment } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Coaching" };

export default async function CoachingPage() {
  const d = await coachingData();
  const waiting = d.bookings.filter((b) => b.status === "requested");
  const upcoming = d.bookings.filter((b) => b.status === "confirmed" && b.date >= d.today);
  const low = d.packs.filter((p) => p.left <= 2).length;

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Personal training" title="Coaching" />
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Requests waiting" value={waiting.length} tone={waiting.length ? "warn" : undefined} sub="From the website" />
          <StatTile label="Sessions this month" value={d.monthSessions} />
          <StatTile label="Active PT clients" value={d.packs.length} />
          <StatTile label="Packs nearly used" value={low} sub="2 sessions or fewer: time to renew" />
        </div>

        <Panel title={`Booking requests · ${waiting.length + upcoming.length}`}>
          {waiting.length + upcoming.length ? (
            <ul className="divide-y divide-hairline">
              {[...waiting, ...upcoming].map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {b.name} <span className="font-normal text-text-secondary">with {b.coachName}</span>
                    </p>
                    <p className="text-sm text-text-secondary">
                      {formatDate(b.date, d.today)} at {b.time} · {b.packageName ?? "PT"} · {b.contact}
                    </p>
                    {b.goal ? <p className="text-xs text-text-tertiary">Goal: {b.goal}</p> : null}
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", b.status === "requested" ? "bg-energy/15 text-energy" : "bg-success/15 text-success")}>
                    {BOOKING_STATUS[b.status as keyof typeof BOOKING_STATUS]}
                  </span>
                  {b.leadId ? (
                    <Link href="/admin/leads" className="text-sm text-text-secondary underline-offset-4 hover:underline">
                      Lead
                    </Link>
                  ) : null}
                  <BookingButtons id={b.id} status={b.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-tertiary">No requests. PT bookings from the coaches pages land here.</p>
          )}
        </Panel>

        <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel title="Coaches · this month">
            {d.stats.length ? (
              <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
                <table className="w-full min-w-[440px] text-left text-sm">
                  <thead className="text-xs text-text-tertiary">
                    <tr>
                      <th className="pb-2 font-medium">Coach</th>
                      <th className="pb-2 text-right font-medium">Sessions</th>
                      <th className="pb-2 text-right font-medium">Clients</th>
                      <th className="pb-2 text-right font-medium">No-shows</th>
                      <th className="pb-2 text-right font-medium">Pay due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {d.stats.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 font-semibold">
                          <Link href={`/admin/staff/${c.id}`} className="hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td className="tabular py-2.5 text-right">{c.sessions}</td>
                        <td className="tabular py-2.5 text-right text-text-secondary">{c.clients}</td>
                        <td className="tabular py-2.5 text-right text-text-secondary">{c.noShows}</td>
                        <td className="tabular py-2.5 text-right font-semibold">{c.commission != null ? formatTHB(c.commission) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-text-tertiary">Pay due = each session&apos;s share of its pack price × the coach&apos;s commission %. Set rates on the coach&apos;s staff profile.</p>
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">
                Add coaches in <Link href="/admin/staff" className="underline underline-offset-4">Staff</Link> (role: Coach).
              </p>
            )}
          </Panel>

          <Panel title="Recent sessions">
            <ul className="divide-y divide-hairline">
              {d.recent.map((r) => (
                <li key={r.id} className="flex min-h-11 items-center gap-3 text-sm">
                  <Link href={`/admin/members/${r.memberId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-text-secondary">{r.coach}</span>
                  {r.status === "no-show" ? <span className="text-xs font-semibold text-energy">No-show</span> : null}
                  <span className="shrink-0 text-xs text-text-tertiary">{formatMoment(new Date(r.at))}</span>
                </li>
              ))}
              {!d.recent.length ? <li className="py-3 text-sm text-text-tertiary">No sessions logged yet.</li> : null}
            </ul>
          </Panel>
        </div>

        <Panel title={`Active PT packs · ${d.packs.length}`}>
          {d.packs.length ? (
            <ul className="divide-y divide-hairline">
              {d.packs.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/members/${p.memberId}`} className="font-semibold hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-sm text-text-secondary">
                      {p.planName} · valid until {formatDate(p.endsOn, d.today)}
                    </p>
                  </div>
                  <p className={cn("tabular w-24 text-sm", p.left <= 2 ? "font-semibold text-energy" : "text-text-secondary")}>
                    {p.left} of {p.total} left
                  </p>
                  <LogSession membershipId={p.id} coaches={d.coaches} defaultCoach={p.coachId} left={p.left} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-tertiary">No active packs. Sell one from a member&apos;s profile.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
