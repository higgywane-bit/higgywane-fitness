import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getCoach } from "@/content/coaches";
import { getPlan } from "@/content/plans";
import { getDb, t } from "@/lib/db";
import { membershipState, sessionsLeft } from "@/lib/membership/access";
import { addDays, localDate } from "@/lib/membership/dates";
import { fullName } from "@/lib/membership/service";
import { coachStats } from "@/lib/performance/metrics";

export async function coachingData(now = new Date()) {
  const db = await getDb();
  const today = localDate(now);
  const monthStart = new Date(`${today.slice(0, 8)}01T00:00:00+07:00`);
  const [coachRows, bookings, packs, monthSessions, recent] = await Promise.all([
    db.select().from(t.staff).where(and(eq(t.staff.role, "coach"), eq(t.staff.active, true))).orderBy(t.staff.name),
    db.select().from(t.ptBookings).where(gte(t.ptBookings.date, addDays(today, -7))).orderBy(t.ptBookings.date, t.ptBookings.time),
    db
      .select({ m: t.memberships, firstName: t.members.firstName, lastName: t.members.lastName })
      .from(t.memberships)
      .innerJoin(t.members, eq(t.members.id, t.memberships.memberId))
      .where(eq(t.memberships.kind, "pt")),
    db
      .select({ s: t.ptSessions, price: t.memberships.price, total: t.memberships.sessionsTotal })
      .from(t.ptSessions)
      .leftJoin(t.memberships, eq(t.memberships.id, t.ptSessions.membershipId))
      .where(gte(t.ptSessions.at, monthStart)),
    db
      .select({ s: t.ptSessions, firstName: t.members.firstName, lastName: t.members.lastName })
      .from(t.ptSessions)
      .innerJoin(t.members, eq(t.members.id, t.ptSessions.memberId))
      .orderBy(desc(t.ptSessions.at))
      .limit(12),
  ]);

  const active = packs.filter((p) => membershipState(p.m, today) === "active").sort((a, b) => (sessionsLeft(a.m) ?? 0) - (sessionsLeft(b.m) ?? 0));
  const activeIds = active.map((p) => p.m.id);
  const lastCoach = new Map<string, string | null>();
  if (activeIds.length) {
    const ls = await db.select({ membershipId: t.ptSessions.membershipId, coachId: t.ptSessions.coachId }).from(t.ptSessions).where(inArray(t.ptSessions.membershipId, activeIds)).orderBy(t.ptSessions.at);
    for (const l of ls) if (l.membershipId) lastCoach.set(l.membershipId, l.coachId);
  }
  const names = new Map(coachRows.map((c) => [c.id, c.name]));
  const stats = coachStats(
    monthSessions.map((x) => ({ coachId: x.s.coachId, status: x.s.status, packPrice: x.price, packSessions: x.total })),
    coachRows,
  ).map((c) => ({
    ...c,
    clients: new Set(monthSessions.filter((x) => x.s.coachId === c.id).map((x) => x.s.memberId)).size,
  }));

  return {
    today,
    coaches: coachRows.map((c) => ({ id: c.id, name: c.name })),
    stats,
    bookings: bookings.map((b) => ({
      ...b,
      coachName: getCoach(b.coachSlug)?.name ?? b.coachSlug,
      packageName: b.packageId ? (getPlan(b.packageId)?.name ?? b.packageId) : null,
      createdAt: b.createdAt.toISOString(),
    })),
    packs: active.map((p) => ({
      id: p.m.id,
      memberId: p.m.memberId,
      name: fullName(p),
      planName: p.m.planName,
      left: sessionsLeft(p.m) ?? 0,
      total: p.m.sessionsTotal ?? 0,
      endsOn: p.m.endsOn,
      coachId: lastCoach.get(p.m.id) ?? null,
    })),
    recent: recent.map((r) => ({ id: r.s.id, memberId: r.s.memberId, name: fullName(r), at: r.s.at.toISOString(), status: r.s.status, coach: r.s.coachId ? (names.get(r.s.coachId) ?? "Coach") : "—" })),
    monthSessions: monthSessions.filter((x) => x.s.status === "done").length,
  };
}
