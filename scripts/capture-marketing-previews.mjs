import { chromium, expect } from "@playwright/test";
import { prepareCaptureContext, settleCapture, capturePreview, localCaptureOrigin } from "./preview-capture.mjs";
import { mkdir } from "node:fs/promises";
import { seedMarketingLibrary } from "./marketing-fixture.mjs";

// Capture the real application in a disposable browser, using only sample data.
// Run against a local server: node scripts/capture-marketing-previews.mjs [origin]
const origin = localCaptureOrigin(process.argv[2]);
const selected = process.argv[3]?.split(",");
const output = new URL("../public/marketing/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await prepareCaptureContext(browser);
  const page = await context.newPage();
  await page.route("https://www.google.com/s2/favicons**", route => route.abort());
  await page.goto(origin);
  await page.locator("#library-heading").waitFor();
  await page.waitForFunction(async () => (await indexedDB.databases()).some(database => database.name === "keepall"));
  await seedMarketingLibrary(page);

  const settle = () => settleCapture(page);
  const capture = (name, locator) => !selected || selected.includes(name) ? capturePreview(page, new URL(name, output), locator) : Promise.resolve();
  await page.reload();
  await page.locator(".library-card").first().waitFor();
  await settle();
  await capture("app-library.webp");
  await page.getByRole("button", { name: "All collections", exact: true }).click();
  await expect(page.locator("#library-heading")).toHaveText("Collections");
  await capture("app-collections-overview.webp");
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Design Inspiration", exact: true }).click();
  await settle();
  await expect(page.locator("#library-heading")).toHaveText("Design Inspiration");
  await expect(page.locator(".library-card")).toHaveCount(9);
  await capture("app-collection.webp");
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "All items", exact: true }).click();
  await page.getByRole("searchbox").fill("field notes");
  await expect(page.locator(".library-card")).toHaveCount(6);
  await expect(page.getByRole("searchbox")).toHaveValue("field notes");
  await settle();
  await capture("app-search.webp");
  await page.setViewportSize({ width: 1000, height: 780 });
  await settle();
  await capture("app-search-detail.webp", page.locator(".library-panel"));
  await page.setViewportSize({ width: 1440, height: 860 });
  await page.getByRole("searchbox").fill("");
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Tag favorites", exact: true }).click();
  await expect(page.locator(".library-card")).toHaveCount(1);
  await settle();
  await capture("app-tags.webp");
  await page.getByRole("button", { name: "All tags", exact: true }).click();
  await expect(page.locator("#library-heading")).toHaveText("Tags");
  await capture("app-tags-overview.webp");
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto(`${origin}/settings#backup-heading`);
  await page.getByRole("tab", { name: "Storage & backups", exact: true }).click();
  await page.getByRole("region", { name: "Backup", exact: true }).waitFor();
  await settle();
  await capture("app-backup.webp", page.getByRole("region", { name: "Backup", exact: true }));
} finally {
  await browser.close();
}
