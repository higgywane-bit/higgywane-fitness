import { gte } from "drizzle-orm";
import { CafeBoard } from "@/components/admin/cafe-board";
import { PageHeader } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { boardOrders } from "@/lib/cafe/orders";
import { serializeOrders } from "@/lib/cafe/serialize";
import { getDb, t } from "@/lib/db";
import { formatTHB } from "@/lib/format";
import { localDate } from "@/lib/membership/dates";

export const metadata = { title: "Cafe orders" };

export default async function CafePage() {
  const db = await getDb();
  const orders = await boardOrders(db);
  const start = new Date(`${localDate()}T00:00:00+07:00`);
  const today = await db.select({ subtotal: t.cafeOrders.subtotal, status: t.cafeOrders.status, lines: t.cafeOrders.lines }).from(t.cafeOrders).where(gte(t.cafeOrders.createdAt, start));
  const live = today.filter((o) => o.status !== "cancelled");
  const revenue = live.reduce((a, o) => a + o.subtotal, 0);
  const items = new Map<string, number>();
  for (const o of live) for (const l of o.lines) items.set(l.name, (items.get(l.name) ?? 0) + l.qty);
  const top = [...items].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="pb-12">
      <PageHeader eyebrow="Website orders · live" title="Cafe orders" />
      <div className="space-y-3 px-4 md:space-y-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatTile label="Orders today" value={live.length} />
          <StatTile label="Order value today" value={formatTHB(revenue)} />
          <StatTile label="Average order" value={live.length ? formatTHB(revenue / live.length) : "—"} />
          <StatTile label="Most ordered" value={top ? String(top[1]) : "—"} sub={top?.[0]} />
        </div>
        <CafeBoard initial={serializeOrders(orders)} />
        <p className="text-xs text-text-tertiary">
          Orders placed on the website appear here within 10 seconds, with a chime. Customers see “Preparing” and “Ready” on their order page. Orders taken at the counter on Qashier don&apos;t show here.
        </p>
      </div>
    </div>
  );
}
