import { expect, test } from "@playwright/test";

test("switch coach, open the profile and send a booking request", async ({ page }) => {
  await page.goto("/coaches");
  await page.getByRole("button", { name: "Aun" }).click();
  await expect(page.getByRole("button", { name: /Book with Aun/ })).toBeVisible();

  await page.getByRole("link", { name: /^Aun, .* Open profile$/ }).click();
  await expect(page).toHaveURL(/\/coaches\/aun$/);
  await expect(page.getByRole("heading", { level: 1, name: "Aun" })).toBeVisible();

  await page.getByRole("button", { name: "Book package" }).first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Step 1 of 3")).toBeVisible();
  await expect(sheet.getByRole("radio", { name: /3 sessions/ })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("button", { name: "Continue" }).click();

  // Choose the first day with open times, then the first time.
  const days = sheet.locator('[aria-labelledby="day-h"] [role="radio"]:not([disabled])');
  await days.last().click();
  await sheet.locator('[aria-labelledby="time-h"] [role="radio"]').first().click();
  await sheet.getByRole("button", { name: "Continue" }).click();

  await sheet.getByLabel("Your name").fill("Mint");
  await sheet.getByLabel("Phone or LINE ID").fill("@mintfit");
  await sheet.getByRole("button", { name: "Send booking request" }).click();
  await expect(sheet.getByText("Request sent")).toBeVisible();
  await expect(sheet.getByText(/Reference PT-\d+/)).toBeVisible();
});

test("message a coach from the carousel", async ({ page }) => {
  await page.goto("/coaches");
  await page.getByRole("button", { name: "Message Bella" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "What do sessions cost?" }).click();
  await sheet.getByLabel("Your name").fill("Mint");
  await sheet.getByLabel("Phone or LINE ID").fill("0812345678");
  await sheet.getByRole("button", { name: "Send message" }).click();
  await expect(sheet.getByText("Message sent")).toBeVisible();
});
