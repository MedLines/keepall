import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("both imports stay available when the active library is empty and Trash has items", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import items", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import backup", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("items", "readwrite");
        tx.objectStore("items").put({ id: "trash-only", type: "note", title: "", content: "Deleted note",
          tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 2, deletedAt: 3 });
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("empty-with-trash-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  const closeNavigation = page.getByRole("button", { name: "Close navigation", exact: true });
  if (await closeNavigation.isVisible()) await closeNavigation.click();
  await expect(page.getByRole("button", { name: "Import items", exact: true })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Import backup", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("empty-with-trash-mobile.png") });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Import items", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Bulk import", exact: true })).toBeVisible();
  await page.getByRole("dialog", { name: "Bulk import", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Save to Keepall", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Import backup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Import backup", exact: true })).toBeVisible();
});
