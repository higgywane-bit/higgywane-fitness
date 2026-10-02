import { expect, test } from "@playwright/test";

// Front-desk flow: new member with a month → their code checks them in.
test("create a member, sell a month, check in with their code", async ({ page }) => {
  const name = `E2E ${Date.now().toString(36)}`;
  await page.goto("/admin/members/new");
  await page.getByLabel("First name *").fill(name);
  await page.getByLabel("Phone").fill("0899999999");
  await page.getByText("1 Month", { exact: true }).click();
  await page.getByRole("button", { name: "Create member and sell plan" }).click();

  await expect(page).toHaveURL(/\/admin\/members\/[0-9a-f-]{36}\?welcome=1/);
  await expect(page.getByText("is set up")).toBeVisible();
  const code = (await page.getByRole("img", { name: /QR code/ }).getAttribute("aria-label"))!.replace("QR code ", "");

  await page.goto("/admin/check-in");
  await page.getByLabel("Member code").fill(code);
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByText(/until/).first()).toBeVisible();
});

test("unknown codes are turned away", async ({ page }) => {
  await page.goto("/admin/check-in");
  await page.getByLabel("Member code").fill("ZZZZ0000");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByText("Code not recognised")).toBeVisible();
});
