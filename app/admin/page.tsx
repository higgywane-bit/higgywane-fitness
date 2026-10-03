import Link from "next/link";
import { ScanLine, UserPlus } from "lucide-react";
import { DashboardCustomizer } from "@/components/admin/dashboard/customizer";
import { RENDERERS } from "@/components/admin/dashboard/widgets";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { GYM } from "@/content/gym";
import { getDb } from "@/lib/db";
import { widgetMeta, type LayoutItem } from "@/lib/dashboard/catalog";
import { DashboardContext, LOADERS } from "@/lib/dashboard/data";
import { loadLayout } from "@/lib/dashboard/layout";
import { formatDate } from "@/lib/membership/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: { absolute: "Dashboard | Superfit Admin" } };

function greeting(now = new Date()) {
  const h = (now.getUTCHours() + GYM.utcOffsetHours) % 24;
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const LINKS: Partial<Record<string, { href: string; label: string }>> = {
  "expiring-list": { href: "/admin/members?status=expiring", label: "See all" },
  "win-back": { href: "/admin/members?status=expired", label: "See all" },
  "latest-checkins": { href: "/admin/check-in", label: "Front desk" },
  "recent-sales": { href: "/admin/sales", label: "All sales" },
  "sales-daily": { href: "/admin/sales", label: "Sales" },
};

const SPAN: Record<number, string> = { 1: "col-span-1", 2: "col-span-2", 4: "col-span-2 xl:col-span-4" };

async function Widget({ item, ctx }: { item: LayoutItem; ctx: DashboardContext }) {
  const meta = widgetMeta(item.id)!;
  const Render = RENDERERS[item.id] as React.ComponentType<{ data: unknown }>;
  let data: unknown;
  try {
    data = await LOADERS[item.id](ctx);
  } catch (err) {
    console.error(`dashboard module ${item.id}`, err);
    return (
      <Panel title={meta.title} className={SPAN[item.size]}>
        <p className="text-sm text-text-tertiary">Couldn&apos;t load this module.</p>
      </Panel>
    );
  }
  if (meta.sizes[0] === 1) {
    return (
      <div className={SPAN[item.size]}>
        <Render data={data} />
      </div>
    );
  }
  const link = LINKS[item.id];
  return (
    <Panel
      title={meta.title}
      className={cn(SPAN[item.size], "min-w-0")}
      action={
        link ? (
          <Link href={link.href} className="text-sm text-text-secondary hover:text-white">
            {link.label}
          </Link>
        ) : undefined
      }
    >
      <Render data={data} />
    </Panel>
  );
}

export default async function DashboardPage() {
  const db = await getDb();
  const ctx = new DashboardContext(db, new Date());
  const layout = await loadLayout(db);

  return (
    <div className="pb-12">
      <PageHeader eyebrow={`${greeting()} · ${formatDate(ctx.today)}`} title="Dashboard">
        <DashboardCustomizer layout={layout} />
        <Button asChild variant="outline">
          <Link href="/admin/members/new">
            <UserPlus className="size-4" aria-hidden />
            New member
          </Link>
        </Button>
        <Button asChild>
          <Link href="/admin/check-in">
            <ScanLine className="size-4" aria-hidden />
            Open check-in
          </Link>
        </Button>
      </PageHeader>

      {layout.items.length ? (
        <div className="grid grid-flow-row-dense grid-cols-2 gap-3 px-4 md:gap-4 md:px-8 xl:grid-cols-4">
          {layout.items.map((item) => (
            <Widget key={item.id} item={item} ctx={ctx} />
          ))}
        </div>
      ) : (
        <div className="mx-4 rounded-3xl border border-dashed border-hairline-strong p-10 text-center md:mx-8">
          <p className="font-semibold">Your dashboard is empty.</p>
          <p className="mt-1 text-sm text-text-secondary">Use Customise to add modules or pick a preset.</p>
        </div>
      )}
    </div>
  );
}
