import { desc, eq, gte } from "drizzle-orm";
import { listMembers } from "@/lib/admin/queries";
import { toCSV } from "@/lib/csv";
import { getDb, t } from "@/lib/db";
import { EXPENSE_CATEGORIES, expensesInRange } from "@/lib/expenses/rules";
import { addDays, addMonths, localDate } from "@/lib/membership/dates";
import { fullName } from "@/lib/membership/service";
import { entryHours } from "@/lib/staff/rules";

/* CSV downloads for accounting, backups, or moving data elsewhere. Protected like the rest of /admin. */

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString();
const baht = (satang: number) => (satang / 100).toFixed(2);

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const db = await getDb();
  const today = localDate();
  let csv: string;

  switch (kind) {
    case "members": {
      const rows = await listMembers();
      csv = toCSV(
        ["Member #", "Name", "Nickname", "Phone", "Email", "LINE", "Status", "Plan", "Days left", "Cover ends", "Last visit", "At risk", "Tags", "Source", "Archived", "Joined", "Codes"],
        rows.map((m) => [m.memberNo, m.name, m.nickname, m.phone, m.email, m.lineId, m.status, m.plan, m.daysLeft, m.coverEnds ?? m.endedOn, m.lastVisit, m.atRisk ? "yes" : "", m.tags.join(" "), m.source, m.archived ? "yes" : "", m.createdAt, m.codes.join(" ")]),
      );
      break;
    }
    case "check-ins": {
      const rows = await db
        .select({ c: t.checkIns, firstName: t.members.firstName, lastName: t.members.lastName, memberNo: t.members.memberNo })
        .from(t.checkIns)
        .leftJoin(t.members, eq(t.members.id, t.checkIns.memberId))
        .where(gte(t.checkIns.at, new Date(`${addDays(today, -90)}T00:00:00+07:00`)))
        .orderBy(desc(t.checkIns.at));
      csv = toCSV(["Time", "Member #", "Name", "Allowed", "Reason", "Method", "Code"], rows.map((r) => [iso(r.c.at), r.memberNo, r.firstName ? fullName({ firstName: r.firstName, lastName: r.lastName ?? "" }) : "", r.c.allowed ? "yes" : "no", r.c.reason, r.c.method, r.c.code]));
      break;
    }
    case "sales": {
      const rows = await db.select().from(t.sales).where(gte(t.sales.occurredAt, new Date(`${addMonths(today, -12)}T00:00:00+07:00`))).orderBy(desc(t.sales.occurredAt));
      csv = toCSV(["Time", "Receipt", "Source", "Category", "Description", "Payment", "Amount (THB)"], rows.map((s) => [iso(s.occurredAt), s.externalId, s.source, s.category, s.description, s.paymentMethod, baht(s.amountSatang)]));
      break;
    }
    case "leads": {
      const rows = await db.select().from(t.leads).orderBy(desc(t.leads.createdAt));
      csv = toCSV(["Created", "Name", "Phone", "Email", "LINE", "Source", "Interest", "Stage", "Follow up", "Lost reason", "Notes"], rows.map((l) => [iso(l.createdAt), l.name, l.phone, l.email, l.lineId, l.source, l.interest, l.stage, l.nextFollowUp, l.lostReason, l.notes]));
      break;
    }
    case "expenses": {
      const rows = expensesInRange(await db.select().from(t.expenses), addMonths(today, -12), today);
      csv = toCSV(["Date", "Category", "Description", "Paid to", "Amount (THB)", "Repeats"], rows.map((e) => [e.occurrence, EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES] ?? e.category, e.description, (e as { vendor?: string | null }).vendor ?? "", baht(e.amountSatang), e.recurring === "monthly" ? "monthly" : ""]));
      break;
    }
    case "timesheets": {
      const rows = await db
        .select({ e: t.timeEntries, name: t.staff.name, rate: t.staff.hourlyRate })
        .from(t.timeEntries)
        .innerJoin(t.staff, eq(t.staff.id, t.timeEntries.staffId))
        .where(gte(t.timeEntries.clockIn, new Date(`${addMonths(`${today.slice(0, 8)}01`, -1)}T00:00:00+07:00`)))
        .orderBy(t.staff.name, t.timeEntries.clockIn);
      csv = toCSV(["Staff", "Date", "Clock in", "Clock out", "Hours", "Hourly rate", "Pay (est.)"], rows.map((r) => {
        const h = entryHours(r.e.clockIn, r.e.clockOut);
        return [r.name, localDate(r.e.clockIn), iso(r.e.clockIn), r.e.clockOut ? iso(r.e.clockOut) : "open", h.toFixed(2), r.rate, r.rate ? Math.round(h * r.rate) : ""];
      }));
      break;
    }
    case "pt-sessions": {
      const rows = await db
        .select({ s: t.ptSessions, firstName: t.members.firstName, lastName: t.members.lastName, coach: t.staff.name, plan: t.memberships.planName })
        .from(t.ptSessions)
        .innerJoin(t.members, eq(t.members.id, t.ptSessions.memberId))
        .leftJoin(t.staff, eq(t.staff.id, t.ptSessions.coachId))
        .leftJoin(t.memberships, eq(t.memberships.id, t.ptSessions.membershipId))
        .orderBy(desc(t.ptSessions.at));
      csv = toCSV(["Time", "Member", "Pack", "Coach", "Status"], rows.map((r) => [iso(r.s.at), fullName({ firstName: r.firstName, lastName: r.lastName }), r.plan, r.coach, r.s.status]));
      break;
    }
    default:
      return new Response("Unknown export", { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="superfit-${kind}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
