import { test, expect } from "@playwright/test";

test.describe("Train page", () => {
  test("loads memberships by default", async ({ page }) => {
    await page.goto("http://localhost:3000/train");

    // Check header via heading
    await expect(page.getByRole("heading", { name: "Train" })).toBeVisible();

    // Check that memberships tab is active (Memberships button visible)
    await expect(page.getByRole("button", { name: /Memberships/ })).toBeVisible();

    // Check that at least one glass card exists (membership card)
    const cards = page.locator(".glass");
    await expect(cards.first()).toBeVisible();
  });

  test("switches to personal training", async ({ page }) => {
    await page.goto("http://localhost:3000/train");

    // Click PT tab
    await page.getByRole("button", { name: /Personal Training/ }).click();

    // Wait for animation
    await page.waitForTimeout(300);

    // Check that session text is visible (PT sessions)
    const sessionText = page.locator("text=/session/i").first();
    await expect(sessionText).toBeVisible();
  });
});
