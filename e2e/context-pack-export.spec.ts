import { expect, test, type Download, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";

test.use({ serviceWorkers: "block" });

async function zipEntries(download: Download) {
  const path = await download.path();
  const reader = new ZipReader(new BlobReader(new Blob([await readFile(path)])));
  const entries = await reader.getEntries();
  const text = async (name: string) => {
    const entry = entries.find((candidate) => candidate.filename === name);
    return entry && !entry.directory ? entry.getData!(new TextWriter()) : undefined;
  };
  const names = entries.map((entry) => entry.filename);
  return { names, text, close: () => reader.close() };
}

async function exportPack(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Export for an AI agent" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/About [\d,]+ tokens of text/)).toBeVisible();
  const pending = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export pack" }).click();
  const download = await pending;
  await expect(page.getByRole("dialog", { name: "Context Pack ready" })).toBeVisible();
  return download;
}

test.beforeEach(async ({ page }) => {
  await page.route("https://www.google.com/s2/favicons**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  // This database belongs to Playwright's disposable browser context.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 20;
    canvas.getContext("2d")!.fillRect(0, 0, 32, 20);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((result) => resolve(result!), "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const common = { createdAt: 1, updatedAt: 1, tagIds: ["t1"], collectionIds: ["c1"] };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets", "collections", "tags"], "readwrite");
      tx.objectStore("collections").put({ id: "c1", name: "Inspo", createdAt: 1, pinnedItemIds: ["brief"] });
      tx.objectStore("tags").put({ id: "t1", name: "typography", createdAt: 1 });
      tx.objectStore("assets").put({ id: "shot", bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: "shot", createdAt: 1 });
      tx.objectStore("items").put({
        ...common, id: "folio", type: "link", title: "Folio", url: "https://folio.example/", noteContent: "Love the grid.",
        previewStatus: "ready", previewTitle: "", previewDescription: "A portfolio.", previewImageUrl: "", previewAssetId: null,
        previewRetry: "none", previewAttemptedAt: 1, screenshots: [{ assetId: "shot", capturedAt: 1, width: 32, height: 20 }], createdAt: 3,
      });
      tx.objectStore("items").put({ ...common, id: "brief", type: "note", title: "Brief", content: "## Goals\nCalm type.", format: "markdown", createdAt: 2 });
      tx.objectStore("items").put({ ...common, collectionIds: [], id: "elsewhere", type: "note", title: "Elsewhere", content: "Not in Inspo", createdAt: 1 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator('[data-item-id="folio"]')).toBeVisible();
});

test("exports the current collection as a pack with cards, files and a README", async ({ page }) => {
  await page.goto("/?collection=c1");
  await expect(page.locator('[data-item-id="elsewhere"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export for an AI agent" });
  await expect(dialog.getByLabel("Pack name")).toHaveValue("Inspo");
  await expect(dialog.getByText("2 items")).toBeVisible();
  const download = await exportPack(page);
  expect(download.suggestedFilename()).toBe("inspo.zip");

  const zip = await zipEntries(download);
  expect(zip.names).toEqual([
    "inspo/README.md", "inspo/index.md", "inspo/manifest.json",
    "inspo/items/001-brief.md",
    "inspo/items/002-folio.md", "inspo/files/002-folio-screenshot-1.png",
  ]);
  expect(await zip.text("inspo/README.md")).toContain("Source: Collection *Inspo*, newest first");
  const card = await zip.text("inspo/items/002-folio.md");
  expect(card).toContain("## My notes\n\nLove the grid.");
  expect(card).toContain("- Screenshot 1 (32×20): ../files/002-folio-screenshot-1.png");
  expect(await zip.text("inspo/items/001-brief.md")).toContain("### Goals");
  expect(zip.names.some((name) => /(^|\/)(AGENTS|CLAUDE)\.md$/i.test(name))).toBe(false);
  await zip.close();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("text-only export from a selection leaves files out", async ({ page }) => {
  const checkbox = page.getByRole("checkbox", { name: "Select Folio", exact: true });
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  // The bulk bar shows a compact menu when its row is narrow, buttons otherwise.
  const menu = page.getByRole("button", { name: "Selection actions: 1 selected" });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole("menuitem", { name: "Export selected" }).click();
  } else {
    await page.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: "Export", exact: true }).click();
  }
  const dialog = page.getByRole("dialog", { name: "Export for an AI agent" });
  await expect(dialog.getByText("1 item")).toBeVisible();
  await dialog.getByLabel("Pack name").fill("Folio notes");
  await dialog.getByRole("radio", { name: /Text only/ }).check();
  const download = await exportPack(page);
  expect(download.suggestedFilename()).toBe("folio-notes.zip");
  const zip = await zipEntries(download);
  expect(zip.names).toEqual(["folio-notes/README.md", "folio-notes/index.md", "folio-notes/manifest.json", "folio-notes/items/001-folio.md"]);
  expect(await zip.text("folio-notes/README.md")).toContain("Source: 1 selected item from All items");
  await zip.close();
});
