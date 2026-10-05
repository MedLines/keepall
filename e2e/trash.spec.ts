import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function clickSelectionAction(page: Page, label: string) {
  const bulk = page.getByRole("region", { name: "Bulk actions" });
  const trigger = bulk.getByRole("button", { name: /Selection actions:/ });
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
  } else {
    await bulk.getByRole("button", { name: label, exact: true }).click();
  }
}

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
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
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
  await expect(page).toHaveURL(/trash=1/);
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
  await clickSelectionAction(page, "Move to Trash");
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
    const trigger = bulk.getByRole("button", { name: /Selection actions:/ });
    if (await trigger.isVisible()) {
      await trigger.click();
      await expect(page.getByRole("menu", { name: /^Selection actions:/ })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Organize", exact: true })).toHaveCount(0);
      await expect(page.getByRole("menuitem", { name: "Move to Trash", exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(bulk).toContainText("1 selected");
    } else {
      await expect(bulk.getByRole("button", { name: "Organize" })).toHaveCount(0);
      await expect(bulk.getByRole("button", { name: "Move to Trash" })).toHaveCount(0);
    }
    await clickSelectionAction(page, "Select all");
    await expect(bulk).toContainText("2 selected");
    await clickSelectionAction(page, "Deselect all");
    await expect(bulk).toHaveCount(0);
    for (const id of ["chosen-a", "chosen-b"]) {
      const card = page.locator(`[data-item-id="${id}"]`);
      await card.hover();
      await card.locator("[data-selection-indicator]").click();
    }
    await page.screenshot({ path: testInfo.outputPath(`trash-${layout.toLowerCase()}-selection.png`) });
    const dangerColor = await page.getByRole("button", { name: "Empty Trash", exact: true }).evaluate((button) => getComputedStyle(button).color);
    if (await trigger.isVisible()) {
      await trigger.click();
      const action = page.getByRole("menuitem", { name: "Delete permanently", exact: true });
      await expect(action).toHaveCSS("color", dangerColor);
      await action.click();
    } else {
      const action = bulk.getByRole("button", { name: "Delete permanently", exact: true });
      await expect(action).toHaveCSS("color", dangerColor);
      await action.click();
    }
    const dialog = page.getByRole("dialog", { name: "Permanently delete selected items?" });
    await expect(dialog).toContainText("2 selected items");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(bulk).toContainText("2 selected");
    await clickSelectionAction(page, "Delete permanently");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(bulk).toContainText("2 selected");
    await clickSelectionAction(page, "Delete permanently");
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
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "oklch(0.604165533 0.039188126 198.365758744)"; ctx.fillRect(0, 0, 120, 80);
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


for (const clearHidden of [false, true]) {
  test(`selected restore preserves hidden selection and stored fields, clear hidden=${clearHidden}`, async ({ page }, testInfo) => {
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open("keepall"); req.onsuccess = () => resolve(req.result); });
      const canvas = document.createElement("canvas"); canvas.width = 80; canvas.height = 60;
      canvas.getContext("2d")!.fillRect(0, 0, 80, 60);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!)));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["items", "assets", "thumbnails", "collections"], "readwrite");
        tx.objectStore("assets").put({ id: "restore-asset", bytes, mimeType: "image/png", byteLength: bytes.length, createdAt: 1 });
        tx.objectStore("thumbnails").put({ assetId: "restore-asset", blob });
        tx.objectStore("collections").put({ id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: ["link", "restore-image"] });
        const base = { createdAt: 1, updatedAt: 2, deletedAt: 2, tagIds: ["tag"], collectionIds: ["reading"], collectionAddedAt: 123 };
        tx.objectStore("items").put({ ...base, id: "restore-image", type: "image", title: "Restore image", assetIds: ["restore-asset"], caption: "Keep caption", sourceUrl: "https://example.com/photo" });
        tx.objectStore("items").put({ ...base, id: "restore-note", type: "note", title: "Restore note", content: "Keep selected hidden note" });
        tx.objectStore("items").put({ ...base, id: "unselected", type: "note", title: "Unselected trash", content: "Leave in Trash" });
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      }); db.close();
    });
    await page.goto("/?trash=1");
    await page.setViewportSize({ width: clearHidden ? 390 : 2196, height: 900 });
    if (clearHidden) await page.getByRole("button", { name: "Close navigation" }).click();
    for (const title of ["Restore image", "Restore note"]) {
      await page.getByRole("checkbox", { name: `Select ${title}`, exact: true }).focus();
      await page.keyboard.press("Space");
    }
    const search = page.getByRole("searchbox", { name: "Search", exact: true });
    await search.fill("Restore image");
    const bulk = page.getByRole("region", { name: "Bulk actions" });
    await expect(bulk).toContainText("2 selected");
    await expect(bulk).toContainText("1 hidden");
    if (clearHidden) {
      const trigger = bulk.getByRole("button", { name: /Selection actions:/ });
      await trigger.click();
      await page.getByRole("menuitem", { name: "Clear hidden selection", exact: true }).click();
      await expect(bulk).toContainText("1 selected");
      await expect(bulk).not.toContainText("hidden");
    }
    await page.screenshot({ path: testInfo.outputPath(`restore-selected-${clearHidden ? "mobile" : "wide"}.png`) });
    const trigger = bulk.getByRole("button", { name: /Selection actions:/ });
    if (await trigger.isVisible()) {
      await trigger.click();
      await page.getByRole("menuitem", { name: "Restore selected", exact: true }).focus();
    } else await bulk.getByRole("button", { name: "Restore selected", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "restored to your library" })).toHaveText(`${clearHidden ? 1 : 2} item${clearHidden ? "" : "s"} restored to your library.`);
    await expect(page.getByRole("heading", { name: "Trash", exact: true })).toBeFocused();
    await expect(bulk).toHaveCount(0);
    await search.fill("");
    await expect(page.locator("[data-item-id]")).toHaveCount(clearHidden ? 2 : 1);
    await expect(page.locator('[data-item-id="unselected"]')).toBeVisible();
    await page.goto("/?collection=reading&tag=tag");
    await page.reload();
    await expect(page.locator('[data-item-id="restore-image"] img').first()).toBeVisible();
    await expect(page.locator('[data-item-id="restore-note"]')).toHaveCount(clearHidden ? 0 : 1);
    const stored = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open("keepall"); req.onsuccess = () => resolve(req.result); });
      const read = (store: string, id: string) => new Promise<Record<string, unknown>>((resolve) => { const req = db.transaction(store).objectStore(store).get(id); req.onsuccess = () => resolve(req.result); });
      const image = await read("items", "restore-image");
      const note = await read("items", "restore-note");
      const collection = await read("collections", "reading");
      const asset = await read("assets", "restore-asset");
      const thumbnail = await read("thumbnails", "restore-asset");
      db.close();
      return { image, note, collection, assetBytes: (asset.bytes as Uint8Array).length, thumbnailSize: (thumbnail.blob as Blob).size };
    });
    expect(stored.image).toMatchObject({ caption: "Keep caption", sourceUrl: "https://example.com/photo", assetIds: ["restore-asset"], tagIds: ["tag"], collectionIds: ["reading"], collectionAddedAt: 123, createdAt: 1 });
    expect(stored.image.deletedAt).toBeUndefined();
    expect(stored.note.content).toBe("Keep selected hidden note");
    expect(stored.note.deletedAt).toBe(clearHidden ? 2 : undefined);
    if (!clearHidden) expect(stored.image.updatedAt).toBe(stored.note.updatedAt);
    expect(stored.collection.pinnedItemIds).toEqual(["link", "restore-image"]);
    expect(stored.assetBytes).toBeGreaterThan(0);
    expect(stored.thumbnailSize).toBeGreaterThan(0);
  });
}
