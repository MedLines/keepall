import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  // Seed only the disposable test browser's database.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "collections", "tags"], "readwrite");
      tx.objectStore("collections").put({ id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: ["link"] });
      tx.objectStore("tags").put({ id: "tag", name: "Research", createdAt: 1 });
      const base = { createdAt: 1, updatedAt: 1, tagIds: ["tag"], collectionIds: ["reading"] };
      tx.objectStore("items").put({ ...base, id: "link", type: "link", title: "Saved reference", url: "https://example.com/reference", noteContent: "Unique recoverable phrase", previewTitle: "", previewDescription: "", previewStatus: "ready", previewRetry: "none", previewAttemptedAt: 1, previewImageUrl: "", previewAssetId: null });
      tx.objectStore("items").put({ ...base, id: "note", type: "note", title: "Saved note", content: "Keep this note" });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
});

test("card deletion moves to Trash and restore preserves search, tags and collection pins", async ({ page }, testInfo) => {
  const card = page.locator('[data-item-id="link"]');
  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("restore it from Trash");
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(card).toHaveCount(0);
  await page.goto("/?q=Unique+recoverable+phrase&collection=reading&tag=tag");
  await expect(page.locator('[data-item-id="link"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Trash", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved reference" })).toBeVisible();
  await page.reload();
  await page.screenshot({ path: testInfo.outputPath("trash-light.png"), fullPage: true });
  await page.getByRole("button", { name: "Restore", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Trash is empty" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trash", exact: true })).toBeFocused();
  await page.goto("/?q=Unique+recoverable+phrase&collection=reading&tag=tag&layout=list");
  await expect(page.locator('[data-item-id="link"]')).toContainText("Unique recoverable phrase");
  const restored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open("keepall"); req.onsuccess = () => resolve(req.result); });
    const result = await new Promise<unknown>((resolve) => { const req = db.transaction("collections").objectStore("collections").get("reading"); req.onsuccess = () => resolve(req.result); });
    db.close();
    return result;
  });
  expect(restored).toMatchObject({ pinnedItemIds: ["link"] });
});

test("bulk deletion and permanent deletion work across reloads, with cancellation and mobile dark theme", async ({ page }, testInfo) => {
  for (const id of ["link", "note"]) {
    const card = page.locator(`[data-item-id="${id}"]`);
    await card.hover();
    await card.locator("[data-selection-indicator]").click();
  }
  await page.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Trash", exact: true }).click();
  await expect(page.getByRole("region", { name: "Trashed items" }).getByRole("listitem")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  const row = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Saved reference" }) });
  await row.getByRole("button", { name: "Delete permanently" }).click();
  const dialog = page.getByRole("dialog", { name: "Permanently delete this item?" });
  await expect(dialog).toContainText("cannot be undone");
  await page.screenshot({ path: testInfo.outputPath("trash-confirm-dark-mobile.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Delete permanently" }).click();
  await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Trash", exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("trash-dark-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Trash is empty" })).toBeVisible();
});

test("detail deletion is recoverable and a stale detail URL offers Trash", async ({ page }) => {
  await page.goto("/items/note");
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByRole("dialog")).toContainText("restore it from Trash");
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/items/note");
  await expect(page.getByText("Item not found. It may be in Trash.")).toBeVisible();
  await page.getByRole("link", { name: "Open Trash" }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.goto("/items/note");
  await expect(page.getByRole("heading", { name: "Saved note", exact: true })).toBeVisible();
  await expect(page.getByText("Keep this note", { exact: true })).toBeVisible();
});
