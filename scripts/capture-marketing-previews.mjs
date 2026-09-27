import { chromium, expect } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { seedMarketingLibrary } from "./marketing-fixture.mjs";

// Capture the real application in a disposable browser, using only sample data.
// Run against a local server: node scripts/capture-marketing-previews.mjs [origin]
const origin = process.argv[2] ?? "http://localhost:3001";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) {
  throw new Error("Marketing previews must be captured from a local server.");
}
const output = new URL("../public/marketing/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("keepall.storage-status-dismissed", "true"));
  const page = await context.newPage();
  await page.route("https://www.google.com/s2/favicons**", route => route.abort());
  await page.goto(origin);
  await page.getByText("No items yet.", { exact: true }).waitFor();
  await seedMarketingLibrary(page);

  async function settle() {
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "nextjs-portal, [data-agentation-root], [data-interface-kit], #interface-kit-root { display:none !important; }" });
    await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(image => image.complete));
    await page.waitForTimeout(500);
  }
  async function capture(name, locator) {
    const png = await (locator ?? page).screenshot({ animations: "disabled" });
    await sharp(png).webp({ quality: 88 }).toFile(new URL(name, output).pathname);
    console.log(`Captured ${name}`);
  }
  await page.reload();
  await page.locator(".library-card").first().waitFor();
  await settle();
  await capture("app-library.webp");
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Design Inspiration", exact: true }).click();
  await settle();
  await expect(page.locator("#library-heading")).toHaveText("Design Inspiration");
  await expect(page.locator(".library-card")).toHaveCount(9);
  await capture("app-collection.webp");
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "All items", exact: true }).click();
  await page.getByRole("searchbox").fill("quiet spaces");
  await expect(page.locator(".library-card")).toHaveCount(4);
  await expect(page.getByRole("searchbox")).toHaveValue("quiet spaces");
  await settle();
  await capture("app-search.webp");
  await page.setViewportSize({ width: 1000, height: 780 });
  await settle();
  await capture("app-search-detail.webp", page.locator(".library-panel"));
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto(`${origin}/settings`);
  await page.getByRole("region", { name: "Backup", exact: true }).waitFor();
  await settle();
  await capture("app-backup.webp", page.getByRole("region", { name: "Backup", exact: true }));
} finally {
  await browser.close();
}
