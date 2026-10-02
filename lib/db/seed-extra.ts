import { coaches } from "@/content/coaches";
import { menu } from "@/content/menu";
import { addDays, addMonths, localDate } from "@/lib/membership/dates";
import { hashPin } from "@/lib/staff/service";
import type { DB } from "./client";
import { cafeOrders, expenses, leads, messages, ptBookings, ptSessions, shifts, staff, timeEntries, type MembershipRow } from "./schema";

/*
 * Demo team, rota, timesheets, coaching, leads, cafe orders and costs, so every admin screen
 * has believable numbers. All rows are flagged demo (or hang off demo staff/members).
 * Demo PINs: Owner 1234; everyone else has no PIN.
 */

type R = () => number;

const at = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);
const hm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export async function seedExtra(db: DB, r: R, now: Date, memberIds: string[], ms: MembershipRow[]) {
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const today = localDate(now);

  /* team */
  const team = await db
    .insert(staff)
    .values([
      { name: "Owner", role: "owner", email: "owner@demo.superfit", color: "#e11d48", demo: true },
      { name: "Mai", role: "desk", phone: "+66811110001", hourlyRate: 120, color: "#7cc4ff", demo: true },
      { name: "Fon", role: "desk", phone: "+66811110002", hourlyRate: 120, color: "#34c759", demo: true },
      { name: "Jom", role: "cafe", phone: "+66811110003", hourlyRate: 110, color: "#fb923c", demo: true },
      ...coaches.map((c, i) => ({
        name: c.name,
        role: "coach" as const,
        coachSlug: c.slug,
        hourlyRate: 200,
        ptCommissionPct: 40,
        color: ["#f5d04c", "#c084fc", "#2dd4bf", "#f472b6"][i % 4],
        demo: true,
      })),
    ])
    .returning();
  const owner = team[0];
  await db.update(staff).set({ pinHash: hashPin(owner.id, "1234") }).where((await import("drizzle-orm")).eq(staff.id, owner.id));
  const [mai, fon, jom] = team.slice(1, 4);
  const coachStaff = team.filter((s) => s.role === "coach");

  /* rota: last week, this week, next week */
  const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const rota: (typeof shifts.$inferInsert)[] = [];
  for (let d = -7; d < 14; d++) {
    const date = addDays(monday, d);
    const wd = (d + 70) % 7; // 0 = Monday
    if (wd !== 6) {
      rota.push({ staffId: mai.id, date, start: "06:00", end: "14:00", area: "desk" });
      rota.push({ staffId: fon.id, date, start: "14:00", end: "22:00", area: "desk" });
      rota.push({ staffId: jom.id, date, start: "07:00", end: "15:00", area: "cafe" });
    } else {
      rota.push({ staffId: mai.id, date, start: "08:00", end: "16:00", area: "desk" });
    }
    coachStaff.forEach((c, i) => {
      if (wd === 6) return;
      if ((wd + i) % 2 === 0) rota.push({ staffId: c.id, date, start: "06:00", end: "10:00", area: "pt" });
      else rota.push({ staffId: c.id, date, start: "16:00", end: "20:00", area: "pt" });
    });
  }
  await db.insert(shifts).values(rota);

  /* timesheets for the last 40 days, following the rota pattern with a little drift */
  const entries: (typeof timeEntries.$inferInsert)[] = [];
  for (let d = 40; d >= 0; d--) {
    const date = addDays(today, -d);
    const wd = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    const plan: [string, number, number][] =
      wd === 6
        ? [[mai.id, 8 * 60, 16 * 60]]
        : [
            [mai.id, 6 * 60, 14 * 60],
            [fon.id, 14 * 60, 22 * 60],
            [jom.id, 7 * 60, 15 * 60],
            ...coachStaff.map((c, i): [string, number, number] => ((wd + i) % 2 === 0 ? [c.id, 6 * 60, 10 * 60] : [c.id, 16 * 60, 20 * 60])),
          ];
    for (const [id, s, e] of plan) {
      if (r() < 0.06) continue; // day off / sick
      const inAt = at(date, hm(s - 10 + Math.floor(r() * 20)));
      if (inAt > now) continue;
      const outAt = at(date, hm(e - 5 + Math.floor(r() * 25)));
      entries.push({ staffId: id, clockIn: inAt, clockOut: outAt > now ? null : outAt });
    }
  }
  await db.insert(timeEntries).values(entries);

  /* PT: sessions behind every pack's used count, credited to coaches */
  const sessions: (typeof ptSessions.$inferInsert)[] = [];
  for (const m of ms.filter((x) => x.kind === "pt")) {
    const coach = pick(coachStaff);
    for (let k = 0; k < m.sessionsUsed; k++) {
      sessions.push({ memberId: m.memberId, membershipId: m.id, coachId: coach.id, at: at(addDays(today, -1 - k * 3), pick(["07:00", "08:00", "17:00", "18:00"])), status: k === 1 ? "no-show" : "done" });
    }
  }
  if (sessions.length) await db.insert(ptSessions).values(sessions);

  await db.insert(ptBookings).values(
    [
      ["Ploy", "bella", "pt-10", 1, "17:00", "requested", "Lose 5 kg before a wedding"],
      ["Arthit", "aun", "pt-3", 2, "07:00", "requested", "Get stronger on squat"],
      ["Sarah K", "nicha", "pt-1", 0, "18:00", "requested", null],
      ["Ben", "poom", "pt-10", 3, "09:00", "confirmed", "Build muscle"],
      ["Nok", "bella", "pt-20", 5, "08:00", "confirmed", "Bikini prep"],
      ["Tim", "aun", "pt-1", -2, "17:00", "done", null],
    ].map(([name, coachSlug, packageId, inDays, time, status, goal], i) => ({
      reference: `PT-${41000 + i}`,
      coachSlug: coachSlug as string,
      packageId: packageId as string,
      date: addDays(today, inDays as number),
      time: time as string,
      name: name as string,
      contact: `08${String(10000000 + Math.floor(r() * 89999999))}`,
      goal: goal as string | null,
      status: status as string,
      demo: true,
      createdAt: new Date(now.getTime() - (i + 1) * 5 * 3_600_000),
    })),
  );

  /* leads across the pipeline */
  const sources = ["walk-in", "instagram", "instagram", "website", "line", "referral", "facebook", "google"];
  const names = ["Arthit", "Kanya", "Mike R", "Pailin", "Somchai", "Jenny L", "Tony W", "Lalisa", "Krit", "Anna P", "Nattapong", "Chris D", "Malee", "Peter H", "Waan", "Sam T", "Prem", "Nina"];
  const stages = ["new", "new", "new", "new", "contacted", "contacted", "contacted", "trial", "trial", "trial", "won", "won", "won", "won", "lost", "lost", "new", "contacted"] as const;
  await db.insert(leads).values(
    names.map((name, i) => {
      const created = new Date(now.getTime() - Math.floor(r() * 45 + 1) * 86_400_000);
      const stage = stages[i];
      return {
        name,
        phone: `+668${String(10000000 + Math.floor(r() * 89999999))}`,
        email: i % 3 === 0 ? `${name.toLowerCase().replace(/[^a-z]/g, "")}${i}@example.com` : null,
        source: pick(sources),
        interest: pick(["membership", "membership", "pt", "day-pass"]),
        stage,
        notes: pick(["Asked about 3 month price", "Wants a coach for fat loss", "Came in with a friend", "Student, asked about discounts", "Moving to the area next month", null]),
        ownerId: pick([mai.id, fon.id, owner.id]),
        nextFollowUp: stage === "new" || stage === "contacted" || stage === "trial" ? addDays(today, Math.floor(r() * 7) - 2) : null,
        lostReason: stage === "lost" ? pick(["Too expensive", "Joined another gym", "No reply"]) : null,
        stageChangedAt: new Date(created.getTime() + 2 * 86_400_000 > now.getTime() ? created.getTime() : created.getTime() + 2 * 86_400_000),
        createdAt: created,
        demo: true,
      };
    }),
  );

  /* cafe orders: a busy board today and a month of history */
  const items = menu.filter((m) => m.available !== false);
  const orders: (typeof cafeOrders.$inferInsert)[] = [];
  let num = 1200;
  for (let d = 30; d >= 0; d--) {
    const date = addDays(today, -d);
    const n = d === 0 ? 9 : 3 + Math.floor(r() * 6);
    for (let k = 0; k < n; k++) {
      // today's orders land in the last 90 minutes so the live board is busy whenever you look
      const created = d === 0 ? new Date(now.getTime() - Math.floor(r() * 90) * 60_000) : at(date, hm(6 * 60 + 30 + Math.floor(r() * 13 * 60)));
      if (created > now) continue;
      const lines = Array.from({ length: r() > 0.7 ? 2 : 1 }, () => {
        const it = pick(items);
        return { name: it.name, qty: r() > 0.85 ? 2 : 1, summary: [], unitPrice: it.basePrice };
      });
      const age = (now.getTime() - created.getTime()) / 60_000;
      const status = d > 0 || age > 45 ? "collected" : age > 20 ? "ready" : age > 8 ? "preparing" : "new";
      const subtotal = lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
      orders.push({
        id: crypto.randomUUID(),
        number: `SF-${num++}`,
        status,
        customerName: pick(["Nicha", "Tom", "Ploy", "James", "Mint", "Beam", "Liam", "Sophie", "Kenji", "Anna"]),
        serviceMode: r() > 0.6 ? "dine-in" : "takeaway",
        table: null,
        lines,
        subtotal,
        protein: Math.round(20 + r() * 40),
        kcal: Math.round(200 + r() * 400),
        paymentMethod: pick(["promptpay", "counter", "apple-pay"]),
        paymentStatus: r() > 0.3 ? "paid" : status === "collected" ? "paid" : "unpaid",
        createdAt: created,
        updatedAt: created,
        demo: true,
      });
    }
  }
  for (let i = 0; i < orders.length; i += 300) await db.insert(cafeOrders).values(orders.slice(i, i + 300));

  /* costs: rent, wages, software monthly; utilities and stock as they come */
  const yearAgo = `${addMonths(today, -13).slice(0, 8)}01`;
  const costs: (typeof expenses.$inferInsert)[] = [
    { date: yearAgo, category: "rent", description: "Gym and cafe rent", vendor: "Landlord", amountSatang: 4_500_000, recurring: "monthly", demo: true },
    { date: addDays(yearAgo, 24), category: "wages", description: "Staff salaries", amountSatang: 6_000_000, recurring: "monthly", demo: true },
    { date: addDays(yearAgo, 4), category: "software", description: "Qashier + website hosting", vendor: "Qashier", amountSatang: 250_000, recurring: "monthly", demo: true },
    { date: addDays(yearAgo, 9), category: "software", description: "Glofox subscription", vendor: "Glofox", amountSatang: 690_000, recurring: "monthly", endsOn: addDays(today, 20), demo: true },
    { date: addDays(today, -40), category: "equipment", description: "New cable machine", vendor: "Fitness supplier", amountSatang: 4_500_000, demo: true },
  ];
  for (let mth = 12; mth >= 0; mth--) {
    const base = addMonths(`${today.slice(0, 8)}01`, -mth);
    if (base > today) continue;
    costs.push({ date: addDays(base, 14), category: "utilities", description: "Electricity", vendor: "PEA", amountSatang: Math.round((9000 + r() * 4000) * 100), demo: true });
    costs.push({ date: addDays(base, 2), category: "marketing", description: "Instagram ads", amountSatang: Math.round((5000 + r() * 6000) * 100), demo: true });
    for (let w = 0; w < 4; w++) {
      const day = addDays(base, 1 + w * 7);
      if (day <= today) costs.push({ date: day, category: "cafe-stock", description: "Cafe stock (milk, fruit, whey)", vendor: "Makro", amountSatang: Math.round((3500 + r() * 2500) * 100), demo: true });
    }
  }
  await db.insert(expenses).values(costs);

  await db.insert(messages).values({
    channel: "email",
    audience: "lapsed-30",
    audienceLabel: "Lapsed (30 days)",
    subject: "We miss you at Superfit, {firstName}",
    body: "Hi {firstName},\n\nIt's been a while! Come back this week and your first day pass is on us.",
    recipients: 6,
    sent: 6,
    status: "preview",
    staffId: owner.id,
    demo: true,
    createdAt: new Date(now.getTime() - 6 * 86_400_000),
  });

  void memberIds;
}
