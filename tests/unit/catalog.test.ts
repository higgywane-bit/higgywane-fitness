import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/lib/db/client";
import { DEFAULT_CATALOG, getMenuItem, getPlan, planList, setCatalog } from "@/lib/catalog";
import { saveCatalogSection, resetCatalogSection } from "@/lib/catalog/server";
import { readCatalog } from "@/lib/catalog/store";
import { validateSection } from "@/lib/catalog/validate";
import { itemPrice, itemDefaults } from "@/lib/nutrition";
import { sellPlan, createMember } from "@/lib/membership/service";

let db: DB;
beforeAll(async () => {
  db = (await createDb()).db;
}, 30_000);

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("catalog edits", () => {
  it("changes a menu price everywhere once saved", async () => {
    const menu = clone(DEFAULT_CATALOG.menu);
    const latte = menu.find((m) => m.slug === "latte")!;
    latte.basePrice = 135;
    await saveCatalogSection(db, "menu", menu);
    expect(getMenuItem("latte")!.basePrice).toBe(135);
    expect(itemPrice(getMenuItem("latte")!, itemDefaults(getMenuItem("latte")!).selections)).toBe(145); // iced +10 default
    expect((await readCatalog(db)).menu.find((m) => m.slug === "latte")!.basePrice).toBe(135);
  });

  it("adds a new item with an id made from its name", async () => {
    const menu = clone((await readCatalog(db)).menu);
    menu.push({ ...clone(menu[0]), id: "", slug: "", name: "Mango Madness", basePrice: 159 });
    const saved = await saveCatalogSection(db, "menu", menu);
    expect(saved.at(-1)).toMatchObject({ id: "mango-madness", slug: "mango-madness", basePrice: 159 });
  });

  it("refuses broken data with a plain message", () => {
    const c = DEFAULT_CATALOG;
    const bad = clone(c.menu);
    bad[0].basePrice = -5;
    expect(() => validateSection("menu", bad, c)).toThrow(/price must be between/);
    const dupe = clone(c.menu);
    dupe[1].id = dupe[0].id;
    expect(() => validateSection("menu", dupe, c)).toThrow(/Names must be different/);
    const unknownGroup = clone(c.menu);
    unknownGroup[0].optionGroups = ["nope"];
    expect(() => validateSection("menu", unknownGroup, c)).toThrow(/doesn't exist/);
  });

  it("won't delete things that are still used", () => {
    const c = DEFAULT_CATALOG;
    expect(() => validateSection("ingredients", c.ingredients.filter((i) => i.id !== "banana"), c)).toThrow(/uses that ingredient/);
    expect(() => validateSection("optionGroups", c.optionGroups.filter((g) => g.id !== "shots"), c)).toThrow(/uses that add-on group/);
    expect(() => validateSection("categories", c.categories.filter((x) => x.id !== "coffee"), c)).toThrow(/still in that category/);
    expect(() => validateSection("plans", c.plans.filter((p) => p.id !== "day-pass"), c)).toThrow(/Hide it instead/);
    expect(() => validateSection("coaches", c.coaches.slice(1), c)).toThrow(/Hide them instead/);
  });

  it("sells at the edited plan price, and hidden plans stop being offered", async () => {
    const plans = clone(DEFAULT_CATALOG.plans);
    plans.find((p) => p.id === "1-month")!.price = 2500;
    plans.find((p) => p.id === "2-weeks")!.hidden = true;
    await saveCatalogSection(db, "plans", plans);
    expect(getPlan("1-month")!.price).toBe(2500);
    expect(planList("membership").some((p) => p.id === "2-weeks")).toBe(false);
    expect(getPlan("2-weeks")).toBeDefined();
    const m = await createMember(db, { firstName: "Price", lastName: "Check" });
    const row = await sellPlan(db, m.id, { planId: "1-month", paymentMethod: "cash" });
    expect(row.price).toBe(2500);
  });

  it("checks PromptPay numbers", () => {
    const b = { ...DEFAULT_CATALOG.business };
    expect(validateSection("business", { ...b, promptPayId: "081-234-5678" }, DEFAULT_CATALOG).promptPayId).toBe("0812345678");
    expect(() => validateSection("business", { ...b, promptPayId: "12345" }, DEFAULT_CATALOG)).toThrow(/PromptPay/);
  });

  it("resets a section to the defaults", async () => {
    await resetCatalogSection(db, "plans");
    expect(getPlan("1-month")!.price).toBe(DEFAULT_CATALOG.plans.find((p) => p.id === "1-month")!.price);
    setCatalog(DEFAULT_CATALOG);
  });
});

describe("media", () => {
  it("stores small images and rejects anything else", async () => {
    const { saveImage, loadImage } = await import("@/lib/media/service");
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const path = await saveImage(db, { dataUrl: `data:image/png;base64,${png}`, width: 1, height: 1 });
    expect(path).toMatch(/^\/media\/[0-9a-f-]{36}$/);
    const row = await loadImage(db, path.split("/").pop()!);
    expect(row).toMatchObject({ contentType: "image/png", width: 1 });
    await expect(saveImage(db, { dataUrl: "data:text/html;base64,PGgxPg==" })).rejects.toThrow(/JPG, PNG or WebP/);
    expect(await loadImage(db, "../etc/passwd")).toBeNull();
  });
});
