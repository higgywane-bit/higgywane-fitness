import { expect, test } from "@playwright/test";

test("order a configured smoothie and pay with PromptPay", async ({ page }) => {
  await page.goto("/cafe");

  await page.getByRole("button", { name: "Quick add Latte" }).click();

  await page.locator("a[href='/cafe/berry-hype']").click();
  await expect(page).toHaveURL(/\/cafe\/berry-hype$/);

  const cta = page.getByRole("button", { name: /Add to order/ });
  await expect(cta).toContainText("฿149");
  await page.getByRole("radio", { name: /Large/ }).click();
  await page.getByRole("checkbox", { name: /Whey scoop/ }).click();
  await page.getByRole("checkbox", { name: /No honey/ }).click();
  await expect(cta).toContainText("฿229");
  await cta.click();
  await expect(page).toHaveURL(/\/cafe$/);

  await page.getByRole("button", { name: /^Cart/ }).filter({ visible: true }).first().click();
  const cart = page.getByRole("dialog");
  await expect(cart.getByText("Large, + Whey scoop, No honey")).toBeVisible();
  await expect(cart.getByText("฿359")).toBeVisible(); // 229 + 130 iced latte

  await page.getByRole("link", { name: "Go to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  const pay = page.getByRole("button", { name: /Pay ฿359 with PromptPay/ });
  await pay.click();
  await expect(page.getByText("Add your name so we can call you.")).toBeVisible();

  await page.getByLabel("Name for the order").fill("Nicha");
  await pay.click();
  await expect(page.getByRole("img", { name: /PromptPay QR code for ฿359/ })).toBeVisible();
  await expect(page.getByText("Waiting for payment")).toBeVisible();

  await expect(page).toHaveURL(/\/order\//, { timeout: 20_000 });
  await expect(page.getByText("Paid and sent to the bar")).toBeVisible();
});

test("dine-in order paid at the counter", async ({ page }) => {
  await page.goto("/cafe");
  await page.getByRole("button", { name: "Quick add Thick" }).click();
  await page.goto("/checkout");
  await page.getByLabel("Name for the order").fill("Aun");
  await page.getByRole("radio", { name: "Dine in" }).click();
  await page.getByRole("radio", { name: /Pay at the counter/ }).click();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText("Add your table number.")).toBeVisible();
  await page.getByLabel("Table number").fill("7");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/order\//);
  await expect(page.getByText("Sent to the bar. Pay at the counter.")).toBeVisible();
  await expect(page.getByText("Dine in, table 7")).toBeVisible();
});

test("product deep link renders as a page", async ({ page }) => {
  await page.goto("/cafe/strong-vibes");
  await expect(page.getByRole("heading", { level: 1, name: "Strong Vibes" })).toBeVisible();
  await expect(page.getByText("Contains peanuts")).toBeVisible();
});

test("category chips jump to their section", async ({ page }) => {
  await page.goto("/cafe");
  await page.getByRole("button", { name: "Coffee", exact: true }).click();
  await expect(page.getByRole("button", { name: "Coffee", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { name: "Coffee", level: 2 })).toBeInViewport();
});
