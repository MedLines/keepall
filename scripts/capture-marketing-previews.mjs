import { chromium, expect } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Capture the real application in a disposable browser, using only sample data.
// Run against a local server: node scripts/capture-marketing-previews.mjs [origin]
const origin = process.argv[2] ?? "http://localhost:3001";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) {
  throw new Error("Marketing previews must be captured from a local server.");
}
const output = new URL("../public/marketing/", import.meta.url);
await mkdir(output, { recursive: true });
const assets = await Promise.all([
  "architecture.webp", "reading-corner.webp", "workflow-canvas.svg",
  "type-study.svg", "editorial-page.svg", "color-atlas.svg",
  "studio-interface.svg", "night-product.svg", "signal-landing.svg",
].map(async (name, index) => ({
  id: `sample-asset-${index}`,
  data: (await sharp(new URL(name, output).pathname).png().toBuffer()).toString("base64"),
})));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("keepall.storage-status-dismissed", "true"));
  const page = await context.newPage();
  await page.route("https://www.google.com/s2/favicons**", route => route.abort());
  await page.goto(origin);
  await page.getByText("No items yet.", { exact: true }).waitFor();
  await page.evaluate(async (assets) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["items", "assets", "collections", "tags"], "readwrite");
      const createdAt = new Date("2026-09-01T12:00:00Z").getTime();
      for (const [id, name, color] of [["design", "Design Inspiration", "lime"], ["spaces", "Quiet spaces", "blue"], ["weekend", "Weekend projects", "pink"]]) {
        tx.objectStore("collections").put({ id, name, color, createdAt, pinnedItemIds: [] });
      }
      for (const name of ["inspiration", "someday", "favorites"]) tx.objectStore("tags").put({ id: name, name, createdAt });
      for (const asset of assets) {
        const bytes = Uint8Array.from(atob(asset.data), c => c.charCodeAt(0));
        tx.objectStore("assets").put({ id: asset.id, bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: asset.id, createdAt });
      }
      const base = { updatedAt: createdAt, tagIds: ["inspiration"], caption: "", sourceUrl: "" };
      const order = [2, 0, 3, 1, 7, 4, 6, 5, 8];
      order.forEach((assetIndex, index) => tx.objectStore("items").put({ ...base, id: `design-${index}`, type: "image", title: "", assetIds: [assets[assetIndex].id], collectionIds: ["design"], createdAt: createdAt - index * 1000 }));
      [1, 0, 4].forEach((assetIndex, index) => tx.objectStore("items").put({ ...base, id: `space-${index}`, type: "image", title: ["A little room to think", "Afternoon light", "Space to breathe"][index], caption: "Quiet spaces for another day.", assetIds: [assets[assetIndex].id], collectionIds: ["spaces"], createdAt: createdAt - (index + 10) * 1000 }));
      tx.objectStore("items").put({ ...base, id: "sample-note", type: "note", title: "A slower Sunday", content: "A few quiet spaces to return to.\n\nMake room for good books, afternoon light, and a little time to think.", collectionIds: ["weekend"], createdAt: createdAt - 14000 });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, assets);

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
