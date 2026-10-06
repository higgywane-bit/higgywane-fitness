import { expect, test } from "@playwright/test";

/*
 * Till → coach → client: the desk sells a PT pack with Bella, the invite link signs the
 * client up, Bella edits their workout, and the client sees the update and can log it.
 */
test("PT pack sold at the desk reaches the client's app", async ({ browser, baseURL }) => {
  const desk = await (await browser.newContext()).newPage();
  const stamp = Date.now();
  const email = `pt${stamp}@example.com`;
  const last = `Hudson${String(stamp).slice(-5)}`;
  await desk.goto("/admin/members/new");
  await desk.getByLabel(/First name/i).fill("Pete");
  await desk.getByLabel(/Last name/i).fill(last);
  await desk.getByLabel(/Email/i).first().fill(email);
  await desk.getByRole("button", { name: /Create|Save|Add member/i }).last().click();
  await desk.waitForURL(/\/admin\/members\/[0-9a-f-]{36}/);
  await desk.getByRole("button", { name: "Sell PT pack" }).click();
  await desk.getByText("Bella", { exact: true }).click();
  await desk.getByRole("button", { name: /Confirm sale/ }).click();
  await expect(desk.getByText("Sold, and linked to Bella")).toBeVisible();
  const link = (await desk.locator("code").first().textContent())!.trim();
  expect(link).toContain("/app/join/");

  // coach: Pete waits in To set up
  const coach = await (await browser.newContext()).newPage();
  await coach.goto("/coach/login");
  await coach.getByRole("button", { name: /Bella/ }).click();
  await coach.waitForURL(/\/coach$/);
  await coach.getByRole("tab", { name: /To set up/ }).click();
  await expect(coach.getByRole("link", { name: new RegExp(`Pete ${last}`) }).first()).toBeVisible();

  // client: join from the link
  const app = await (await browser.newContext()).newPage();
  await app.goto(link.replace(/^https?:\/\/[^/]+/, baseURL ?? ""));
  await expect(app.getByRole("heading", { name: "Hi Pete" })).toBeVisible();
  await app.locator("#password").fill("lift-heavy-8");
  await app.getByRole("button", { name: "Create my account" }).click();
  await app.waitForURL(/\/app(\?welcome=1)?$/);

  // coach builds a day and sends it
  await coach.reload();
  await coach.getByRole("link", { name: new RegExp(`Pete ${last}`) }).first().click();
  await coach.getByRole("link", { name: /Workout/ }).first().click();
  await coach.getByRole("button", { name: "Add day" }).first().click();
  const library = coach.getByRole("complementary", { name: "Exercise library" });
  if (await library.isVisible()) {
    // desktop: one click in the library beside the plan
    await library.getByRole("button", { name: /Barbell bench press/ }).first().click();
  } else {
    // phone: pick in the sheet, then Add
    await coach.getByRole("button", { name: /Add exercise/ }).first().click();
    await coach.getByRole("button", { name: /Barbell bench press/ }).first().click();
    await coach.getByRole("button", { name: /^Add 1$/ }).click();
  }
  await coach.getByRole("button", { name: /Save and send to Pete/ }).click();
  await expect(coach.getByText("Saved. Pete's app is updated")).toBeVisible();

  // client sees the notice and logs a set
  await app.goto("/app");
  await expect(app.getByText("Bella updated your workout")).toBeVisible();
  await app.goto("/app/workout");
  await app.getByRole("link", { name: /Day 1/ }).click();
  await app.getByRole("link", { name: /Start Day 1/ }).click();
  await app.getByRole("button", { name: "Tick set 1" }).click();
  await app.getByRole("button", { name: "Finish workout" }).click();
  await expect(app.getByRole("heading", { name: "Workout done" })).toBeVisible();
});
