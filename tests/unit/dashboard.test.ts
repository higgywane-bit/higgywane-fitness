import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/lib/db/client";
import { seedDemo } from "@/lib/db/seed";
import { DEFAULT_LAYOUT, normalizeLayout, PRESETS, WIDGETS } from "@/lib/dashboard/catalog";
import { DashboardContext, LOADERS, type KpiData } from "@/lib/dashboard/data";
import { getSetting, setSetting } from "@/lib/settings";

let db: DB;
const now = new Date("2026-10-02T05:00:00Z");
beforeAll(async () => {
  db = (await createDb()).db;
  await seedDemo(db, now);
}, 60_000);

describe("layout", () => {
  it("drops unknown modules and duplicates, and fixes sizes", () => {
    const l = normalizeLayout({ items: [{ id: "kpi-active", size: 4 }, { id: "nope" }, "sales-daily", { id: "kpi-active" }] });
    expect(l.items).toEqual([
      { id: "kpi-active", size: 1 },
      { id: "sales-daily", size: 2 },
    ]);
  });
  it("falls back to the default for junk", () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout({ items: [] }).items).toEqual([]);
  });
  it("presets only use real modules", () => {
    for (const p of Object.values(PRESETS)) expect(normalizeLayout(p.layout)).toEqual(p.layout);
  });
  it("saves to the database", async () => {
    await setSetting(db, "dashboard.layout", PRESETS.desk.layout);
    await setSetting(db, "dashboard.layout", PRESETS.sales.layout);
    expect(await getSetting(db, "dashboard.layout")).toEqual(PRESETS.sales.layout);
  });
});

describe("every module loads against real data", () => {
  it.each(WIDGETS.map((w) => w.id))("%s", async (id) => {
    const data = await LOADERS[id](new DashboardContext(db, now));
    expect(data).toBeTruthy();
    expect(() => JSON.stringify(data)).not.toThrow();
  });

  it("totals agree: this month's sales = sum of daily bars this month", async () => {
    const c = new DashboardContext(db, now);
    const month = (await LOADERS["kpi-sales-month"](c)) as KpiData;
    const daily = (await LOADERS["sales-daily"](c)) as { series: { date: string; value: number }[] };
    const fromBars = daily.series.filter((d) => d.date >= "2026-10-01").reduce((a, d) => a + d.value, 0);
    expect(month.value).toBeCloseTo(fromBars, 2);
    const monthly = (await LOADERS["sales-monthly"](c)) as { series: { date: string; value: number }[] };
    expect(monthly.series).toHaveLength(12);
    expect(monthly.series.at(-1)!.value).toBeCloseTo(month.value, 2);
  });

  it("top sellers come from line items", async () => {
    const top = (await LOADERS["top-sellers"](new DashboardContext(db, now))) as { items: { name: string; qty: number; value: number }[] };
    expect(top.items.length).toBeGreaterThan(0);
    expect(top.items[0].value).toBeGreaterThanOrEqual(top.items.at(-1)!.value);
  });
});
