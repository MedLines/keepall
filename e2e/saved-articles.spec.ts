import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { TextWriter, Uint8ArrayReader, ZipReader } from "@zip.js/zip.js";
import { articleContentText, type ArticleNode } from "../src/domain/article";

test.use({ serviceWorkers: "allow" });

test("article capture retries, persists, reads offline, searches and restores from backup", async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const open = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("items", "readwrite");
        tx.objectStore("items").put({ id: "article-reader", type: "link", title: "My reading", url: "https://example.com/report", noteContent: "My independent personal note", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 });
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  const content: ArticleNode[] = [
    { tag: "h2", children: [{ text: "Migration evidence" }] },
    { tag: "p", children: [{ text: "The elusive narwhal migrates through Arctic waters." }] },
    { tag: "p", children: [{ text: "<script>alert(1)</script>" }] },
    { tag: "ul", children: [{ tag: "li", children: [{ text: "An independent report about migration." }] }] },
    { tag: "p", children: [{ tag: "a", href: "https://example.com/reference", children: [{ text: "Read the references" }] }] },
  ];
  const article = { title: "Ocean reporting", text: articleContentText(content), content, sourceUrl: "https://example.com/report", author: "Ada Writer", siteName: "Ocean Journal", publishedAt: "2026-09-30", capturedAt: 1_791_331_200_000 };
  let attempts = 0;
  await page.route("**/api/article", async route => {
    attempts++;
    await route.fulfill({ status: attempts === 1 ? 422 : 200, contentType: "application/json", body: JSON.stringify(attempts === 1 ? { error: "This website is temporarily unavailable." } : article) });
  });
  await page.goto("/items/article-reader");
  await page.getByRole("button", { name: "Save article", exact: true }).click();
  await expect(page.getByRole("region", { name: "Saved article", exact: true }).getByRole("alert")).toContainText("temporarily unavailable");
  await expect(page.getByText("My independent personal note", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry saving article", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Article saved for offline reading." })).toBeVisible();
  await expect(page.getByRole("article", { name: "Article text" })).toContainText("elusive narwhal");
  await expect(page.getByRole("heading", { level: 1, name: article.title })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: "Migration evidence" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Article text" }).getByRole("listitem")).toHaveText("An independent report about migration.");
  await expect(page.getByRole("link", { name: "Read the references" })).toHaveAttribute("href", "https://example.com/reference");
  await expect(page.getByRole("link", { name: "Open original", exact: true })).toHaveAttribute("href", article.sourceUrl);
  await page.reload();
  await expect(page.getByRole("article", { name: "Article text" })).toContainText("<script>alert(1)</script>");
  expect(attempts).toBe(2);
  await page.unroute("**/api/article");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
  });
  // Refresh once under the worker so the item route joins its page cache.
  await page.reload();
  await expect(page.getByRole("article", { name: "Article text" })).toContainText("elusive narwhal");
  await expect.poll(() => page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      if (await cache.match(location.href)) return true;
    }
    return false;
  })).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("article", { name: "Article text" })).toContainText("migration");
  await expect(page.getByRole("heading", { name: "Migration evidence" })).toBeVisible();
  await expect(page.getByText("My independent personal note", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("article", { name: "Article text" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("article-reader-mobile.png"), animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/?q=narwhal");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt")).toContainText("Saved article:");
  await expect(page.locator(".search-excerpt mark")).toHaveText("narwhal");
  await page.goto("/settings#storage");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  const downloaded = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Export backup", exact: true }).click();
  const path = await (await downloaded).path();
  const reader = new ZipReader(new Uint8ArrayReader(await readFile(path!)));
  try {
    const manifest = (await reader.getEntries()).find(entry => entry.filename === "manifest.json")!;
    if (manifest.directory) throw new Error("Invalid backup manifest");
    const data = JSON.parse(await manifest.getData(new TextWriter())) as { items: { article: unknown }[] };
    expect(data.items[0].article).toEqual(article);
  } finally { await reader.close(); }
  await backup.locator('input[accept*="application/zip"]').setInputFiles(path!);
  await page.getByRole("dialog", { name: "Import backup", exact: true }).getByRole("button", { name: "Replace library", exact: true }).click();
  await page.getByRole("dialog", { name: "Replace library?", exact: true }).getByRole("button", { name: "Confirm replacement", exact: true }).click();
  await expect(page.locator('div[role="status"][aria-atomic="true"]')).toContainText("Library replaced from backup");
  await page.goto("/items/article-reader");
  await expect(page.getByRole("article", { name: "Article text" })).toContainText("elusive narwhal");
  await expect(page.getByText("My independent personal note", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
