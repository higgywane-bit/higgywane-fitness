import type { CafeOrderRow } from "@/lib/db/schema";

export type BoardOrder = Omit<CafeOrderRow, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

export function serializeOrders(rows: CafeOrderRow[]): BoardOrder[] {
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
}
