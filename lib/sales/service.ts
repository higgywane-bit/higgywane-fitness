import { sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { sales } from "@/lib/db/schema";
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
