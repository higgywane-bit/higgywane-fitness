import { describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { createDb } from "@/lib/db/client";
import { seedDemo } from "@/lib/db/seed";
import { cafeOrders, expenses, leads, members, ptSessions, shifts, staff, timeEntries } from "@/lib/db/schema";
import { removeDemoData } from "@/lib/membership/import";

describe("demo data", () => {
  it("fills every area and removes cleanly", async () => {
    const { db } = await createDb();
    await seedDemo(db, new Date("2026-10-02T05:00:00Z"));
    const n = async (t: PgTable) => (await db.select({ n: count() }).from(t))[0].n;
    for (const t of [staff, shifts, timeEntries, leads, cafeOrders, expenses, ptSessions]) expect(await n(t)).toBeGreaterThan(0);
    await removeDemoData(db);
    for (const t of [members, staff, shifts, timeEntries, leads, cafeOrders, expenses, ptSessions]) expect(await n(t)).toBe(0);
  }, 60_000);
});
