import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { GYM } from "@/content/gym";
import { getDb, t } from "@/lib/db";
import { memberStanding, type MemberStanding, type MemberStatus } from "@/lib/membership/access";
import { addDays, localDate } from "@/lib/membership/dates";
import { fullName } from "@/lib/membership/service";
import { dailySeries, hourHeatmap, inRange, monthToDateRanges, pctChange } from "./analytics";

export type MemberListRow = {
  id: string;
  memberNo: number;
  name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  source: string;
  archived: boolean;
  createdAt: string;
  status: MemberStatus;
  plan: string | null;
  daysLeft: number | null;
  coverEnds: string | null;
  endedOn: string | null;
  daysSinceExpiry: number | null;
  startsOn: string | null;
  frozenUntil: string | null;
  ptLeft: number | null;
  lastVisit: string | null;
  codes: string[];
  tags: string[];
  marketingOptIn: boolean;
  /** can train but hasn't been in for a while (see AT_RISK_DAYS) */
  atRisk: boolean;
};

/** Active members who haven't visited in this many days are flagged "at risk". */
export const AT_RISK_DAYS = 14;

function toRow(m: typeof t.members.$inferSelect, s: MemberStanding, lastVisit: Date | undefined, codes: string[], now: Date): MemberListRow {
  const quietSince = lastVisit ?? m.createdAt;
  const atRisk = (s.status === "active" || s.status === "expiring") && now.getTime() - quietSince.getTime() > AT_RISK_DAYS * 86_400_000;
  return {
    id: m.id,
    memberNo: m.memberNo,
    name: fullName(m),
    nickname: m.nickname,
    phone: m.phone,
    email: m.email,
    lineId: m.lineId,
    source: m.source,
    archived: !!m.archivedAt,
    createdAt: m.createdAt.toISOString(),
    status: s.status,
    plan: s.current?.planName ?? null,
    daysLeft: s.daysLeft ?? null,
    coverEnds: s.coverEnds ?? null,
    endedOn: s.endedOn ?? null,
    daysSinceExpiry: s.daysSinceExpiry ?? null,
    startsOn: s.startsOn ?? null,
    frozenUntil: s.frozenUntil ?? null,
    ptLeft: s.pt?.sessionsLeft ?? null,
    lastVisit: lastVisit?.toISOString() ?? null,
    codes,
    tags: m.tags ?? [],
    marketingOptIn: m.marketingOptIn,
    atRisk,
  };
}

/** Every member with their standing. A gym this size has hundreds, not millions, so one pass in memory is fine. */
export async function listMembers(now = new Date()): Promise<MemberListRow[]> {
  const db = await getDb();
  const today = localDate(now);
  const [ms, rows, visits, creds] = await Promise.all([
    db.select().from(t.memberships),
    db.select().from(t.members).orderBy(t.members.firstName),
    db
      .select({ memberId: t.checkIns.memberId, last: sql<Date>`max(${t.checkIns.at})`.mapWith((v) => new Date(v)) })
      .from(t.checkIns)
      .where(eq(t.checkIns.allowed, true))
      .groupBy(t.checkIns.memberId),
    db.select({ memberId: t.credentials.memberId, code: t.credentials.code }).from(t.credentials).where(isNull(t.credentials.revokedAt)),
  ]);
  const byMember = new Map<string, typeof ms>();
  for (const m of ms) byMember.set(m.memberId, [...(byMember.get(m.memberId) ?? []), m]);
  const last = new Map(visits.map((v) => [v.memberId, v.last]));
  const codes = new Map<string, string[]>();
  for (const c of creds) codes.set(c.memberId, [...(codes.get(c.memberId) ?? []), c.code]);
  return rows.map((m) => toRow(m, memberStanding(byMember.get(m.id) ?? [], today), last.get(m.id), codes.get(m.id) ?? [], now));
}

export async function getMemberDetail(id: string, now = new Date()) {
  const db = await getDb();
  const [member] = await db.select().from(t.members).where(eq(t.members.id, id)).limit(1);
  if (!member) return null;
  const today = localDate(now);
  const [ms, creds, visits, log] = await Promise.all([
    db.select().from(t.memberships).where(eq(t.memberships.memberId, id)).orderBy(desc(t.memberships.startsOn)),
    db.select().from(t.credentials).where(eq(t.credentials.memberId, id)).orderBy(desc(t.credentials.createdAt)),
    db
      .select()
      .from(t.checkIns)
      .where(and(eq(t.checkIns.memberId, id), gte(t.checkIns.at, new Date(now.getTime() - 400 * 86_400_000))))
      .orderBy(desc(t.checkIns.at)),
    db
      .select({ a: t.activity, staffName: t.staff.name })
      .from(t.activity)
      .leftJoin(t.staff, eq(t.staff.id, t.activity.staffId))
      .where(eq(t.activity.memberId, id))
      .orderBy(desc(t.activity.at))
      .limit(60),
  ]);
  const [coachRows, ptLog] = await Promise.all([
    db.select({ id: t.staff.id, name: t.staff.name }).from(t.staff).where(and(eq(t.staff.role, "coach"), eq(t.staff.active, true))).orderBy(t.staff.name),
    db.select({ membershipId: t.ptSessions.membershipId, coachId: t.ptSessions.coachId }).from(t.ptSessions).where(eq(t.ptSessions.memberId, id)).orderBy(t.ptSessions.at),
  ]);
  const lastCoach: Record<string, string | null> = {};
  for (const l of ptLog) if (l.membershipId) lastCoach[l.membershipId] = l.coachId;
  const standing = memberStanding(ms, today);
  const allowed = visits.filter((v) => v.allowed);
  const quietSince = allowed[0]?.at ?? member.createdAt;
  const quietDays = Math.floor((now.getTime() - quietSince.getTime()) / 86_400_000);
  const atRisk = (standing.status === "active" || standing.status === "expiring") && quietDays > AT_RISK_DAYS;
  return {
    member,
    standing,
    today,
    memberships: ms,
    credentials: creds,
    visits: allowed.slice(0, 30),
    visitDays: [...new Set(allowed.map((v) => localDate(v.at)))],
    denied: visits.filter((v) => !v.allowed).slice(0, 10),
    stats: {
      thisMonth: allowed.filter((v) => localDate(v.at).slice(0, 7) === today.slice(0, 7)).length,
      last30: allowed.filter((v) => localDate(v.at) > addDays(today, -30)).length,
      total: allowed.length,
    },
    activity: log.map((x) => ({ ...x.a, staffName: x.staffName })),
    coaches: coachRows,
    lastCoach,
    atRisk,
    quietDays,
  };
}

export async function searchMembers(q: string, limit = 8) {
  const rows = await listMembers();
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const digits = needle.replace(/\D/g, "");
  return rows
    .filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.nickname?.toLowerCase().includes(needle) ||
        r.email?.includes(needle) ||
        (digits.length >= 3 && (r.phone?.includes(digits) || String(r.memberNo) === digits)) ||
        r.codes.some((c) => c.toLowerCase() === needle.replace(/[^a-z0-9]/g, "")),
    )
    .sort((a, b) => Number(a.archived) - Number(b.archived))
    .slice(0, limit);
}

export type FeedItem = { id: string; at: string; allowed: boolean; reason: string | null; memberId: string | null; name: string | null; method: string; code: string | null };

export async function recentCheckIns(limit = 20, since?: Date): Promise<FeedItem[]> {
  const db = await getDb();
  const rows = await db
    .select({ c: t.checkIns, firstName: t.members.firstName, lastName: t.members.lastName })
    .from(t.checkIns)
    .leftJoin(t.members, eq(t.members.id, t.checkIns.memberId))
    .where(since ? gte(t.checkIns.at, since) : undefined)
    .orderBy(desc(t.checkIns.at))
    .limit(limit);
  return rows.map(({ c, firstName, lastName }) => ({
    id: c.id,
    at: c.at.toISOString(),
    allowed: c.allowed,
    reason: c.reason,
    memberId: c.memberId,
    name: firstName ? fullName({ firstName, lastName: lastName ?? "" }) : null,
    method: c.method,
    code: c.code,
  }));
}

export async function todayCount(now = new Date()) {
  const db = await getDb();
  const start = new Date(`${localDate(now)}T00:00:00+07:00`);
  const [{ n }] = await db
    .select({ n: sql<number>`count(distinct ${t.checkIns.memberId})::int` })
    .from(t.checkIns)
    .where(and(eq(t.checkIns.allowed, true), gte(t.checkIns.at, start)));
  return n;
}

export async function dashboardData(now = new Date()) {
  const db = await getDb();
  const today = localDate(now);
  const since = new Date(now.getTime() - 70 * 86_400_000);
  const [members, visits, till, sold] = await Promise.all([
    listMembers(now),
    db.select({ at: t.checkIns.at, memberId: t.checkIns.memberId }).from(t.checkIns).where(and(eq(t.checkIns.allowed, true), gte(t.checkIns.at, since))),
    db.select({ at: t.sales.occurredAt, amount: t.sales.amountSatang, category: t.sales.category }).from(t.sales).where(gte(t.sales.occurredAt, since)),
    db
      .select({ price: t.memberships.price, kind: t.memberships.kind, createdAt: t.memberships.createdAt })
      .from(t.memberships)
      .where(and(gte(t.memberships.createdAt, since), inArray(t.memberships.source, ["admin", "demo"]))),
  ]);
  const live = members.filter((m) => !m.archived);
  const count = (s: string) => live.filter((m) => m.status === s).length;

  // Visits today vs the same weekday last week, up to the same time.
  const visitTimes = visits.map((v) => v.at);
  const uniqueBetween = (from: Date, to: Date) => new Set(visits.filter((v) => v.at >= from && v.at <= to).map((v) => v.memberId)).size;
  const dayStart = new Date(`${today}T00:00:00+07:00`);
  const weekAgo = 7 * 86_400_000;
  const inToday = uniqueBetween(dayStart, now);
  const inLastWeek = uniqueBetween(new Date(dayStart.getTime() - weekAgo), new Date(now.getTime() - weekAgo));

  const mtd = monthToDateRanges(today);
  const revenue = (from: string, to: string) => till.filter((s) => inRange(s.at, from, to)).reduce((a, s) => a + s.amount, 0) / 100;
  const revThis = revenue(mtd.thisStart, mtd.thisEnd);
  const revPrev = revenue(mtd.prevStart, mtd.prevEnd);
  const byCategory = ["membership", "pt", "cafe", "retail", "other"].map((c) => ({
    category: c,
    value: till.filter((s) => s.category === c && inRange(s.at, mtd.thisStart, mtd.thisEnd)).reduce((a, s) => a + s.amount, 0) / 100,
  }));

  const newThis = live.filter((m) => localDate(new Date(m.createdAt)) >= mtd.thisStart).length;
  const soldThis = sold.filter((s) => s.kind === "membership" && inRange(s.createdAt, mtd.thisStart, mtd.thisEnd));

  const mix = new Map<string, number>();
  for (const m of live) if ((m.status === "active" || m.status === "expiring") && m.plan) mix.set(m.plan, (mix.get(m.plan) ?? 0) + 1);

  return {
    today,
    kpi: {
      active: count("active") + count("expiring"),
      newThisMonth: newThis,
      inToday,
      inTodayChange: pctChange(inToday, inLastWeek),
      expiring: count("expiring"),
      frozen: count("frozen"),
      revenueMonth: revThis,
      revenueChange: pctChange(revThis, revPrev),
      membershipsSold: soldThis.length,
      membershipsSoldValue: soldThis.reduce((a, s) => a + s.price, 0),
      hasSales: till.length > 0,
    },
    visitsDaily: dailySeries(visitTimes, 30, today),
    revenueDaily: dailySeries(till.map((s) => s.at), 30, today, (i) => till[i].amount / 100),
    heatmap: hourHeatmap(visitTimes.filter((d) => d.getTime() > now.getTime() - 56 * 86_400_000), GYM.hours.open, GYM.hours.close),
    byCategory,
    mix: [...mix].map(([plan, n]) => ({ plan, n })).sort((a, b) => b.n - a.n),
    expiring: live.filter((m) => m.status === "expiring").sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)),
    lapsed: live
      .filter((m) => m.status === "expired" && (m.daysSinceExpiry ?? 99) <= 30)
      .sort((a, b) => (a.daysSinceExpiry ?? 0) - (b.daysSinceExpiry ?? 0)),
    feed: await recentCheckIns(8),
  };
}

export async function salesData(now = new Date()) {
  const db = await getDb();
  const today = localDate(now);
  const since = new Date(now.getTime() - 62 * 86_400_000);
  const rows = await db.select().from(t.sales).where(gte(t.sales.occurredAt, since)).orderBy(desc(t.sales.occurredAt));
  const sum = (from: string, to: string) => rows.filter((s) => inRange(s.occurredAt, from, to)).reduce((a, s) => a + s.amountSatang, 0) / 100;
  const mtd = monthToDateRanges(today);
  const [{ total, last }] = await db
    .select({ total: sql<number>`count(*)::int`, last: sql<string | null>`max(${t.sales.occurredAt})::text` })
    .from(t.sales)
    .where(eq(t.sales.source, "qashier"));
  return {
    today: sum(today, today),
    week: sum(addDays(today, -6), today),
    month: sum(mtd.thisStart, today),
    monthChange: pctChange(sum(mtd.thisStart, today), sum(mtd.prevStart, mtd.prevEnd)),
    daily: dailySeries(rows.map((r) => r.occurredAt), 30, today, (i) => rows[i].amountSatang / 100),
    byCategory: ["cafe", "membership", "pt", "retail", "other"].map((c) => ({
      category: c,
      value: rows.filter((s) => s.category === c && inRange(s.occurredAt, mtd.thisStart, today)).reduce((a, s) => a + s.amountSatang, 0) / 100,
    })),
    recent: rows.slice(0, 40).map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString(), createdAt: r.createdAt.toISOString() })),
    qashier: { imported: total, lastSale: last },
  };
}

/** What the member sees on their pass link. Only safe-to-show fields leave the server. */
export async function getPass(token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const db = await getDb();
  const [m] = await db.select().from(t.members).where(eq(t.members.passToken, token)).limit(1);
  if (!m || m.archivedAt) return null;
  const [ms, [qr]] = await Promise.all([
    db.select().from(t.memberships).where(eq(t.memberships.memberId, m.id)),
    db
      .select({ code: t.credentials.code })
      .from(t.credentials)
      .where(and(eq(t.credentials.memberId, m.id), eq(t.credentials.kind, "qr"), isNull(t.credentials.revokedAt)))
      .limit(1),
  ]);
  const today = localDate(now);
  return { firstName: m.firstName, name: fullName(m), memberNo: m.memberNo, code: qr?.code ?? null, standing: memberStanding(ms, today), today };
}
