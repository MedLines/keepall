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
  await page.getByRole("menuitem", { name: "Move to Trash", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("restore it later");
  await page.getByRole("button", { name: "Move to Trash" }).click();
  await expect(card).toHaveCount(0);
  await page.goto("/?q=Unique+recoverable+phrase&collection=reading&tag=tag");
  await expect(page.locator('[data-item-id="link"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved reference" })).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-item-id="link"]')).toBeVisible();
  await card.hover();
  await page.getByRole("button", { name: "Actions for Saved reference", exact: true }).click();
  await expect(page.getByRole("menuitem")).toHaveText(["Restore", "Delete permanently"]);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: testInfo.outputPath("trash-light.png"), fullPage: true });
  await page.getByRole("button", { name: "Restore", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Trash is empty.", { exact: true })).toBeVisible();
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
  await page.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: "Move to Trash", exact: true }).click();
  await page.getByRole("button", { name: "Move to Trash" }).click();
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(page.locator("[data-item-id]")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  const closeNavigation = page.getByRole("button", { name: "Close navigation" });
  await closeNavigation.click();
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  const row = page.locator('[data-item-id="link"]');
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
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(closeNavigation).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("trash-dark-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Trash is empty.", { exact: true })).toBeVisible();
});

test("detail deletion is recoverable and a stale detail URL offers Trash", async ({ page }) => {
  await page.goto("/items/note");
  await page.getByRole("button", { name: "Move note to Trash" }).click();
  await expect(page.getByRole("dialog")).toContainText("restore it later");
  await page.getByRole("button", { name: "Move to Trash" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/items/note");
  await expect(page.getByText("Item not found. It may be in Trash.")).toBeVisible();
  await page.getByRole("link", { name: "Open Trash" }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.goto("/items/note");
  await expect(page.getByRole("heading", { name: "Saved note", exact: true })).toBeVisible();
  await expect(page.getByText("Keep this note", { exact: true })).toBeVisible();
});

for (const layout of ["Grid", "List"]) {
  test(`Trash ${layout} selection deletes only selected items and preserves cancellation`, async ({ page }, testInfo) => {
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open("keepall"); req.onsuccess = () => resolve(req.result); });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("items", "readwrite");
        for (const [id, title] of [["chosen-a", "Chosen A"], ["chosen-b", "Chosen B"], ["kept", "Keep unselected"]]) {
          tx.objectStore("items").put({ id, title, type: "note", content: title, createdAt: 1, updatedAt: 2, deletedAt: 2, tagIds: [], collectionIds: [] });
        }
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
    await page.goto("/?trash=1");
    await page.getByRole("button", { name: `${layout} view` }).click();
    const search = page.getByRole("searchbox", { name: "Search", exact: true });
    await search.fill("Chosen");
    await expect(page.locator("[data-item-id]")).toHaveCount(2);
    const first = page.getByRole("checkbox", { name: "Select Chosen A", exact: true });
    await first.focus();
    await page.keyboard.press("Space");
    const bulk = page.getByRole("region", { name: "Bulk actions" });
    await expect(bulk).toContainText("1 selected");
    await expect(bulk.getByRole("button", { name: "Tags", exact: true })).toHaveCount(0);
    await expect(bulk.getByRole("button", { name: "Move to Trash", exact: true })).toHaveCount(0);
    await bulk.getByRole("button", { name: "Select all", exact: true }).click();
    await expect(bulk).toContainText("2 selected");
    await bulk.getByRole("button", { name: "Deselect all", exact: true }).click();
    await expect(bulk).toHaveCount(0);
    for (const id of ["chosen-a", "chosen-b"]) {
      const card = page.locator(`[data-item-id="${id}"]`);
      await card.hover();
      await card.locator("[data-selection-indicator]").click();
    }
    const remove = bulk.getByRole("button", { name: "Delete permanently", exact: true });
    await expect(remove).toHaveCSS("color", await page.getByRole("button", { name: "Empty Trash", exact: true }).evaluate((button) => getComputedStyle(button).color));
    await page.screenshot({ path: testInfo.outputPath(`trash-${layout.toLowerCase()}-selection.png`) });
    await remove.click();
    const dialog = page.getByRole("dialog", { name: "Permanently delete selected items?" });
    await expect(dialog).toContainText("2 selected items");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(bulk).toContainText("2 selected");
    await remove.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(bulk).toContainText("2 selected");
    await remove.click();
    await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
    await expect(bulk).toHaveCount(0);
    await search.fill("");
    await expect(page.locator("[data-item-id]")).toHaveCount(1);
    await expect(page.locator('[data-item-id="kept"]')).toBeVisible();
    await expect(page).not.toHaveURL(/[?&]q=/);
    await page.reload();
    await expect(page.locator("[data-item-id]")).toHaveCount(1);
    await page.getByRole("button", { name: "All items", exact: true }).click();
    await expect(page.locator("[data-item-id]")).toHaveCount(2);
  });
}

test("Trash uses the library shell and both sidebar menus can empty all matching and hidden cards", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Keep both original active items and add a large, mixed Trash in this disposable context.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open("keepall"); req.onsuccess = () => resolve(req.result); });
    const canvas = document.createElement("canvas"); canvas.width = 120; canvas.height = 80;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#66898a"; ctx.fillRect(0, 0, 120, 80);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!)));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets"], "readwrite");
      tx.objectStore("assets").put({ id: "asset", bytes, mimeType: "image/png", byteLength: bytes.length, createdAt: 1 });
      for (let i = 0; i < 180; i++) tx.objectStore("items").put({ id: `trashed-${i}`, type: "image", title: `Trashed photo ${i}`, assetIds: ["asset"], caption: "", sourceUrl: "", createdAt: i + 1, updatedAt: i + 1, deletedAt: i + 1, tagIds: [], collectionIds: [] });
      tx.objectStore("items").put({ id: "trashed-note", type: "note", title: "Unique hidden note", content: "Read later", createdAt: 182, updatedAt: 182, deletedAt: 182, tagIds: [], collectionIds: [] });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  });
  await page.reload();
  const panel = page.locator(".library-top-bar");
  const initialWidth = (await panel.boundingBox())!.width;
  const trash = page.getByRole("button", { name: "Trash", exact: true });
  const trashRow = trash.locator("..");
  const trashMenu = page.getByRole("button", { name: "Trash actions", exact: true });
  await trash.hover();
  await expect(trashRow).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const rowBounds = (await trashRow.boundingBox())!;
  const menuBounds = (await trashMenu.boundingBox())!;
  expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(rowBounds.x + rowBounds.width);
  await trashRow.screenshot({ path: testInfo.outputPath("trash-row-hover.png") });
  await trash.click();
  await expect(trash).toHaveAttribute("aria-current", "page");
  await expect(trashRow).toHaveClass(/ui-selected/);
  await trashMenu.hover();
  await trashRow.screenshot({ path: testInfo.outputPath("trash-row-selected.png") });
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await trashMenu.hover();
  await trashRow.screenshot({ path: testInfo.outputPath("trash-row-selected-dark.png") });
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await expect(page).toHaveURL(/trash=1/);
  await expect(page.getByRole("heading", { name: "Trash", exact: true })).toBeVisible();
  expect((await panel.boundingBox())!.width).toBe(initialWidth);
  await expect(page.getByRole("button", { name: "Theme", exact: true })).toHaveCount(1);
  await expect(page.locator('.library-card').first()).toBeVisible();
  await expect(page.locator('[data-item-id="trashed-179"] img').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("trash-library-grid.png") });
  for (const width of [2196, 975]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.library-card').first()).toBeVisible();
    await trash.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Empty Trash" }).click();
    const dialog = page.getByRole("dialog", { name: "Empty Trash?" });
    await expect(dialog).toContainText("all 181 items");
    await dialog.getByRole("button", { name: "Cancel" }).click();
  }
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.locator('.library-list-row').first()).toBeVisible();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("Unique hidden note");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await trash.hover();
  await page.getByRole("button", { name: "Trash actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Empty Trash" }).click();
  const dialog = page.getByRole("dialog", { name: "Empty Trash?" });
  await expect(dialog).toContainText("all 181 items");
  await dialog.getByRole("button", { name: "Empty Trash", exact: true }).click();
  await expect(page.locator("[data-item-id]")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("");
  await expect(page.getByText("Trash is empty.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Empty Trash", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "All items", exact: true }).click();
  await expect(page.locator("[data-item-id]")).toHaveCount(2);
  expect(errors).toEqual([]);
});
