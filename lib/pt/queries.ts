import "server-only";
import { and, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb, t, type DB } from "@/lib/db";
import type { PtClient, Staff } from "@/lib/db/schema";
import { memberStanding } from "@/lib/membership/access";
import { addDays, localDate, type ISODate } from "@/lib/membership/dates";
import { fullName } from "@/lib/membership/service";
import { clientRowParts, clientSort, initials, sectionOf, urgency, visibilityOf, type ClientStatus, type RowPart } from "./clients";
import { kcalOf } from "./diet";
import { activeQuestions, average, dayStatus, latest, type FeedbackDay } from "./feedback";
import { feedbackRange, getPlans, seesAllClients, workoutHistory } from "./service";
import { workoutVolume } from "./progress";

/*
 * Read models for the PT screens. Every figure comes from the pure rules in lib/pt and
 * lib/membership (sessions left via memberStanding, kcal via kcalOf, averages via
 * feedback.average), never re-derived in a component.
 */

const startOfDay = (d: ISODate) => new Date(`${d}T00:00:00+07:00`);

/** Open PT pack for each member: sessions left, pack size, end date. */
async function packsFor(db: DB, memberIds: string[], today: ISODate) {
  const out = new Map<string, { membershipId: string; sessionsLeft: number; total: number; endsOn: string; planName: string } | null>();
  if (!memberIds.length) return out;
  const rows = await db.select().from(t.memberships).where(inArray(t.memberships.memberId, memberIds));
  for (const id of memberIds) {
    const pt = memberStanding(rows.filter((r) => r.memberId === id), today).pt;
    out.set(
      id,
      pt ? { membershipId: pt.membership.id, sessionsLeft: pt.sessionsLeft, total: pt.membership.sessionsTotal ?? 0, endsOn: pt.endsOn, planName: pt.membership.planName } : null,
    );
  }
  return out;
}

export type ClientListRow = {
  id: string;
  memberId: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  status: ClientStatus;
  coachName: string | null;
  parts: RowPart[];
  urgency: number;
  unread: number;
};

export async function coachClientList(coach: Pick<Staff, "id" | "role">, now = new Date()) {
  const db = await getDb();
  const today = localDate(now);
  const rows = await db
    .select({ c: t.ptClients, m: t.members, coachName: t.staff.name })
    .from(t.ptClients)
    .innerJoin(t.members, eq(t.members.id, t.ptClients.memberId))
    .leftJoin(t.staff, eq(t.staff.id, t.ptClients.coachId))
    .where(seesAllClients(coach) ? undefined : eq(t.ptClients.coachId, coach.id));
  const ids = rows.map((r) => r.c.id);
  const [packs, feedback, trained, unread, feedbackPlans] = await Promise.all([
    packsFor(db, rows.map((r) => r.m.id), today),
    ids.length ? db.select().from(t.dailyFeedback).where(and(inArray(t.dailyFeedback.clientId, ids), eq(t.dailyFeedback.date, today))) : [],
    ids.length
      ? db.selectDistinct({ clientId: t.workoutLogs.clientId }).from(t.workoutLogs).where(and(inArray(t.workoutLogs.clientId, ids), gte(t.workoutLogs.finishedAt, startOfDay(today))))
      : [],
    ids.length
      ? db
          .select({ clientId: t.ptNotifications.clientId, n: sql<number>`count(*)::int` })
          .from(t.ptNotifications)
          .where(and(inArray(t.ptNotifications.clientId, ids), eq(t.ptNotifications.audience, "coach"), isNull(t.ptNotifications.readAt)))
          .groupBy(t.ptNotifications.clientId)
      : [],
    ids.length ? db.select({ clientId: t.ptPlans.clientId, doc: t.ptPlans.doc }).from(t.ptPlans).where(and(inArray(t.ptPlans.clientId, ids), eq(t.ptPlans.kind, "feedback"))) : [],
  ]);
  const fb = new Map(feedback.map((f) => [f.clientId, f]));
  const trainedToday = new Set(trained.map((x) => x.clientId));
  const unreadBy = new Map(unread.map((u) => [u.clientId, u.n]));
  const hasQuestions = new Map(feedbackPlans.map((p) => [p.clientId, ((p.doc as { questions?: { enabled: boolean }[] }).questions ?? []).some((q) => q.enabled)]));

  const list: ClientListRow[] = rows.map(({ c, m, coachName }) => {
    const vis = visibilityOf(c.visibility);
    const f = fb.get(c.id);
    const parts = clientRowParts({
      status: c.status,
      sessionsLeft: packs.get(m.id)?.sessionsLeft ?? null,
      feedbackToday: f ? dayStatus({ date: f.date, answers: f.answers, completedAt: f.completedAt }) : "missing",
      feedbackOn: vis.feedback && (hasQuestions.get(c.id) ?? true),
      workedOutToday: trainedToday.has(c.id),
      inviteExpired: c.status === "invited" && !!c.inviteSentAt && (!c.inviteExpiresAt || c.inviteExpiresAt < now),
    });
    const name = fullName(m);
    return {
      id: c.id,
      memberId: m.id,
      name,
      initials: initials(name),
      photoUrl: m.photoUrl,
      status: c.status,
      coachName: seesAllClients(coach) ? coachName : null,
      parts,
      urgency: urgency(parts) + (unreadBy.get(c.id) ? 1 : 0),
      unread: unreadBy.get(c.id) ?? 0,
    };
  });
  list.sort(clientSort);
  return {
    active: list.filter((r) => sectionOf(r.status) === "active"),
    setup: list.filter((r) => sectionOf(r.status) === "setup"),
    archived: list.filter((r) => sectionOf(r.status) === "archived"),
  };
}

export async function coachOverview(coach: Pick<Staff, "id" | "role">) {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(t.ptNotifications)
    .innerJoin(t.ptClients, eq(t.ptClients.id, t.ptNotifications.clientId))
    .where(and(eq(t.ptNotifications.audience, "coach"), isNull(t.ptNotifications.readAt), seesAllClients(coach) ? undefined : eq(t.ptClients.coachId, coach.id)));
  const leads = await coachLeads(coach.id);
  return { unread: n, newLeads: leads.active.filter((l) => l.stage === "new").length };
}

/** Everything on a client's page in the coach portal. */
export async function clientOverview(client: PtClient, now = new Date()) {
  const db = await getDb();
  const today = localDate(now);
  const [member] = await db.select().from(t.members).where(eq(t.members.id, client.memberId)).limit(1);
  const [coach] = client.coachId ? await db.select({ id: t.staff.id, name: t.staff.name }).from(t.staff).where(eq(t.staff.id, client.coachId)).limit(1) : [];
  const [account] = await db.select({ email: t.clientAccounts.email, lastLoginAt: t.clientAccounts.lastLoginAt }).from(t.clientAccounts).where(eq(t.clientAccounts.memberId, member.id)).limit(1);
  const [packs, plans, feedback, workouts, notes] = await Promise.all([
    packsFor(db, [member.id], today),
    getPlans(db, client.id),
    feedbackRange(db, client.id, addDays(today, -13), today),
    workoutHistory(db, client.id, 8),
    db
      .select()
      .from(t.ptNotifications)
      .where(and(eq(t.ptNotifications.clientId, client.id), eq(t.ptNotifications.audience, "coach")))
      .orderBy(desc(t.ptNotifications.createdAt))
      .limit(10),
  ]);
  const byDate = new Map(feedback.map((f) => [f.date, f]));
  const questions = activeQuestions(plans.feedback.doc);
  return {
    id: client.id,
    memberId: member.id,
    memberNo: member.memberNo,
    name: fullName(member),
    firstName: member.nickname || member.firstName,
    email: account?.email ?? member.email,
    phone: member.phone,
    lineId: member.lineId,
    status: client.status,
    joinedAt: client.joinedAt?.toISOString() ?? null,
    lastSeenAt: client.lastSeenAt?.toISOString() ?? null,
    inviteSentAt: client.inviteSentAt?.toISOString() ?? null,
    inviteExpired: !!client.inviteSentAt && (!client.inviteExpiresAt || client.inviteExpiresAt < now),
    coach: coach ?? null,
    pack: packs.get(member.id) ?? null,
    visibility: visibilityOf(client.visibility),
    workout: { days: plans.workout.doc.days.map((d) => ({ id: d.id, name: d.name, exercises: d.exercises.length })), updatedAt: plans.workout.updatedAt?.toISOString() ?? null },
    diet: { kcal: kcalOf(plans.diet.doc), protein: plans.diet.doc.protein, carbs: plans.diet.doc.carbs, fat: plans.diet.doc.fat, showDailyPlan: plans.diet.doc.showDailyPlan, set: plans.diet.exists },
    feedbackQuestions: questions.length,
    feedbackDays: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, -i);
      const f = byDate.get(date);
      return { date, status: dayStatus(f) };
    }),
    stats: {
      avgSteps: average(feedback, "steps", today, 7),
      weight: latest(feedback, "bodyweight"),
    },
    workouts: workouts.map((w) => ({ id: w.id, dayName: w.dayName, at: w.finishedAt, volume: workoutVolume(w), note: w.note ?? null })),
    notes: notes.map((n) => ({ id: n.id, title: n.title, body: n.body, at: n.createdAt.toISOString(), unread: !n.readAt })),
    today,
  };
}

/** Members a coach can add as clients: everyone with an open PT pack who isn't one yet, plus a name search. */
export async function addableMembers(q: string, now = new Date()) {
  const db = await getDb();
  const today = localDate(now);
  const term = q.trim().toLowerCase();
  const existing = db.select({ id: t.ptClients.memberId }).from(t.ptClients).where(ne(t.ptClients.status, "archived"));
  const rows = await db
    .select()
    .from(t.members)
    .where(
      and(
        isNull(t.members.archivedAt),
        sql`${t.members.id} not in (${existing})`,
        term
          ? sql`(lower(${t.members.firstName} || ' ' || ${t.members.lastName}) like ${`%${term}%`} or lower(coalesce(${t.members.nickname}, '')) like ${`%${term}%`} or ${t.members.phone} like ${`%${term.replace(/\D/g, "") || "~"}%`})`
          : sql`exists (select 1 from ${t.memberships} where ${t.memberships.memberId} = ${t.members.id} and ${t.memberships.kind} = 'pt' and ${t.memberships.cancelledAt} is null and ${t.memberships.endsOn} >= ${today})`,
      ),
    )
    .orderBy(t.members.firstName)
    .limit(25);
  const packs = await packsFor(db, rows.map((r) => r.id), today);
  return rows.map((m) => ({ id: m.id, name: fullName(m), memberNo: m.memberNo, email: m.email, sessionsLeft: packs.get(m.id)?.sessionsLeft ?? null }));
}

export async function coachLeads(coachId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(t.leads)
    .where(and(eq(t.leads.ownerId, coachId)))
    .orderBy(desc(t.leads.createdAt))
    .limit(100);
  const open = (s: string) => s !== "won" && s !== "lost";
  return {
    active: rows.filter((l) => open(l.stage)),
    archived: rows.filter((l) => !open(l.stage)),
  };
}

/* ── client app ──────────────────────────────────────────── */

export async function clientHome(client: PtClient, now = new Date()) {
  const db = await getDb();
  const today = localDate(now);
  const [packs, plans, feedback, inbox, [coach]] = await Promise.all([
    packsFor(db, [client.memberId], today),
    getPlans(db, client.id),
    feedbackRange(db, client.id, addDays(today, -6), today),
    db
      .select()
      .from(t.ptNotifications)
      .where(and(eq(t.ptNotifications.clientId, client.id), eq(t.ptNotifications.audience, "client"), isNull(t.ptNotifications.readAt)))
      .orderBy(desc(t.ptNotifications.createdAt))
      .limit(5),
    client.coachId ? db.select({ name: t.staff.name }).from(t.staff).where(eq(t.staff.id, client.coachId)).limit(1) : Promise.resolve([] as { name: string }[]),
  ]);
  const todayEntry = feedback.find((f) => f.date === today);
  return {
    today,
    coachName: coach?.name ?? null,
    pack: packs.get(client.memberId) ?? null,
    days: plans.workout.doc.days.length,
    kcal: plans.diet.exists ? kcalOf(plans.diet.doc) : null,
    feedbackQuestions: activeQuestions(plans.feedback.doc).length,
    feedbackToday: dayStatus(todayEntry),
    avgSteps: average(feedback, "steps", today, 7),
    weight: latest(feedback as FeedbackDay[], "bodyweight"),
    inbox: inbox.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, at: n.createdAt.toISOString() })),
  };
}

export { getPlans, workoutHistory, feedbackRange };
