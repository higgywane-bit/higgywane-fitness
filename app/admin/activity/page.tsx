import Link from "next/link";
import { and, desc, eq, gte, like, sql } from "drizzle-orm";
import { LinkTabs } from "@/components/admin/link-tabs";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { getDb, t } from "@/lib/db";
import { addDays, formatMoment, localDate } from "@/lib/membership/dates";

export const metadata = { title: "Activity log" };

const KINDS = [
  { id: "all", label: "Everything", prefix: null },
  { id: "membership", label: "Plans sold & changed", prefix: "membership." },
  { id: "member", label: "Members", prefix: "member." },
  { id: "pt", label: "PT", prefix: "pt." },
  { id: "lead", label: "Leads", prefix: "lead." },
  { id: "staff", label: "Team", prefix: "staff." },
  { id: "expense", label: "Expenses", prefix: "expense." },
  { id: "note", label: "Notes", prefix: "note" },
] as const;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ kind?: string; staff?: string }> }) {
  const sp = await searchParams;
  const kind = KINDS.find((k) => k.id === sp.kind) ?? KINDS[0];
  const db = await getDb();
  const since = new Date(`${addDays(localDate(), -30)}T00:00:00+07:00`);
  const staffList = await db.select({ id: t.staff.id, name: t.staff.name }).from(t.staff).orderBy(t.staff.name);
  const rows = await db
    .select({ a: t.activity, firstName: t.members.firstName, lastName: t.members.lastName, staffName: t.staff.name, leadName: t.leads.name })
    .from(t.activity)
    .leftJoin(t.members, eq(t.members.id, t.activity.memberId))
    .leftJoin(t.staff, eq(t.staff.id, t.activity.staffId))
    .leftJoin(t.leads, eq(t.leads.id, t.activity.leadId))
    .where(
      and(
        gte(t.activity.at, since),
        kind.prefix ? like(t.activity.type, `${kind.prefix}%`) : sql`true`,
        sp.staff && /^[0-9a-f-]{36}$/i.test(sp.staff) ? eq(t.activity.staffId, sp.staff) : sql`true`,
      ),
    )
    .orderBy(desc(t.activity.at))
    .limit(300);

  const q = (k: string, s?: string) => `?${new URLSearchParams({ ...(k !== "all" ? { kind: k } : {}), ...(s ? { staff: s } : {}) })}`;

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Who did what · last 30 days" title="Activity log" />
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <LinkTabs label="Type" active={kind.id} tabs={KINDS.map((k) => ({ id: k.id, label: k.label, href: q(k.id, sp.staff) }))} />
        {staffList.length ? (
          <LinkTabs label="Staff" active={sp.staff ?? "anyone"} tabs={[{ id: "anyone", label: "Anyone", href: q(kind.id) }, ...staffList.map((s) => ({ id: s.id, label: s.name, href: q(kind.id, s.id) }))]} />
        ) : null}
        <Panel>
          {rows.length ? (
            <ol className="divide-y divide-hairline">
              {rows.map(({ a, firstName, lastName, staffName, leadName }) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5 text-sm">
                  <span className="tabular w-32 shrink-0 text-xs text-text-tertiary">{formatMoment(a.at)}</span>
                  <span className="min-w-0 flex-1">
                    {a.memberId && firstName ? (
                      <Link href={`/admin/members/${a.memberId}`} className="font-semibold hover:underline">
                        {`${firstName} ${lastName ?? ""}`.trim()}
                      </Link>
                    ) : leadName ? (
                      <Link href="/admin/leads" className="font-semibold hover:underline">
                        {leadName} (lead)
                      </Link>
                    ) : null}
                    {a.memberId || leadName ? " · " : ""}
                    {a.message}
                  </span>
                  <span className="shrink-0 text-xs text-text-secondary">{staffName ?? "—"}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-text-tertiary">Nothing logged.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
