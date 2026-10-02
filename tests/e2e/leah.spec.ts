import { expect, test } from "@playwright/test";

// Runs against offline Leah (no ANTHROPIC_API_KEY), which answers from the same content data.

test("ask Leah about PT, switch to Thai, start over", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Chat with Leah" }).click();
  const chat = page.getByRole("dialog");
  await expect(chat.getByText("Hi, I'm Leah.")).toBeVisible();

  await chat.getByRole("button", { name: "Personal training" }).click();
  await expect(chat.getByText("฿1,700")).toBeVisible();
  await expect(chat.getByRole("link", { name: "See PT packages" })).toHaveAttribute("href", "/train");

  await chat.getByRole("radio", { name: "ภาษาไทย" }).click();
  await chat.getByLabel("พิมพ์ข้อความถึงลีอา").fill("เปิดกี่โมงคะ");
  await chat.getByLabel("พิมพ์ข้อความถึงลีอา").press("Enter");
  await expect(chat.getByText(/ยิม/).last()).toBeVisible();

  await chat.getByRole("button", { name: "เริ่มแชทใหม่" }).click();
  await expect(chat.getByText("สวัสดีค่ะ ลีอาเองค่ะ")).toBeVisible();
});

test("drag the bubble onto the target to hide Leah for the visit, then undo", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "mouse drag; the touch path is the same pointer handler");
  await page.goto("/");

  const bubble = page.getByRole("button", { name: "Chat with Leah" });
  const box = (await bubble.boundingBox())!;
  const vp = page.viewportSize()!;
  await page.mouse.move(box.x + 28, box.y + 28);
  await page.mouse.down();
  await page.mouse.move(vp.width / 2, box.y - 40, { steps: 8 });
  await expect(page.getByText("Drag here to hide")).toBeVisible();
  // the target is centred near the bottom of the viewport
  await page.mouse.move(vp.width / 2, vp.height - 62, { steps: 8 });
  await page.mouse.up();

  await expect(bubble).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(bubble).toBeVisible();
});
