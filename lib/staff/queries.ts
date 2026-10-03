import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb, t } from "@/lib/db";
import { addDays, localDate } from "@/lib/membership/dates";
import { entryHours, shiftHours, wageEstimate } from "./rules";

export async function teamOverview(now = new Date()) {
  const db = await getDb();
  const today = localDate(now);
  const monthStart = new Date(`${today.slice(0, 8)}01T00:00:00+07:00`);
  const [people, todayShifts, entries] = await Promise.all([
    db.select().from(t.staff).orderBy(t.staff.name),
    db.select().from(t.shifts).where(eq(t.shifts.date, today)),
    db.select().from(t.timeEntries).where(gte(t.timeEntries.clockIn, monthStart)),
  ]);
  return {
    today,
    people: people.map((p) => {
      const mine = entries.filter((e) => e.staffId === p.id);
      const hours = mine.reduce((a, e) => a + entryHours(e.clockIn, e.clockOut, now), 0);
      const open = mine.find((e) => !e.clockOut);
      return {
        ...p,
        shiftsToday: todayShifts.filter((s) => s.staffId === p.id).map((s) => ({ start: s.start, end: s.end, area: s.area })),
        clockedInAt: open?.clockIn.toISOString() ?? null,
        hoursMonth: Math.round(hours * 10) / 10,
        wagesMonth: wageEstimate(hours, p.hourlyRate),
      };
    }),
  };
}

export async function staffDetail(id: string, now = new Date()) {
  const db = await getDb();
  const [person] = await db.select().from(t.staff).where(eq(t.staff.id, id)).limit(1);
  if (!person) return null;
  const today = localDate(now);
  const monthStart = new Date(`${today.slice(0, 8)}01T00:00:00+07:00`);
  const [entries, upcoming, actions, sessions] = await Promise.all([
    db.select().from(t.timeEntries).where(and(eq(t.timeEntries.staffId, id), gte(t.timeEntries.clockIn, new Date(now.getTime() - 35 * 86_400_000)))).orderBy(desc(t.timeEntries.clockIn)),
    db.select().from(t.shifts).where(and(eq(t.shifts.staffId, id), gte(t.shifts.date, today), lte(t.shifts.date, addDays(today, 13)))).orderBy(t.shifts.date, t.shifts.start),
    db
      .select({ a: t.activity, firstName: t.members.firstName, lastName: t.members.lastName })
      .from(t.activity)
      .leftJoin(t.members, eq(t.members.id, t.activity.memberId))
      .where(eq(t.activity.staffId, id))
      .orderBy(desc(t.activity.at))
      .limit(25),
    person.role === "coach"
      ? db
          .select({ s: t.ptSessions, price: t.memberships.price, total: t.memberships.sessionsTotal })
          .from(t.ptSessions)
          .leftJoin(t.memberships, eq(t.memberships.id, t.ptSessions.membershipId))
          .where(and(eq(t.ptSessions.coachId, id), gte(t.ptSessions.at, monthStart)))
      : Promise.resolve([]),
  ]);
  const monthEntries = entries.filter((e) => e.clockIn >= monthStart);
  const hours = monthEntries.reduce((a, e) => a + entryHours(e.clockIn, e.clockOut, now), 0);
  const value = sessions.reduce((a, x) => a + (x.price && x.total ? x.price / x.total : 0), 0);
  return {
    person,
    today,
    hours: Math.round(hours * 10) / 10,
    wages: wageEstimate(hours, person.hourlyRate),
    entries: entries.map((e) => ({ id: e.id, clockIn: e.clockIn.toISOString(), clockOut: e.clockOut?.toISOString() ?? null, hours: entryHours(e.clockIn, e.clockOut, now) })),
    upcoming: upcoming.map((s) => ({ ...s, hours: shiftHours(s.start, s.end) })),
    actions: actions.map(({ a, firstName, lastName }) => ({ id: a.id, message: a.message, at: a.at.toISOString(), memberId: a.memberId, memberName: firstName ? `${firstName} ${lastName ?? ""}`.trim() : null })),
    pt: person.role === "coach" ? { sessions: sessions.filter((x) => x.s.status === "done").length, commission: person.ptCommissionPct != null ? Math.round((value * person.ptCommissionPct) / 100) : null } : null,
  };
}

export async function rotaWeek(monday: string, now = new Date()) {
  const db = await getDb();
  const sunday = addDays(monday, 6);
  const [people, weekShifts, entries] = await Promise.all([
    db.select().from(t.staff).where(eq(t.staff.active, true)).orderBy(t.staff.role, t.staff.name),
    db.select().from(t.shifts).where(and(gte(t.shifts.date, monday), lte(t.shifts.date, sunday))),
    db
      .select()
      .from(t.timeEntries)
      .where(and(gte(t.timeEntries.clockIn, new Date(`${monday}T00:00:00+07:00`)), lte(t.timeEntries.clockIn, new Date(`${sunday}T23:59:59+07:00`)))),
  ]);
  return {
    people,
    shifts: weekShifts,
    totals: people.map((p) => {
      const planned = weekShifts.filter((s) => s.staffId === p.id).reduce((a, s) => a + shiftHours(s.start, s.end), 0);
      const worked = entries.filter((e) => e.staffId === p.id).reduce((a, e) => a + entryHours(e.clockIn, e.clockOut, now), 0);
      return { id: p.id, planned: Math.round(planned * 10) / 10, worked: Math.round(worked * 10) / 10, wages: wageEstimate(worked, p.hourlyRate) };
    }),
  };
}
