import { PLANS } from "@/content/plans";
import { planEndDate } from "@/lib/membership/access";
import { generateAccessCode, generatePassToken } from "@/lib/membership/codes";
import { addDays, localDate } from "@/lib/membership/dates";
import type { DB } from "./client";
import { activity, checkIns, credentials, members, memberships, sales } from "./schema";

/*
 * Demo data for local development: believable members in every state (active,
 * expiring, last day, paused, expired, PT packs), two months of visits and
 * Qashier-style sales. Everything is tagged source = "demo" and can be removed
 * from Settings.
 */

const FIRST = ["Nicha", "Poom", "Bella", "Aun", "Ploy", "Tae", "Mint", "Beam", "Fah", "Gun", "Nong", "Pim", "Bank", "Earth", "Fern", "Golf", "Jay", "Kao", "Mew", "Nat", "Oat", "Pang", "Ton", "Win", "James", "Liam", "Sophie", "Emma", "Lucas", "Mia", "Noah", "Olivia", "Ryan", "Chloe", "Daniel", "Hannah", "Max", "Sarah", "Tom", "Yuki", "Kenji", "Anna", "Marco", "Lea", "Jake", "Isla", "Ben", "Zoe"];
const LAST = ["Srisuk", "Wongsa", "Chaiyaporn", "Rattanakul", "Suwan", "Thongdee", "Boonmee", "Kittisak", "Phromma", "Saetang", "Inthong", "Jaidee", "Smith", "Walker", "Müller", "Rossi", "Tanaka", "Nguyen", "Brown", "Martin", "Kim", "Taylor", "Wilson", "Dubois"];
const CAFE = ["Berry Hype", "Espresso Max", "Strong Vibes", "Latte", "Americano", "Bangkok Beat", "Thick", "Matcha Latte", "Banana Bam Bam", "OJ Classic", "Cappuccino"];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Scenario = { plan: string; endIn: number; freeze?: boolean; pt?: string } | null;

export async function seedDemo(db: DB, now = new Date()) {
  const r = rng(42);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const today = localDate(now);

  // [plan, days until cover ends]: negative = already expired
  const scenarios: Scenario[] = [
    ...Array.from({ length: 22 }, () => {
      const plan = pick(["1-month", "3-months", "6-months", "12-months", "3-months"] as const);
      const length = { "1-month": 30, "3-months": 91, "6-months": 182, "12-months": 365 }[plan];
      return { plan, endIn: 8 + Math.floor(r() * (length - 9)) };
    }),
    { plan: "1-month", endIn: 0 },
    { plan: "1-week", endIn: 0 },
    { plan: "1-month", endIn: 1 },
    { plan: "3-months", endIn: 2 },
    { plan: "1-month", endIn: 3 },
    { plan: "2-weeks", endIn: 5 },
    { plan: "1-month", endIn: 6 },
    { plan: "6-months", endIn: 7 },
    { plan: "1-month", endIn: 20, pt: "pt-10" },
    { plan: "3-months", endIn: 45, pt: "pt-20" },
    { plan: "12-months", endIn: 200, pt: "pt-3" },
    { plan: "3-months", endIn: 30, freeze: true },
    { plan: "day-pass", endIn: 0 },
    ...Array.from({ length: 10 }, () => ({ plan: pick(["1-month", "1-week", "3-months", "day-pass"]), endIn: -1 - Math.floor(r() * 60) })),
    null,
    null,
    null,
  ];

  const people = scenarios.map((s, i) => {
    const first = FIRST[i % FIRST.length];
    const last = pick(LAST);
    const joined = addDays(today, -Math.floor(20 + r() * 500));
    return {
      firstName: first,
      lastName: last,
      nickname: i % 3 === 0 ? first : null,
      email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + `${i}@example.com`,
      phone: `+668${String(10000000 + Math.floor(r() * 89999999))}`,
      source: "demo",
      passToken: generatePassToken(),
      createdAt: new Date(`${joined}T10:00:00+07:00`),
      updatedAt: now,
    };
  });
  const inserted = await db.insert(members).values(people).returning({ id: members.id });

  await db.insert(credentials).values(
    inserted.flatMap((m, i) => [
      { memberId: m.id, kind: "qr", code: generateAccessCode(), createdAt: now },
      ...(i % 4 === 0 ? [{ memberId: m.id, kind: "card", code: String(400100 + i), createdAt: now }] : []),
    ]),
  );

  const rows: (typeof memberships.$inferInsert)[] = [];
  scenarios.forEach((s, i) => {
    if (!s) return;
    const memberId = inserted[i].id;
    const plan = PLANS.find((p) => p.id === s.plan)!;
    const endsOn = addDays(today, s.endIn);
    // Work back to a start date that makes the plan length right.
    let startsOn = today;
    while (planEndDate(startsOn, plan.duration) > endsOn) startsOn = addDays(startsOn, -1);
    while (planEndDate(startsOn, plan.duration) < endsOn) startsOn = addDays(startsOn, 1);
    const method = pick(["qashier", "qashier", "cash", "promptpay", "transfer"]);
    // a previous plan for long-standing members
    if (r() > 0.5) {
      const prevEnd = addDays(startsOn, -1);
      let prevStart = prevEnd;
      while (planEndDate(prevStart, plan.duration) > prevEnd) prevStart = addDays(prevStart, -1);
      rows.push({ memberId, planId: plan.id, planName: plan.name, kind: "membership", startsOn: prevStart, endsOn: prevEnd, price: plan.price, paymentMethod: method, source: "demo", createdAt: new Date(`${prevStart}T09:00:00+07:00`) });
    }
    const freeze = s.freeze ? { frozenFrom: addDays(today, -3), frozenUntil: addDays(today, 11) } : {};
    rows.push({ memberId, planId: plan.id, planName: plan.name, kind: "membership", startsOn, endsOn, price: plan.price, paymentMethod: method, source: "demo", createdAt: new Date(`${startsOn}T09:00:00+07:00`), ...freeze });
    if (s.pt) {
      const pt = PLANS.find((p) => p.id === s.pt)!;
      const ptStart = addDays(today, -20);
      rows.push({ memberId, planId: pt.id, planName: pt.name, kind: "pt", startsOn: ptStart, endsOn: planEndDate(ptStart, pt.duration), sessionsTotal: pt.sessions, sessionsUsed: Math.floor((pt.sessions ?? 1) * 0.4), price: pt.price, paymentMethod: "qashier", source: "demo", createdAt: new Date(`${ptStart}T09:00:00+07:00`) });
    }
  });
  const ms = await db.insert(memberships).values(rows).returning();

  // Visits: regulars come 3–5 times a week at morning or evening peaks.
  const visits: (typeof checkIns.$inferInsert)[] = [];
  for (let day = 59; day >= 0; day--) {
    const date = addDays(today, -day);
    for (const m of ms) {
      if (m.kind !== "membership" || date < m.startsOn || date > m.endsOn) continue;
      if (m.frozenFrom && m.frozenUntil && date >= m.frozenFrom && date <= m.frozenUntil) continue;
      if (r() > 0.55) continue;
      const hour = r() < 0.45 ? 6 + Math.floor(r() * 3) : r() < 0.8 ? 17 + Math.floor(r() * 3) : 10 + Math.floor(r() * 6);
      const at = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00+07:00`);
      if (at > now) continue;
      visits.push({ memberId: m.memberId, membershipId: m.id, method: r() > 0.2 ? "scan" : "typed", allowed: true, at });
    }
  }
  // A few turned away at the desk.
  const expired = ms.filter((m) => m.kind === "membership" && m.endsOn < today).slice(0, 4);
  expired.forEach((m, i) => visits.push({ memberId: m.memberId, membershipId: m.id, method: "scan", allowed: false, reason: "expired", at: new Date(now.getTime() - (i + 1) * 5_400_000) }));
  for (let i = 0; i < visits.length; i += 500) await db.insert(checkIns).values(visits.slice(i, i + 500));

  // Till: cafe through the day + every membership sale.
  const till: (typeof sales.$inferInsert)[] = [];
  let receipt = 30000;
  for (let day = 59; day >= 0; day--) {
    const date = addDays(today, -day);
    const n = 18 + Math.floor(r() * 22) + (new Date(`${date}T00:00:00Z`).getUTCDay() % 6 === 0 ? 10 : 0);
    for (let k = 0; k < n; k++) {
      const hour = 6 + Math.floor(r() * 15);
      const at = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00+07:00`);
      if (at > now) continue;
      const item = pick(CAFE);
      const qty = r() > 0.8 ? 2 : 1;
      const amount = (item === "Americano" ? 80 : item === "Latte" || item === "Cappuccino" ? 120 : 149) * qty;
      till.push({ source: "demo", externalId: `R${receipt++}`, occurredAt: at, amountSatang: amount * 100, category: "cafe", description: qty > 1 ? `${item} ×2` : item, paymentMethod: pick(["QR PromptPay", "Cash", "Card"]) });
    }
  }
  for (const m of ms) {
    const at = m.createdAt;
    if (at.getTime() < now.getTime() - 60 * 86_400_000 || at > now) continue;
    till.push({ source: "demo", externalId: `R${receipt++}`, occurredAt: at, amountSatang: m.price * 100, category: m.kind === "pt" ? "pt" : "membership", description: m.planName, paymentMethod: "Card", memberId: m.memberId });
  }
  for (let i = 0; i < till.length; i += 500) await db.insert(sales).values(till.slice(i, i + 500));

  await db.insert(activity).values(inserted.map((m, i) => ({ memberId: m.id, type: "member.created", message: "Member created", at: people[i].createdAt })));
}
