import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/lib/db/client";
import { cafeOrders, memberships, sales } from "@/lib/db/schema";
import { getMenuItem } from "@/lib/catalog";
import { checkIn, createMember, quickPass } from "@/lib/membership/service";
import { defaultSelections, itemPrice } from "@/lib/nutrition";
import { priceTicket, ringUp } from "@/lib/pos/service";

let db: DB;
beforeAll(async () => {
  db = (await createDb()).db;
}, 30_000);

const at = (s: string) => new Date(`${s}+07:00`);
const latte = () => getMenuItem("latte")!;

describe("till", () => {
  it("prices a ticket from the menu, with add-ons", () => {
    const item = getMenuItem("berry-hype")!;
    const sel = { ...defaultSelections(item), "smoothie-addons": ["whey", "creatine"] };
    const { total, menu } = priceTicket([{ kind: "menu", itemId: item.id, qty: 2, selections: sel }]);
    expect(menu[0].unit).toBe(itemPrice(item, sel));
    expect(total).toBe(2 * (149 + 40 + 30));
  });

  it("rings up a walk-in coffee: order to the bar, sale recorded", async () => {
    const r = await ringUp(db, { lines: [{ kind: "menu", itemId: "latte", qty: 1, selections: defaultSelections(latte()) }], paymentMethod: "cash", customerName: "Tom" }, at("2026-10-03T09:00:00"));
    expect(r).toMatchObject({ total: 130, customer: "Tom", orderNumber: r.number });
    const [order] = await db.select().from(cafeOrders).where(eq(cafeOrders.id, r.saleId));
    expect(order).toMatchObject({ channel: "pos", status: "new", paymentStatus: "paid", subtotal: 130 });
    const [sale] = await db.select().from(sales).where(eq(sales.externalId, `${r.saleId}:cafe`));
    expect(sale).toMatchObject({ source: "pos", amountSatang: 13000, category: "cafe", paymentMethod: "cash" });
  });

  it("puts a membership and a shake on one member's ticket", async () => {
    const m = await createMember(db, { firstName: "Mixed", lastName: "Ticket" }, at("2026-10-01T08:00:00"));
    const shake = getMenuItem("thick")!;
    const r = await ringUp(
      db,
      {
        memberId: m.id,
        lines: [
          { kind: "plan", planId: "1-month" },
          { kind: "menu", itemId: shake.id, qty: 1, selections: defaultSelections(shake) },
        ],
        paymentMethod: "qashier",
        paymentRef: "Q-123",
      },
      at("2026-10-03T10:00:00"),
    );
    expect(r.customer).toBe("Mixed Ticket");
    expect(r.total).toBe(2200 + 149);
    expect(r.plans).toEqual([{ name: "1 Month", endsOn: "2026-11-02" }]);
    const ms = await db.select().from(memberships).where(eq(memberships.memberId, m.id));
    expect(ms[0]).toMatchObject({ planId: "1-month", price: 2200, paymentMethod: "qashier", paymentRef: "Q-123" });
    const rows = await db.select().from(sales).where(eq(sales.memberId, m.id));
    expect(rows.map((s) => [s.category, s.amountSatang]).sort()).toEqual([
      ["cafe", 14900],
      ["membership", 220000],
    ]);
    expect((await checkIn(db, { memberId: m.id, method: "search" }, at("2026-10-03T10:05:00"))).allowed).toBe(true);
  });

  it("merch skips the bar and counts as retail", async () => {
    const tee = getMenuItem("superfit-t-shirt")!;
    const r = await ringUp(db, { lines: [{ kind: "menu", itemId: tee.id, qty: 2, selections: defaultSelections(tee) }], paymentMethod: "promptpay" });
    expect(r.orderNumber).toBeNull();
    const [sale] = await db.select().from(sales).where(eq(sales.externalId, `${r.saleId}:retail`));
    expect(sale).toMatchObject({ category: "retail", amountSatang: 2 * 350 * 100 });
  });

  it("needs a member to sell a plan, and refuses an empty ticket", async () => {
    await expect(ringUp(db, { lines: [{ kind: "plan", planId: "day-pass" }], paymentMethod: "cash" })).rejects.toThrow(/Add the member/);
    await expect(ringUp(db, { lines: [], paymentMethod: "cash" })).rejects.toThrow(/empty/);
    await expect(ringUp(db, { lines: [{ kind: "menu", itemId: "latte", qty: 1, selections: {} }], paymentMethod: "cash" })).rejects.toThrow(/Check the options/);
  });

  it("desk quick passes are counted as money too", async () => {
    const { memberId } = await quickPass(db, { name: "Day Tripper", planId: "day-pass", paymentMethod: "cash" }, at("2026-10-03T12:00:00"));
    const rows = await db.select().from(sales).where(eq(sales.memberId, memberId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: "membership", amountSatang: 25000, source: "pos" });
  });
});
