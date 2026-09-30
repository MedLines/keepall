import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["items", "tags", "collections"], "readwrite");
      const base = { tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
      transaction.objectStore("items").put({ ...base, id: "note", type: "note", title: "Note", content: "Note body" });
      transaction.objectStore("items").put({ ...base, id: "link", type: "link", title: "Link", url: "https://example.com", noteContent: "", previewTitle: "", previewDescription: "", previewStatus: "ready", previewRetry: "none", previewAttemptedAt: 1, previewImageUrl: "", previewAssetId: null });
      transaction.objectStore("items").put({ ...base, id: "image", type: "image", title: "Image", assetIds: ["missing"], caption: "", sourceUrl: "" });
      transaction.objectStore("items").put({ ...base, id: "video", type: "video", title: "Video", assetId: "missing", sourceFileName: "clip.mp4", noteContent: "" });
      transaction.objectStore("items").put({ ...base, id: "trashed", type: "note", title: "Trashed note", content: "Keep in Trash", deletedAt: 2 });
      transaction.objectStore("collections").put({ id: "folder", name: "Folder", createdAt: 1, pinnedItemIds: [] });
      transaction.objectStore("tags").put({ id: "tag", name: "Research", createdAt: 1 });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
});

async function verifyAndCancel(page: Page, action: string) {
  const dialog = page.getByRole("dialog");
  const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
  const confirm = dialog.getByRole("button", { name: action, exact: true });
  await expect(cancel).toBeVisible();
  await expect(confirm).toBeVisible();
  const bounds = await dialog.evaluate((element, action) => {
    const buttons = Array.from(element.querySelectorAll("button"));
    return ["Cancel", action].map((label) => {
      const rect = buttons.find((button) => button.textContent?.trim() === label)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width };
    });
  }, action);
  expect(bounds[0].x + bounds[0].width).toBeLessThanOrEqual(bounds[1].x);
  expect(bounds[0].y).toBe(bounds[1].y);
  await expect(cancel).toBeInViewport();
  await expect(confirm).toBeInViewport();
  await cancel.focus();
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await cancel.click();
  await expect(dialog).toBeHidden();
}

test("cards, bulk actions, folders, tags, and Trash share the same confirmation order", async ({ page }, testInfo) => {
  const note = page.locator('[data-item-id="note"]');
  for (const layout of ["Grid", "List"]) {
    await page.getByRole("button", { name: `${layout} view` }).click();
    for (const entry of ["menu", "context"]) {
      if (entry === "context") await note.click({ button: "right" });
      else {
        await note.hover();
        await note.getByRole("button", { name: "Actions for Note", exact: true }).click();
      }
      await page.getByRole("menuitem", { name: "Move to Trash", exact: true }).click();
      await verifyAndCancel(page, "Move to Trash");
      await expect(note).toBeVisible();
    }
    await note.hover();
    await note.locator("[data-selection-indicator]").click();
    const bulk = page.getByRole("region", { name: "Bulk actions" });
    await bulk.getByRole("button", { name: "Move to Trash" }).click();
    await page.screenshot({ path: testInfo.outputPath(`bulk-trash-${layout.toLowerCase()}.png`) });
    await verifyAndCancel(page, "Move to Trash");
    await expect(bulk).toContainText("1 selected");
    await bulk.getByRole("button", { name: "Deselect all" }).click();
  }
  for (const [name, action] of [["Folder", "Delete collection"], ["Research", "Delete tag"]]) {
    await page.getByRole("button", { name: `${name} actions`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await verifyAndCancel(page, action);
    await expect(page.getByRole("button", { name: `${name} actions`, exact: true })).toBeAttached();
  }
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  const trashed = page.locator('[data-item-id="trashed"]');
  await trashed.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await verifyAndCancel(page, "Delete permanently");
  await trashed.hover();
  await trashed.locator("[data-selection-indicator]").click();
  const bulk = page.getByRole("region", { name: "Bulk actions" });
  await bulk.getByRole("button", { name: "Delete permanently" }).click();
  await verifyAndCancel(page, "Delete permanently");
  await bulk.getByRole("button", { name: "Deselect all" }).click();
  await page.getByRole("button", { name: "Empty Trash", exact: true }).click();
  await verifyAndCancel(page, "Empty Trash");
  await expect(trashed).toBeVisible();
});

test("all full item views use Cancel on the left on desktop and mobile", async ({ page }) => {
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const id of ["note", "link", "image", "video"]) {
      await page.goto(`/items/${id}?from=%2F`);
      await page.getByRole("button", { name: /Move (?:note|link|item) to Trash|^Move to Trash$/ }).click();
      await verifyAndCancel(page, "Move to Trash");
    }
  }
});
