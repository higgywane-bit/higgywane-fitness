import type { Metadata } from "next";
import { and, count, eq, inArray } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-shell";
import { CatalogProvider } from "@/components/catalog-provider";
import { getCatalog } from "@/lib/catalog/server";
import { adminAuthConfig } from "@/lib/admin-auth";
import { getDb, t } from "@/lib/db";
import { listStaff, openEntry } from "@/lib/staff/service";
import { actingStaffId } from "@/lib/staff/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Superfit Admin" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const db = await getDb();
  const catalog = await getCatalog();
  const [staff, actingId, [orders], [bookings], [leadsNew]] = await Promise.all([
    listStaff(db),
    actingStaffId(),
    db.select({ n: count() }).from(t.cafeOrders).where(inArray(t.cafeOrders.status, ["new", "preparing"])),
    db.select({ n: count() }).from(t.ptBookings).where(eq(t.ptBookings.status, "requested")),
    db.select({ n: count() }).from(t.leads).where(and(eq(t.leads.stage, "new"))),
  ]);
  const me = staff.find((s) => s.id === actingId) ?? null;
  const open = me ? await openEntry(db, me.id) : null;

  return (
    <AdminShell
      staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role, hasPin: !!s.pinHash, color: s.color }))}
      acting={me ? { id: me.id, name: me.name, clockedInAt: open?.clockIn.toISOString() ?? null } : null}
      signedIn={!!adminAuthConfig()}
      badges={{ "/admin/cafe": orders.n, "/admin/coaching": bookings.n, "/admin/leads": leadsNew.n }}
    >
      <CatalogProvider value={catalog}>{children}</CatalogProvider>
    </AdminShell>
  );
}
