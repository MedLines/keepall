import { expect, test, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";

test.use({ serviceWorkers: "block" });

const stores = ["items", "tags", "collections", "assets", "thumbnails", "videoAssets", "documentAssets", "preferences", "backupState"];
const png = readFileSync("public/icons/icon-192.png");

async function snapshot(page: Page) {
  return page.evaluate(async (stores) => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction(stores, "readonly");
      const tables = await Promise.all(stores.map((store) => new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const rows = tx.objectStore(store).getAll();
        rows.onsuccess = () => resolve(rows.result);
        rows.onerror = () => reject(rows.error);
      })));
      return Object.fromEntries(await Promise.all(tables.map(async (rows, index) => [stores[index], await Promise.all(rows.map(async (row) => ({
        ...row,
        ...(row.bytes instanceof Uint8Array ? { bytes: Array.from(row.bytes) } : {}),
        ...(row.blob instanceof Blob ? { blob: { type: row.blob.type, bytes: Array.from(new Uint8Array(await row.blob.arrayBuffer())) } } : {}),
      })))])));
    } finally { db.close(); }
  }, stores);
}

test("mixed ZIP merge rolls back native storage on quota failure and retries successfully", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.evaluate(async (png) => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result); });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["items", "assets", "tags", "collections", "preferences", "backupState"], "readwrite");
        const org = { tagIds: ["local-tag"], collectionIds: ["local-collection"], createdAt: 1, updatedAt: 1 };
        tx.objectStore("items").put({ ...org, id: "shared-note", type: "note", title: "Local note", content: "Keep this exact text" });
        tx.objectStore("items").put({ ...org, id: "local-image", type: "image", title: "Local image", assetIds: ["legacy-image"], caption: "", sourceUrl: "" });
        tx.objectStore("assets").put({ id: "legacy-image", mimeType: "image/png", bytes: new Uint8Array(png), byteLength: png.length, contentHash: "", createdAt: 1 });
        tx.objectStore("tags").put({ id: "local-tag", name: "Local", createdAt: 1 });
        tx.objectStore("collections").put({ id: "local-collection", name: "Local", createdAt: 1, pinnedItemIds: ["shared-note"] });
        tx.objectStore("preferences").put({ id: "library", pinnedCollectionIds: ["local-collection"] });
        tx.objectStore("backupState").put({ id: "library", revision: "before-import" });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, Array.from(png));

  const imageId = randomUUID(), documentId = randomUUID(), videoId = randomUUID();
  const text = new TextEncoder().encode("\uFEFF# Imported\r\nمرحبا café\n");
  const video = new Uint8Array([1, 2, 3]);
  const org = { tagIds: ["imported-tag"], collectionIds: ["imported-collection"], createdAt: 1, updatedAt: 20 };
  const items = [
    { ...org, id: "shared-note", type: "note", title: "Imported note", content: "Newer text" },
    { ...org, id: "incoming-image", type: "image", title: "Imported image", assetIds: [imageId], caption: "", sourceUrl: "" },
    { ...org, id: "incoming-video", type: "video", title: "Imported video", assetId: videoId, sourceFileName: "clip.mp4", noteContent: "", sourceUrl: "" },
    { ...org, id: "incoming-document", type: "document", title: "Imported document", format: "markdown", assetId: documentId, sourceFileName: "source.md", noteContent: "Personal note" },
  ];
  const writer = new ZipWriter(new Uint8ArrayWriter());
  const record = (id: string, bytes: Uint8Array, prefix: string) => ({ id, path: `${prefix}/${id}.bin`, byteLength: bytes.length, contentHash: createHash("sha256").update(bytes).digest("hex"), createdAt: 1 });
  await writer.add("manifest.json", new TextReader(JSON.stringify({
    format: "keepall", version: 9, exportedAt: 123, items,
    tags: [{ id: "imported-tag", name: "Imported", createdAt: 1 }],
    collections: [{ id: "imported-collection", name: "Imported", createdAt: 1, pinnedItemIds: items.map(item => item.id) }],
    preferences: { pinnedCollectionIds: ["imported-collection"] },
    assets: [{ ...record(imageId, png, "assets"), mimeType: "image/png" }],
    documents: [record(documentId, text, "documents")],
    videos: [{ ...record(videoId, video, "videos"), mimeType: "video/mp4" }], thumbnails: [],
  })));
  for (const [path, bytes] of [[`assets/${imageId}.bin`, png], [`documents/${documentId}.bin`, text], [`videos/${videoId}.bin`, video]] as const) {
    await writer.add(path, new Uint8ArrayReader(bytes));
  }
  const buffer = Buffer.from(await writer.close());
  await page.goto("/settings#storage");
  const before = await snapshot(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (value, key) {
      if (!failed && this.name === "items" && value.type === "document") {
        failed = true;
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
  });
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  const input = backup.locator('input[accept*="application/zip"]');
  const choose = () => input.setInputFiles({ name: "mixed.keepall.zip", mimeType: "application/zip", buffer });
  await choose();
  const review = page.getByRole("dialog", { name: "Import backup", exact: true });
  await review.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(backup.getByRole("alert")).toContainText("Your library wasn't changed");
  expect(await snapshot(page)).toEqual(before);
  await choose();
  await review.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(page.locator('div.sr-only[role="status"][aria-atomic="true"]')).toContainText("Merged: 2 added, 2 updated, 0 unchanged.");
  const restored = await snapshot(page);
  expect(restored.items).toHaveLength(4);
  expect(restored.assets).toHaveLength(2);
  expect(restored.documentAssets).toHaveLength(1);
  expect(restored.videoAssets).toHaveLength(1);
  expect(restored.thumbnails).toHaveLength(1);
  expect(restored.documentAssets).toContainEqual(expect.objectContaining({ bytes: Array.from(text) }));
  await page.reload();
  expect(await snapshot(page)).toEqual(restored);
});
