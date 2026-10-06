import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, Mail, MessageCircle, Phone, Sparkles } from "lucide-react";
import {
  ArchiveButton,
  CardList,
  EditDetailsButton,
  MembershipMenu,
  PassActions,
  SellButton,
  SessionButtons,
} from "@/components/admin/member-actions";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { LogSession } from "@/components/admin/coaching-actions";
import { NoteComposer, TagEditor } from "@/components/admin/member-extras";
import { Panel } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { VisitCalendar } from "@/components/admin/visit-calendar";
import { paymentLabel } from "@/content/gym";
import { getMemberDetail } from "@/lib/admin/queries";
import { formatPhone, formatTHB } from "@/lib/format";
import { expiredLabel, membershipState, sessionsLeft } from "@/lib/membership/access";
import { formatAccessCode } from "@/lib/membership/codes";
import { diffDays, formatDate, formatMoment } from "@/lib/membership/dates";
import { fullName } from "@/lib/membership/service";
import { qrSvg } from "@/lib/qr";
import { eq } from "drizzle-orm";
import { getDb, t } from "@/lib/db";
import { PtAppStatus } from "@/components/admin/pt-app-status";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const d = await getMemberDetail((await params).id).catch(() => null);
  return { title: d ? fullName(d.member) : "Member" };
}

const STATE_LABEL: Record<string, string> = {
  active: "Active",
  upcoming: "Upcoming",
  frozen: "Paused",
  expired: "Ended",
  "used-up": "Used up",
  cancelled: "Cancelled",
};

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string; sell?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getMemberDetail(id);
  if (!d) notFound();
  const { member: m, standing: s, today } = d;
  const name = fullName(m);
  const qr = d.credentials.find((c) => c.kind === "qr" && !c.revokedAt);
  const cards = d.credentials.filter((c) => c.kind === "card" && !c.revokedAt);
  const svg = qr ? await qrSvg(qr.code) : null;
  const sellTarget = { id: m.id, name, coverEnds: s.coverEnds ?? null };
  const gym = s.current;
  const pts = d.memberships.filter((x) => x.kind === "pt" && membershipState(x, today) === "active");
  const db = await getDb();
  const [ptApp] = await db
    .select({ status: t.ptClients.status, coachName: t.staff.name })
    .from(t.ptClients)
    .leftJoin(t.staff, eq(t.staff.id, t.ptClients.coachId))
    .where(eq(t.ptClients.memberId, m.id))
    .limit(1);

  // progress through current cover
  const total = gym && s.coverEnds ? diffDays(gym.startsOn, s.coverEnds) + 1 : 0;
  const elapsed = gym && s.coverEnds ? Math.min(total, Math.max(0, diffDays(gym.startsOn, today) + 1)) : 0;

  return (
    <div className="pb-12">
      <div className="px-4 pt-4 md:px-8 md:pt-6">
        <Link href="/admin/members" className="tap -ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm text-text-secondary hover:text-white">
          <ChevronLeft className="size-4" aria-hidden />
          Members
        </Link>
      </div>

      <header className="flex flex-wrap items-center gap-4 px-4 pt-2 pb-6 md:gap-6 md:px-8 md:pb-8">
        <MemberAvatar name={name} photoUrl={m.photoUrl} className="size-20 text-[28px] md:size-24 md:text-[34px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            {m.archivedAt ? <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-text-secondary">Archived</span> : null}
            {m.source === "glofox" ? <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-text-secondary">From Glofox</span> : null}
            {d.atRisk ? <span className="rounded-full bg-energy/15 px-2.5 py-0.5 text-xs font-semibold text-energy">At risk: no visit in {d.quietDays} days</span> : null}
          </div>
          <h1 className="text-statement mt-2 text-[40px] break-words md:text-[60px]">{name}</h1>
          <p className="mt-1 text-text-secondary">
            <span className="tabular">#{m.memberNo}</span>
            {m.nickname ? ` · “${m.nickname}”` : ""} · Member since {formatDate(m.createdAt.toISOString().slice(0, 10), today)}
          </p>
          <div className="mt-2">
            <TagEditor memberId={m.id} tags={m.tags} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.phone ? (
            <a href={`tel:${m.phone}`} className="tap glass inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium">
              <Phone className="size-4" aria-hidden />
              <span className="tabular">{formatPhone(m.phone)}</span>
            </a>
          ) : null}
          {m.lineId ? (
            <a href={`https://line.me/ti/p/~${encodeURIComponent(m.lineId)}`} target="_blank" rel="noreferrer" className="tap glass inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium">
              <MessageCircle className="size-4" aria-hidden />
              LINE
            </a>
          ) : null}
          {m.email ? (
            <a href={`mailto:${m.email}`} className="tap glass inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium" aria-label={`Email ${m.email}`}>
              <Mail className="size-4" aria-hidden />
              Email
            </a>
          ) : null}
        </div>
      </header>

      {sp.welcome ? (
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-3xl bg-success/10 p-4 ring-1 ring-success/30 ring-inset md:mx-8">
          <Sparkles className="size-5 text-success" aria-hidden />
          <p className="flex-1 text-sm">
            <span className="font-semibold text-success">{m.firstName} is set up.</span> Send them their pass so they can scan in with their phone.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 px-4 md:gap-4 md:px-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3 md:space-y-4">
          {/* gym membership */}
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-text-secondary">Gym membership</p>
                {gym ? (
                  <>
                    <p className="mt-1 text-xl font-semibold">{gym.planName}</p>
                    {s.status === "active" || s.status === "expiring" || s.status === "frozen" ? (
                      <p className={cn("font-display tabular mt-3 text-[64px] leading-none md:text-[80px]", s.status === "expiring" && "text-energy")}>
                        {s.daysLeft === 0 ? "Today" : s.daysLeft}
                        <span className="ml-2 font-sans text-base font-medium text-text-secondary">{s.daysLeft === 0 ? "last day" : "days left"}</span>
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-text-secondary">
                      {s.status === "expired"
                        ? `${expiredLabel(s.daysSinceExpiry ?? 0)} · ended ${formatDate(s.endedOn!, today)}`
                        : s.status === "upcoming"
                          ? `Starts ${formatDate(s.startsOn!, today)}`
                          : s.status === "frozen"
                            ? `Paused until ${formatDate(s.frozenUntil!, today)} · runs to ${formatDate(s.coverEnds!, today)}`
                            : `Runs to ${formatDate(s.coverEnds!, today)}${s.coverEnds !== gym.endsOn ? " · renewal already paid" : ""}`}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xl font-semibold">No membership yet</p>
                )}
              </div>
              <SellButton
                member={sellTarget}
                autoOpen={sp.sell === "1"}
                label={s.status === "none" ? "Sell membership" : s.status === "expired" ? "Renew" : "Renew / add plan"}
              />
            </div>
            {total ? (
              <div className="mt-5">
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={elapsed} aria-label="Membership used">
                  <div className={cn("h-full rounded-full", s.status === "expiring" ? "bg-energy" : "bg-white/80")} style={{ width: `${(elapsed / total) * 100}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-text-tertiary">
                  <span>{formatDate(gym!.startsOn, today)}</span>
                  <span>{formatDate(s.coverEnds!, today)}</span>
                </div>
              </div>
            ) : null}
            {gym && (s.status === "active" || s.status === "expiring" || s.status === "frozen") ? (
              <div className="mt-5 border-t border-hairline pt-4">
                <MembershipMenu membership={{ id: gym.id, planName: gym.planName, endsOn: gym.endsOn, frozenFrom: gym.frozenFrom ?? null, frozenUntil: gym.frozenUntil ?? null }} />
              </div>
            ) : null}
          </Panel>

          {/* PT */}
          <Panel title="Personal training" action={<SellButton member={sellTarget} kind="pt" label="Sell PT pack" variant="outline" />}>
            {pts.length ? (
              <ul className="space-y-4">
                {pts.map((p) => {
                  const left = sessionsLeft(p) ?? 0;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{p.planName}</p>
                        <p className="font-display tabular mt-1 text-[44px] leading-none">
                          {left}
                          <span className="ml-1.5 font-sans text-sm font-medium text-text-secondary">of {p.sessionsTotal} left</span>
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
                          {Array.from({ length: p.sessionsTotal ?? 0 }, (_, i) => (
                            <span key={i} className={cn("h-1.5 w-4 rounded-full", i < p.sessionsUsed ? "bg-white/15" : "bg-red")} />
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-text-tertiary">Valid until {formatDate(p.endsOn, today)}</p>
                      </div>
                      <div className="space-y-2">
                        <LogSession membershipId={p.id} coaches={d.coaches} defaultCoach={d.lastCoach[p.id] ?? null} left={left} />
                        <SessionButtons id={p.id} left={left} used={p.sessionsUsed} undoOnly />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-text-tertiary">No active PT pack.</p>
            )}
            <PtAppStatus memberId={m.id} status={ptApp?.status ?? null} coachName={ptApp?.coachName ?? null} hasEmail={!!m.email} />
          </Panel>

          {/* visits */}
          <Panel
            title="Visits"
            action={
              <span className="tabular text-sm text-text-secondary">
                {d.stats.thisMonth} this month · {d.stats.last30} in 30 days
              </span>
            }
          >
            <VisitCalendar days={d.visitDays} today={today} />
            {d.visits.length ? (
              <ul className="mt-5 divide-y divide-hairline border-t border-hairline">
                {d.visits.slice(0, 6).map((v) => (
                  <li key={v.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <CalendarDays className="size-4 text-text-tertiary" aria-hidden />
                    <span className="flex-1">{formatMoment(v.at)}</span>
                    <span className="text-xs text-text-tertiary capitalize">{v.method}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {d.denied.length ? (
              <p className="mt-4 text-xs text-text-tertiary">
                Turned away {d.denied.length}× recently · last {formatMoment(d.denied[0].at)} ({d.denied[0].reason})
              </p>
            ) : null}
          </Panel>

          {/* history */}
          <Panel title="Plan history">
            {d.memberships.length ? (
              <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs text-text-tertiary">
                    <tr>
                      <th className="pb-2 font-medium">Plan</th>
                      <th className="pb-2 font-medium">Dates</th>
                      <th className="pb-2 font-medium">Paid</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {d.memberships.map((x) => (
                      <tr key={x.id}>
                        <td className="py-3 pr-3 font-medium">{x.planName}</td>
                        <td className="tabular py-3 pr-3 text-text-secondary">
                          {formatDate(x.startsOn, today)} – {formatDate(x.endsOn, today)}
                        </td>
                        <td className="py-3 pr-3 text-text-secondary">
                          <span className="tabular">{x.price ? formatTHB(x.price) : "—"}</span>
                          <span className="block text-xs text-text-tertiary">
                            {paymentLabel(x.paymentMethod)}
                            {x.paymentRef ? ` · ${x.paymentRef}` : ""}
                          </span>
                        </td>
                        <td className="py-3 text-text-secondary">{STATE_LABEL[membershipState(x, today)]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">Nothing sold yet.</p>
            )}
          </Panel>

          <Panel title="Notes & activity">
            <NoteComposer memberId={m.id} />
            <ol className="space-y-3">
              {d.activity.map((a) => (
                <li key={a.id} className={cn("flex gap-3 text-sm", a.type === "note" && "rounded-2xl bg-surface-2 p-3")}>
                  <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", a.type === "note" ? "bg-energy" : "bg-white/40")} />
                  <span className="flex-1">
                    {a.message}
                    {a.staffName ? <span className="text-text-tertiary"> · {a.staffName}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-text-tertiary">{formatMoment(a.at)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-3 md:space-y-4">
          {/* pass */}
          <Panel title="Member pass">
            {qr && svg ? (
              <>
                <div className="mx-auto w-full max-w-[260px] rounded-3xl bg-white p-5">
                  <div className="aspect-square [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`QR code ${qr.code}`} />
                </div>
                <p className="tabular mt-4 text-center font-mono text-2xl tracking-[0.18em]">{formatAccessCode(qr.code)}</p>
                <p className="mt-1 mb-5 text-center text-xs text-text-tertiary">Scan, or type this code at the desk</p>
                <PassActions memberId={m.id} token={m.passToken} name={name} />
              </>
            ) : (
              <p className="text-sm text-text-tertiary">No active code.</p>
            )}
            <div className="mt-6 border-t border-hairline pt-4">
              <h3 className="mb-3 text-[13px] font-medium text-text-secondary">Cards (old Glofox cards keep working)</h3>
              <CardList memberId={m.id} cards={cards.map((c) => ({ id: c.id, code: c.code }))} />
            </div>
          </Panel>

          <Panel
            title="Details"
            action={
              <EditDetailsButton
                memberId={m.id}
                initial={{
                  firstName: m.firstName,
                  lastName: m.lastName,
                  nickname: m.nickname ?? "",
                  phone: m.phone ?? "",
                  email: m.email ?? "",
                  lineId: m.lineId ?? "",
                  birthDate: m.birthDate ?? "",
                  gender: m.gender ?? "",
                  emergencyContact: m.emergencyContact ?? "",
                  notes: m.notes ?? "",
                  marketingOptIn: m.marketingOptIn,
                }}
              />
            }
          >
            <dl className="space-y-3 text-sm">
              {[
                ["Phone", formatPhone(m.phone)],
                ["Email", m.email],
                ["LINE", m.lineId],
                ["Birthday", m.birthDate ? formatDate(m.birthDate, "0000") : null],
                ["Emergency", m.emergencyContact],
                ["Reminders", m.marketingOptIn ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-text-tertiary">{k}</dt>
                  <dd className="truncate text-right">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {m.notes ? <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm whitespace-pre-wrap text-text-secondary">{m.notes}</p> : null}
            <div className="mt-4 border-t border-hairline pt-3">
              <ArchiveButton memberId={m.id} archived={!!m.archivedAt} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
