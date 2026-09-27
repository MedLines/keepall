import { chromium } from "@playwright/test";
import sharp from "sharp";
import { seedMarketingLibrary } from "./marketing-fixture.mjs";

const origin = process.argv[2] ?? "http://localhost:3001";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Use a local server for help captures.");
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 860 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("keepall.storage-status-dismissed", "true"));
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByText("No items yet.", { exact: true }).waitFor();
  await seedMarketingLibrary(page);
  await page.reload();
  await page.locator(".library-card").first().waitFor();
  async function capture(name, locator) {
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "nextjs-portal, [data-agentation-root], [data-interface-kit], #interface-kit-root { display: none !important; }" });
    await locator.scrollIntoViewIfNeeded();
    await sharp(await locator.screenshot({ animations: "disabled" })).webp({ quality: 88 }).toFile(new URL(`../public/help/${name}.webp`, import.meta.url).pathname);
    console.log(`Captured ${name}`);
  }
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await capture("save-panel", page.getByRole("dialog", { name: "Save to Keepall" }));
  await page.goto(`${origin}/settings`);
  await capture("import-settings", page.getByRole("region", { name: "Import", exact: true }));
  await capture("backup-settings", page.getByRole("region", { name: "Backup", exact: true }));
  await capture("storage-settings", page.getByRole("region", { name: "Storage", exact: true }));
} finally {
  await browser.close();
}
