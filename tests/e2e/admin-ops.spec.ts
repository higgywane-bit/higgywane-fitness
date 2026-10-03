import { expect, test } from "@playwright/test";

// Back-office flows added for the full system: cafe board, leads, staff, expenses.

test("a website cafe order reaches the bar board and the customer sees it ready", async ({ page }) => {
  const name = `Board ${Date.now().toString(36)}`;
  await page.goto("/cafe");
  await page.getByRole("button", { name: "Quick add Thick" }).click();
  await page.goto("/checkout");
  await page.getByLabel("Name for the order").fill(name);
  await page.getByRole("radio", { name: /Pay at the counter/ }).click();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/order\//, { timeout: 20_000 });
  const orderUrl = page.url();

  await page.goto("/admin/cafe");
  const card = page.locator("li", { hasText: name });
  await expect(card).toBeVisible();
  const saved = () => page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/cafe"));
  await Promise.all([saved(), card.getByRole("button", { name: "Start" }).click()]);
  await Promise.all([saved(), card.getByRole("button", { name: "Ready" }).click()]);

  await page.goto(orderUrl);
  await expect(page.locator('[aria-current="step"]')).toHaveText("Ready", { timeout: 15_000 });
});

test("add a lead and convert them into a member", async ({ page }) => {
  const name = `Lead ${Date.now().toString(36)}`;
  await page.goto("/admin/leads");
  await page.getByRole("button", { name: "New lead" }).click();
  await page.getByLabel("Name *").fill(name);
  // a fresh number: the same phone on an open lead counts as the same person enquiring again
  await page.getByLabel("Phone").fill(`08${String(Date.now()).slice(-8)}`);
  await page.getByRole("button", { name: "Add lead" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Convert to member" }).click();
  // lands on the new member with "Sell a plan" open, ready to take payment
  await expect(page).toHaveURL(/\/admin\/members\/[0-9a-f-]{36}\?welcome=1/);
  await expect(page.getByRole("dialog", { name: "Sell a plan" })).toContainText(name);
});

test("add a staff member and give them a shift", async ({ page }) => {
  const name = `Staff ${Date.now().toString(36)}`;
  await page.goto("/admin/staff");
  await page.getByRole("button", { name: "Add staff" }).click();
  await page.getByLabel("Name *").fill(name);
  await page.getByRole("button", { name: "Add staff member" }).click();
  await expect(page.getByText(name)).toBeVisible();

  await page.goto("/admin/staff/rota");
  const row = page.locator("tr", { hasText: name });
  await row.getByRole("button", { name: /Add shift on/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Add shift" }).click();
  await expect(row.getByText("06:00–14:00")).toBeVisible();
});

test("log an expense and see it in the month", async ({ page }) => {
  const what = `Aircon repair ${Date.now().toString(36)}`;
  await page.goto("/admin/expenses");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByLabel("Amount (฿)").fill("3500");
  await page.getByLabel("What for").fill(what);
  await page.getByLabel("What for").press("Enter");
  await expect(page.getByText(what)).toBeVisible();
});
