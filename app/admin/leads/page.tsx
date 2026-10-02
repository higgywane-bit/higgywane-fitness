import { desc } from "drizzle-orm";
import { LeadsBoard } from "@/components/admin/leads-board";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { BarList } from "@/components/admin/charts";
import { getDb, t } from "@/lib/db";
import { SOURCES } from "@/lib/leads/constants";
import { addDays, localDate } from "@/lib/membership/dates";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const db = await getDb();
  const [rows, staff] = await Promise.all([db.select().from(t.leads).orderBy(desc(t.leads.createdAt)), db.select({ id: t.staff.id, name: t.staff.name, active: t.staff.active }).from(t.staff)]);
  const today = localDate();
  const since = addDays(today, -30);
  const recent = rows.filter((l) => localDate(l.createdAt) >= since);
  const won = recent.filter((l) => l.stage === "won").length;
  const due = rows.filter((l) => l.nextFollowUp && l.nextFollowUp <= today && l.stage !== "won" && l.stage !== "lost").length;
  const bySource = new Map<string, { leads: number; won: number }>();
  for (const l of recent) {
    const b = bySource.get(l.source) ?? { leads: 0, won: 0 };
    b.leads++;
    if (l.stage === "won") b.won++;
    bySource.set(l.source, b);
  }
  const names = new Map(staff.map((s) => [s.id, s.name]));

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Enquiries → members" title="Leads" />
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Open leads" value={rows.filter((l) => l.stage !== "won" && l.stage !== "lost").length} />
          <StatTile label="Follow-ups due" value={due} tone={due ? "warn" : undefined} sub="Today or overdue" />
          <StatTile label="New · 30 days" value={recent.length} />
          <StatTile label="Joined · 30 days" value={won} sub={recent.length ? `${Math.round((won / recent.length) * 100)}% converted` : undefined} />
        </div>
        <LeadsBoard
          staff={staff.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
          leads={rows.map((l) => ({
            ...l,
            ownerName: l.ownerId ? (names.get(l.ownerId) ?? null) : null,
            createdAt: l.createdAt.toISOString(),
            stageChangedAt: l.stageChangedAt.toISOString(),
          }))}
        />
        <Panel title="Where leads come from · 30 days">
          <BarList items={[...bySource].sort((a, b) => b[1].leads - a[1].leads).map(([k, v]) => ({ label: `${SOURCES[k as keyof typeof SOURCES] ?? k} · ${v.won} joined`, value: v.leads }))} />
        </Panel>
      </div>
    </div>
  );
}
