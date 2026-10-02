import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/lib/db/client";
import { checkIns, credentials, members } from "@/lib/db/schema";
import { seedDemo } from "@/lib/db/seed";
import {
  addCard,
  checkIn,
  createMember,
  freezeMembership,
  regenerateQr,
  sellPlan,
  unfreezeMembership,
  useSession,
} from "@/lib/membership/service";
import { planImport, removeDemoData, runImport } from "@/lib/membership/import";

// Runs against a real Postgres (PGlite, in memory) with the real migrations.
let db: DB;
beforeAll(async () => {
  db = (await createDb()).db;
}, 30_000);

const at = (s: string) => new Date(`${s}+07:00`);

async function qrOf(memberId: string) {
  const [c] = await db.select().from(credentials).where(eq(credentials.memberId, memberId));
  return c.code;
}

describe("front desk", () => {
  it("creates a member with a QR code, sells a month, and checks them in", async () => {
    const m = await createMember(db, { firstName: "Nicha", lastName: "S", phone: "081 234 5678" }, at("2026-10-02T09:00:00"));
    expect(m.memberNo).toBeGreaterThanOrEqual(1001);
    expect(m.phone).toBe("+66812345678");
    const code = await qrOf(m.id);

    const denied = await checkIn(db, { code, method: "scan" }, at("2026-10-02T09:01:00"));
    expect(denied).toMatchObject({ allowed: false, reason: "no-membership" });

    await sellPlan(db, m.id, { planId: "1-month", paymentMethod: "cash" }, at("2026-10-02T09:02:00"));
    const ok = await checkIn(db, { code: code.toLowerCase(), method: "typed" }, at("2026-10-02T09:03:00"));
    expect(ok).toMatchObject({ allowed: true, plan: "1 Month", coverEnds: "2026-11-01", daysLeft: 30, duplicate: false });

    const again = await checkIn(db, { code, method: "scan" }, at("2026-10-02T09:04:00"));
    expect(again.duplicate).toBe(true);
    const logged = await db.select().from(checkIns).where(eq(checkIns.memberId, m.id));
    expect(logged.filter((c) => c.allowed)).toHaveLength(1);
  });

  it("stacks a renewal after the current month", async () => {
    const m = await createMember(db, { firstName: "Poom" }, at("2026-10-02T10:00:00"));
    await sellPlan(db, m.id, { planId: "1-month", paymentMethod: "qashier" }, at("2026-10-02T10:00:00"));
    const renewal = await sellPlan(db, m.id, { planId: "1-month", paymentMethod: "qashier" }, at("2026-10-20T10:00:00"));
    expect(renewal.startsOn).toBe("2026-11-02");
    const r = await checkIn(db, { memberId: m.id, method: "search" }, at("2026-10-20T10:05:00"));
    expect(r.coverEnds).toBe("2026-12-01");
    expect(r.daysLeft).toBe(42);
  });

  it("rejects unknown codes and old QR codes after a reset", async () => {
    expect(await checkIn(db, { code: "ZZZZ9999", method: "scan" })).toMatchObject({ allowed: false, reason: "unknown-code" });
    const m = await createMember(db, { firstName: "Bella" });
    const old = await qrOf(m.id);
    const fresh = await regenerateQr(db, m.id);
    expect((await checkIn(db, { code: old, method: "scan" })).reason).toBe("unknown-code");
    expect((await checkIn(db, { code: fresh, method: "scan" })).member?.id).toBe(m.id);
  });

  it("keeps old Glofox cards working", async () => {
    const m = await createMember(db, { firstName: "Aun", cardCode: "0004521" });
    expect((await checkIn(db, { code: "0004521", method: "scan" })).member?.id).toBe(m.id);
    const other = await createMember(db, { firstName: "Other" });
    await expect(addCard(db, other.id, "0004521")).rejects.toThrow("another member");
  });

  it("pauses and resumes", async () => {
    const m = await createMember(db, { firstName: "Ploy" }, at("2026-10-01T08:00:00"));
    const plan = await sellPlan(db, m.id, { planId: "1-month", paymentMethod: "cash" }, at("2026-10-01T08:00:00"));
    await freezeMembership(db, plan.id, "2026-10-05", "2026-10-14");
    expect((await checkIn(db, { memberId: m.id, method: "search" }, at("2026-10-06T08:00:00"))).reason).toBe("frozen");
    await unfreezeMembership(db, plan.id, at("2026-10-08T08:00:00"));
    const r = await checkIn(db, { memberId: m.id, method: "search" }, at("2026-10-08T08:00:00"));
    expect(r.allowed).toBe(true);
    expect(r.coverEnds).toBe("2026-11-03");
  });

  it("counts down PT sessions", async () => {
    const m = await createMember(db, { firstName: "Tae" });
    const pack = await sellPlan(db, m.id, { planId: "pt-3", paymentMethod: "cash" });
    await useSession(db, pack.id);
    await useSession(db, pack.id);
    await useSession(db, pack.id);
    await expect(useSession(db, pack.id)).rejects.toThrow("No sessions left");
  });
});

describe("glofox import", () => {
  const csv = [
    "Member ID,First Name,Last Name,Email,Phone,Membership Name,Membership Expiry Date,Barcode",
    "g1,Mint,K,mint@x.com,0811111111,3 Months,31/12/2026,555001",
    "g2,Beam,L,beam@x.com,0822222222,Monthly,01/09/2026,555002",
    "g3,Mint,K,MINT@x.com,,,,",
    ",,,,,,,",
    "g4,Fah,M,,,,,",
  ].join("\n");

  it("plans, imports, and re-imports safely", async () => {
    const now = at("2026-10-02T12:00:00");
    const plan = await planImport(db, csv, { now });
    expect(plan.totals).toMatchObject({ rows: 4, create: 3, skip: 1, activeMemberships: 1, cards: 2 });

    const result = await runImport(db, plan, now);
    expect(result).toMatchObject({ created: 3, memberships: 2, cards: 2 });
    const r = await checkIn(db, { code: "555001", method: "scan" }, now);
    expect(r).toMatchObject({ allowed: true, plan: "3 Months", coverEnds: "2026-12-31" });
    expect((await checkIn(db, { code: "555002", method: "scan" }, now)).reason).toBe("expired");

    const again = await planImport(db, csv, { now });
    expect(again.totals).toMatchObject({ create: 0, update: 0 });

    const renewed = await planImport(db, csv.replace("01/09/2026", "01/11/2026"), { now });
    expect(renewed.totals.update).toBe(1);
  });
});

describe("demo data", () => {
  it("seeds and removes cleanly", async () => {
    const { db: fresh } = await createDb();
    await seedDemo(fresh);
    expect((await fresh.select().from(members)).length).toBeGreaterThan(40);
    const removed = await removeDemoData(fresh);
    expect(removed).toBeGreaterThan(40);
    expect(await fresh.select().from(checkIns)).toHaveLength(0);
  }, 30_000);
});
