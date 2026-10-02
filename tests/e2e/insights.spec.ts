import path from "node:path";
import { expect, test } from "@playwright/test";

test("upload a Glofox report and read it", async ({ page }) => {
  await page.goto("/admin/insights");
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures/glofox-transactions.csv"));
  await expect(page).toHaveURL(/\/admin\/insights\/[0-9a-f-]{36}/);
  await expect(page.getByText("Sales / transactions ·")).toBeVisible();
  await expect(page.getByText("Revenue", { exact: true })).toBeVisible();
  await page.getByLabel("Group by").selectOption({ label: "Payment Method" });
  await expect(page.getByRole("heading", { name: "Top payment method" })).toBeVisible();
});

test("customise the dashboard with a preset", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Customise" }).click();
  await page.getByRole("button", { name: /Front desk/ }).click();
  await page.getByRole("button", { name: "Save dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Latest check-ins" })).toBeVisible();
  // put the owner view back for other tests
  await page.getByRole("button", { name: "Customise" }).click();
  await page.getByRole("button", { name: /^Owner/ }).click();
  await page.getByRole("button", { name: "Save dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Busiest hours" })).toBeVisible();
});
