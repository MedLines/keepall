import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function holdWrites(page: Page) {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      const tx = original.apply(this, args);
      const gate = window as typeof window & { holdImportWrites?: boolean; writesBeforeHold?: number };
      if (gate.holdImportWrites && tx.mode === "readwrite" && tx.objectStoreNames.contains("items")) {
        if ((gate.writesBeforeHold ?? 0) > 0) gate.writesBeforeHold! -= 1;
        else {
          const keepAlive = () => {
            if (!gate.holdImportWrites) return;
            try { tx.objectStore("items").count().onsuccess = keepAlive; }
            catch { /* Cancellation aborts the held transaction. */ }
          };
          keepAlive();
        }
      }
      return tx;
    };
  });
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const names = Array.from(db.objectStoreNames);
      const tx = db.transaction(names);
      return Object.fromEntries(await Promise.all(names.map(name => new Promise<[string, unknown[]]>((resolve, reject) => {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => resolve([name, request.result]);
        request.onerror = () => reject(request.error);
      }))));
    } finally { db.close(); }
  });
}

for (const mode of ["merge", "replace"] as const) {
  test(`canceling ${mode} while committing rolls back the whole backup`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await holdWrites(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("keepall"); r.onsuccess = () => resolve(r.result); });
      const tx = db.transaction(["items", "tags", "collections", "preferences"], "readwrite");
      tx.objectStore("items").put({ id: "original", type: "note", title: "", content: "Keep original", tagIds: ["old-tag"], collectionIds: ["old-folder"], createdAt: 1, updatedAt: 1 });
      tx.objectStore("items").put({ id: "trash", type: "note", title: "", content: "Keep Trash", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1, deletedAt: 2 });
      tx.objectStore("tags").put({ id: "old-tag", name: "Original tag", createdAt: 1 });
      tx.objectStore("collections").put({ id: "old-folder", name: "Original folder", createdAt: 1, pinnedItemIds: [] });
      tx.objectStore("preferences").put({ id: "library", pinnedCollectionIds: ["old-folder"] });
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
      db.close();
    });
    await page.goto("/settings#backup-heading");
    const before = await snapshot(page);
    const items = Array.from({ length: 205 }, (_, index) => ({ id: `new-${index}`, type: "note", title: "", content: `New ${index}`, tagIds: ["new-tag"], collectionIds: ["new-folder"], createdAt: 2, updatedAt: 2 }));
    const backup = { format: "keepall", version: 7, exportedAt: 3, items, assets: [],
      tags: [{ id: "new-tag", name: "New tag", createdAt: 2 }],
      collections: [{ id: "new-folder", name: "New folder", createdAt: 2, pinnedItemIds: [] }], preferences: { pinnedCollectionIds: ["new-folder"] } };
    const input = page.getByRole("region", { name: "Backup", exact: true }).locator('input[accept*="application/json"]');
    await input.setInputFiles({ name: "cancel.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
    const review = page.getByRole("dialog", { name: "Import backup", exact: true });
    if (mode === "replace") await review.getByRole("button", { name: "Replace library", exact: true }).click();
    await page.evaluate(() => Object.assign(window, { holdImportWrites: true }));
    await page.getByRole("dialog").getByRole("button", { name: mode === "merge" ? "Merge" : "Confirm replacement", exact: true }).click();
    const progress = page.getByRole("dialog", { name: mode === "merge" ? "Merging backup" : "Restoring library", exact: true });
    await expect(progress).toContainText("Saving library");
    await expect(progress.getByRole("button", { name: "Cancel import", exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(progress).toBeVisible();
    await expect(progress).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath(`${mode}-cancel-action.png`) });
    await progress.getByRole("button", { name: "Cancel import", exact: true }).click();
    await expect(progress).toBeHidden();
    await expect(page.getByRole("region", { name: "Backup", exact: true })).toContainText("Backup import canceled. Your library wasn't changed.");
    expect(await snapshot(page)).toEqual(before);
    await page.evaluate(() => Object.assign(window, { holdImportWrites: false }));
    await page.reload();
    expect(await snapshot(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test("canceling a file write preserves completed files and Continue skips them", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await holdWrites(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await page.getByRole("button", { name: "Import items", exact: true }).click();
  await page.getByRole("dialog", { name: "Bulk import", exact: true }).locator('input[data-bulk-files]').setInputFiles(
    ["first", "second", "third"].map(name => ({ name: `${name}.txt`, mimeType: "text/plain", buffer: Buffer.from(name) })),
  );
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await page.evaluate(() => Object.assign(window, { holdImportWrites: true, writesBeforeHold: 1 }));
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Importing files", exact: true });
  await expect(progress).toContainText("1 saved · 0 failed");
  await expect(progress).toContainText("second.txt");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(progress.getByRole("button", { name: "Cancel import", exact: true })).toBeInViewport();
  await expect(progress).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("file-cancel-mobile.png") });
  await progress.getByRole("button", { name: "Cancel import", exact: true }).click();
  await expect(progress).toBeHidden();
  await expect(drawer).toContainText("Import canceled. 1 saved, 0 failed, 2 not imported.");
  expect((await snapshot(page)).items).toHaveLength(1);
  expect((await snapshot(page)).documentAssets).toHaveLength(1);
  await page.evaluate(() => Object.assign(window, { holdImportWrites: false }));
  await drawer.getByRole("button", { name: "Continue import", exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).items.length).toBe(3);
  await expect(progress).toBeHidden();
  await expect(drawer).toBeHidden();
  await page.reload();
  expect((await snapshot(page)).items).toHaveLength(3);
  expect((await snapshot(page)).documentAssets).toHaveLength(3);
  expect(errors).toEqual([]);
});

test("canceling a gallery rolls back media and leaves its draft available", async ({ page }) => {
  await holdWrites(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Import items", exact: true }).click();
  await page.getByRole("dialog", { name: "Bulk import", exact: true }).locator('input[data-bulk-files]').setInputFiles(["public/icons/icon-192.png", "public/icons/icon-512.png"]);
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await drawer.getByRole("radio", { name: /One image item/ }).check();
  await page.evaluate(() => Object.assign(window, { holdImportWrites: true }));
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Importing files", exact: true });
  await expect(progress).toContainText("Saving gallery");
  await progress.getByRole("button", { name: "Cancel import", exact: true }).click();
  await expect(progress).toBeHidden();
  await expect(drawer).toContainText("Gallery import canceled. No items were saved.");
  const stored = await snapshot(page);
  for (const name of ["items", "assets", "thumbnails", "collections", "tags"]) expect(stored[name]).toHaveLength(0);
  await expect(drawer.getByLabel("2 images attached")).toBeVisible();
  await page.evaluate(() => Object.assign(window, { holdImportWrites: false }));
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).items.length).toBe(1);
  await expect(progress).toBeHidden();
  await expect(drawer).toBeHidden();
  expect((await snapshot(page)).assets).toHaveLength(2);
});

test("canceling backup reading ignores the file when its read finishes later", async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      if (this.name !== "slow.json") return original.call(this);
      return new Promise<string>(resolve => Object.assign(window, {
        releaseBackupRead: () => original.call(this).then(resolve),
      }));
    };
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.goto("/settings#backup-heading");
  const before = await snapshot(page);
  const backup = { format: "keepall", version: 7, exportedAt: 3, items: [], assets: [], tags: [], collections: [], preferences: { pinnedCollectionIds: [] } };
  await page.getByRole("region", { name: "Backup", exact: true }).locator('input[accept*="application/json"]')
    .setInputFiles({ name: "slow.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect.poll(() => page.evaluate(() => typeof (window as typeof window & { releaseBackupRead?: unknown }).releaseBackupRead)).toBe("function");
  await page.getByRole("button", { name: "Cancel reading", exact: true }).click();
  await expect(page.getByRole("region", { name: "Backup", exact: true })).toContainText("Backup reading canceled. Your library wasn't changed.");
  await page.evaluate(async () => {
    await (window as typeof window & { releaseBackupRead?: () => Promise<void> }).releaseBackupRead?.();
  });
  await expect(page.getByRole("dialog", { name: "Import backup", exact: true })).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
});

test("canceling browser bookmarks finishes the current bookmark and stops remaining rows", async ({ page }) => {
  await holdWrites(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Import items", exact: true }).click();
  const bulk = page.getByRole("dialog", { name: "Bulk import", exact: true });
  const html = `<DL>${[0, 1, 2].map(index => `<DT><A HREF="https://cancel-${index}.example/" TAGS="Cancellation">Bookmark ${index}</A>`).join("")}</DL>`;
  await bulk.locator('input[accept*="text/html"]').setInputFiles({ name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from(html) });
  const review = page.getByRole("dialog", { name: "Import browser bookmarks", exact: true });
  await page.evaluate(() => Object.assign(window, { holdImportWrites: true, writesBeforeHold: 3 }));
  await review.getByRole("button", { name: "Import bookmarks", exact: true }).click();
  await expect(review).toContainText("1 of 3 bookmarks processed");
  await review.getByRole("button", { name: "Cancel import", exact: true }).click();
  await expect(review.getByRole("button", { name: "Canceling…", exact: true })).toBeDisabled();
  await expect(review).toContainText("Finishing the current bookmark");
  await page.evaluate(() => Object.assign(window, { holdImportWrites: false }));
  await expect(review).toBeHidden();
  await expect(bulk).toContainText("Bookmark import canceled. Completed bookmarks are kept. 2 added");
  expect((await snapshot(page)).items).toHaveLength(2);
});
