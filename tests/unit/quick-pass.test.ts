import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/lib/db/client";
import { members, memberships } from "@/lib/db/schema";
import { checkIn, createMember, linkCodeAndCheckIn, quickPass, sellPlan, splitName } from "@/lib/membership/service";

let db: DB;
beforeAll(async () => {
  db = (await createDb()).db;
}, 30_000);

const at = (s: string) => new Date(`${s}+07:00`);

describe("splitName", () => {
  it("splits first and last", () => {
    expect(splitName("  Nok  Siri Wong ")).toEqual({ firstName: "Nok", lastName: "Siri Wong" });
    expect(splitName("Bella")).toEqual({ firstName: "Bella", lastName: "" });
  });
});

describe("quick pass at the desk", () => {
  it("day pass: creates the walk-in, sells the pass and lets them in", async () => {
    const { memberId, result } = await quickPass(
      db,
      { name: "Walk In", phone: "0899999999", email: "walk@in.com", planId: "day-pass", paymentMethod: "cash" },
      at("2026-10-03T08:00:00"),
    );
    expect(result).toMatchObject({ allowed: true, daysLeft: 0, nudge: null });
    const [m] = await db.select().from(members).where(eq(members.id, memberId));
    expect(m).toMatchObject({ firstName: "Walk", lastName: "In", phone: "+66899999999", source: "desk" });
  });

  it("week pass: links the paper code so it scans in all week", async () => {
    const { result } = await quickPass(
      db,
      { name: "Tourist Tom", planId: "1-week", paymentMethod: "qashier", paymentRef: "R-77", code: "482 913" },
      at("2026-10-03T09:00:00"),
    );
    expect(result).toMatchObject({ allowed: true, daysLeft: 6, nudge: null });
    const later = await checkIn(db, { code: "482913", method: "scan" }, at("2026-10-07T10:00:00"));
    expect(later).toMatchObject({ allowed: true, daysLeft: 2, nudge: "renew-soon" });
    const after = await checkIn(db, { code: "482913", method: "scan" }, at("2026-10-10T10:00:00"));
    expect(after).toMatchObject({ allowed: false, reason: "expired" });
  });

  it("refuses a code that belongs to someone else, before creating anyone", async () => {
    const before = (await db.select().from(members)).length;
    await expect(quickPass(db, { name: "Copy Cat", planId: "1-week", paymentMethod: "cash", code: "482913" })).rejects.toThrow(/another member/);
    expect((await db.select().from(members)).length).toBe(before);
  });

  it("sells to an existing member instead of making a duplicate", async () => {
    const m = await createMember(db, { firstName: "Regular" }, at("2026-10-01T08:00:00"));
    const { memberId } = await quickPass(db, { memberId: m.id, planId: "day-pass", paymentMethod: "promptpay" }, at("2026-10-03T11:00:00"));
    expect(memberId).toBe(m.id);
    const ms = await db.select().from(memberships).where(eq(memberships.memberId, m.id));
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ planId: "day-pass", paymentMethod: "promptpay", price: 250 });
  });

  it("needs a name for a new walk-in", async () => {
    await expect(quickPass(db, { name: "  ", planId: "day-pass", paymentMethod: "cash" })).rejects.toThrow(/Name/);
  });
});

describe("link card", () => {
  it("attaches a membership card and checks in with it", async () => {
    const m = await createMember(db, { firstName: "Card", lastName: "Holder" }, at("2026-09-01T08:00:00"));
    await sellPlan(db, m.id, { planId: "3-months", paymentMethod: "qashier" }, at("2026-09-01T08:00:00"));
    const r = await linkCodeAndCheckIn(db, m.id, "100200", at("2026-10-03T07:00:00"));
    expect(r).toMatchObject({ allowed: true, member: { id: m.id } });
    expect(r.daysLeft).toBeGreaterThan(50);
  });
});
