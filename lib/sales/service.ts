import { sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { sales, type MembershipRow } from "@/lib/db/schema";
import { currentActor } from "@/lib/staff/context";
import { parseQashierCSV, type SaleInput } from "./qashier";

/** Store sales, ignoring receipts we already have. */
export async function saveSales(db: DB, input: SaleInput[], source = "qashier") {
  let inserted = 0;
  for (let i = 0; i < input.length; i += 250) {
    const part = input.slice(i, i + 250);
    const rows = await db
      .insert(sales)
      .values(part.map((s) => ({ ...s, source })))
      .onConflictDoNothing({ target: [sales.source, sales.externalId] })
      .returning({ id: sales.id });
    inserted += rows.length;
  }
  return { inserted, duplicates: input.length - inserted };
}

export async function importSales(db: DB, csv: string) {
  const parsed = parseQashierCSV(csv);
  const saved = await saveSales(db, parsed.sales);
  const total = parsed.sales.reduce((a, s) => a + s.amountSatang, 0) / 100;
  return { ...saved, skipped: parsed.skipped.slice(0, 20), skippedCount: parsed.skipped.length, total, headers: parsed.headers };
}

export async function salesCount(db: DB) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(sales);
  return n;
}

/**
 * Money taken at the Superfit desk or till. Superfit is the record of every sale;
 * the Qashier terminal is just the card machine.
 */
export async function recordTillSale(
  db: DB,
  s: Omit<SaleInput, "description"> & { description: string; memberId?: string | null },
) {
  await db
    .insert(sales)
    .values({ ...s, source: "pos", memberId: s.memberId ?? null, staffId: currentActor() })
    .onConflictDoNothing({ target: [sales.source, sales.externalId] });
}

/** A plan sold at the desk becomes a sale (unless it was free or imported from Glofox). */
export async function recordPlanSale(db: DB, m: MembershipRow, now = new Date()) {
  if (m.price <= 0 || m.paymentMethod === "comp" || m.paymentMethod === "glofox") return;
  await recordTillSale(db, {
    externalId: `plan:${m.id}`,
    occurredAt: now,
    amountSatang: m.price * 100,
    category: m.kind === "pt" ? "pt" : "membership",
    description: m.planName,
    paymentMethod: m.paymentMethod,
    memberId: m.memberId,
    items: [{ name: m.planName, qty: 1, amountSatang: m.price * 100 }],
  });
}
