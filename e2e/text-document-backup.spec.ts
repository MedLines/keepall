import { expect, test, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { TextReader, TextWriter, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";

test.use({ serviceWorkers: "block" });

async function documentSnapshot(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction(["items", "documentAssets"], "readonly");
      const read = <T>(store: string) => new Promise<T[]>((resolve, reject) => {
        const records = tx.objectStore(store).getAll();
        records.onsuccess = () => resolve(records.result);
        records.onerror = () => reject(records.error);
      });
      const [items, originals] = await Promise.all([
        read<{ type: string; sourceFileName: string; noteContent: string; deletedAt?: number }>("items"),
        read<{ bytes: Uint8Array; byteLength: number }>("documentAssets"),
      ]);
      return { items, originals: originals.map((original) => ({ bytes: Array.from(original.bytes), byteLength: original.byteLength })) };
    } finally { db.close(); }
  });
}

test("document originals survive native storage, ZIP export, replacement and reload", async ({ page }) => {
  const bytes = new TextEncoder().encode("\uFEFF# Original\r\nمرحبا café\n");
  const assetId = randomUUID();
  const documents = [
    { id: randomUUID(), type: "document", format: "markdown", sourceFileName: "original.md", title: "Original document", assetId, noteContent: "Personal note", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 2 },
    { id: randomUUID(), type: "document", format: "text", sourceFileName: "shared.txt", title: "Shared original", assetId, noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 2, deletedAt: 3 },
  ];
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add("manifest.json", new TextReader(JSON.stringify({
    format: "keepall", version: 9, exportedAt: 123, items: documents, tags: [], collections: [],
    assets: [], videos: [], thumbnails: [], preferences: { pinnedCollectionIds: [] },
    documents: [{ id: assetId, path: `documents/${assetId}.bin`, byteLength: bytes.length, contentHash: createHash("sha256").update(bytes).digest("hex"), createdAt: 1 }],
  })));
  await writer.add(`documents/${assetId}.bin`, new Uint8ArrayReader(bytes));
  const archive = await writer.close();

  await page.goto("/settings#storage");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  const input = backup.locator('input[accept*="application/zip"]');
  await input.setInputFiles({ name: "documents.keepall.zip", mimeType: "application/zip", buffer: Buffer.from(archive) });
  const review = page.getByRole("dialog", { name: "Import backup", exact: true });
  await expect(review.getByRole("rowheader", { name: "Documents", exact: true }).locator("..")).toContainText("Documents02");
  await review.getByText("Organization and media details", { exact: true }).click();
  await expect(review.getByLabel("Current Document files: 0", { exact: true })).toHaveText("0");
  await expect(review.getByLabel("Backup Document files: 1", { exact: true })).toHaveText("1");
  await review.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(page.locator('div.sr-only[role="status"][aria-atomic="true"]')).toContainText("Merged:");
  const snapshot = await documentSnapshot(page);
  expect(snapshot.items).toHaveLength(2);
  expect(snapshot.items).toContainEqual(expect.objectContaining({ sourceFileName: "original.md", noteContent: "Personal note" }));
  expect(snapshot.items).toContainEqual(expect.objectContaining({ sourceFileName: "shared.txt", deletedAt: 3 }));
  expect(snapshot.originals).toEqual([{ bytes: Array.from(bytes), byteLength: bytes.length }]);

  const download = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Export backup", exact: true }).click();
  const path = await (await download).path();
  const reader = new ZipReader(new Uint8ArrayReader(await readFile(path!)));
  try {
    const entries = await reader.getEntries();
    const manifestEntry = entries.find((entry) => entry.filename === "manifest.json")!;
    if (manifestEntry.directory) throw new Error("Manifest cannot be a directory");
    const manifest = JSON.parse(await manifestEntry.getData(new TextWriter())) as { version: number; documents: { path: string }[] };
    expect(manifest.version).toBe(10);
    expect(manifest.documents).toHaveLength(1);
    const original = entries.find((entry) => entry.filename === manifest.documents[0].path)!;
    if (original.directory) throw new Error("Original cannot be a directory");
    expect(Array.from(await original.getData(new Uint8ArrayWriter()))).toEqual(Array.from(bytes));
  } finally { await reader.close(); }

  await input.setInputFiles(path!);
  await review.getByRole("button", { name: "Replace library", exact: true }).click();
  await page.getByRole("dialog", { name: "Replace library?", exact: true }).getByRole("button", { name: "Confirm replacement", exact: true }).click();
  await expect(page.locator('div.sr-only[role="status"][aria-atomic="true"]')).toContainText("Library replaced from backup");
  await page.reload();
  expect(await documentSnapshot(page)).toEqual(snapshot);
  await page.goto("/?q=" + encodeURIComponent("مرحبا café"));
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt mark")).toHaveText(["مرحبا", "café"]);
  await page.goto("/?trash=1&q=" + encodeURIComponent("مرحبا café"));
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt mark")).toHaveText(["مرحبا", "café"]);
});
