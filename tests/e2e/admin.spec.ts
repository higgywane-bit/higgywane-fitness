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
  const result = page.getByRole("alertdialog");
  await expect(result).toHaveAttribute("data-tone", "ok");
  await expect(result.getByText("Active")).toBeVisible();
  await expect(result.getByText(/days left/)).toBeVisible();
});

test("unknown codes are turned away", async ({ page }) => {
  await page.goto("/admin/check-in");
  await page.getByLabel("Member code").fill("ZZZZ0000");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  const result = page.getByRole("alertdialog");
  await expect(result).toHaveAttribute("data-tone", "deny");
  await expect(result.getByText("Card not linked")).toBeVisible();
  await expect(result.getByRole("button", { name: "Link to member" })).toBeVisible();
});

test("day pass from the desk: sign up, pay, straight in", async ({ page }) => {
  await page.goto("/admin/check-in");
  await page.getByRole("button", { name: /Day pass/ }).click();
  await page.getByLabel("Name", { exact: true }).fill(`Walk In ${Date.now().toString(36)}`);
  await page.getByRole("radio", { name: "Cash" }).click();
  await page.getByRole("button", { name: /Check in/ }).last().click();
  const result = page.getByRole("alertdialog");
  await expect(result).toHaveAttribute("data-tone", "ok");
  await expect(result.getByText("valid today")).toBeVisible();
});

test("till: coffee for a walk-in goes to the bar", async ({ page }) => {
  const name = `Till ${Date.now().toString(36)}`;
  await page.goto("/admin/till");
  await page.getByRole("tab", { name: "Coffee" }).click();
  await page.getByRole("button", { name: /^Americano,/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Add/ }).click();
  const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024;
  if (!isDesktop) await page.getByRole("button", { name: /1 item/ }).click();
  const ticket = isDesktop ? page.locator("aside").last() : page.getByRole("dialog");
  await ticket.getByLabel("Name for the order").fill(name);
  await ticket.getByRole("radio", { name: "Cash" }).click();
  await ticket.getByRole("button", { name: /^Paid/ }).click();
  await expect(page.getByRole("alertdialog").getByText("Order sent to the bar")).toBeVisible();
  await page.goto("/admin/cafe");
  await expect(page.getByText(name).first()).toBeVisible();
});
