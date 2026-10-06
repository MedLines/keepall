import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pdfFixture } from "../test-support/pdf-fixture";

test("PDFs import, search, and render on first use offline, including files without text", async ({ page, context }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 20_000 }).toBe(true);
  await context.setOffline(true);
  await page.keyboard.press("Alt+k");
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await drawer.locator('input[data-capture-files]').setInputFiles([
    { name: "offline.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdfFixture(["Offline unicorn reference"])) },
    { name: "scan.pdf", mimeType: "application/pdf", buffer: await readFile("test-support/scanned.pdf") },
  ]);
  await drawer.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(drawer).toBeHidden();
  await expect(page.locator("[data-item-id]")).toHaveCount(2);
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("scan.pdf");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  const scan = await page.locator('[data-item-id] a[href^="/items/"]').first().getAttribute("href");
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("unicorn");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  const href = await page.locator('[data-item-id] a[href^="/items/"]').first().getAttribute("href");
  await page.goto(href!);
  await expect(page.locator(".keepall-pdf-text:visible")).toContainText("Offline unicorn reference");
  await page.goto(scan!);
  await expect(page.getByRole("region", { name: "PDF viewer", exact: true })).toContainText("This PDF has no selectable text.");
  await expect(page.locator("canvas[aria-label='PDF page 1']")).toBeVisible();
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
  expect(await page.locator("canvas[aria-label='PDF page 1']").evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 100 && pixels[index + 3] === 255) return true;
    return false;
  })).toBe(true);
});
