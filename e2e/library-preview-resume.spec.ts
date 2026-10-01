import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("enriches old links automatically after opening their folder without a reload", async ({ page }) => {
  let previewRequests = 0;
  await page.route("**/api/preview", async route => {
    previewRequests += 1;
    expect(route.request().postDataJSON()).toEqual({ url: "https://example.com/reference" });
    await route.fulfill({ json: { title: "Fetched title", description: "Fetched description", imageUrl: "" } });
  });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["items", "collections"], "readwrite");
        for (const [id, name] of [["empty", "Empty folder"], ["old", "Old folder"]]) {
          tx.objectStore("collections").put({ id, name, createdAt: 1, pinnedItemIds: [] });
        }
        tx.objectStore("items").put({
          id: "old-link", type: "link", title: "Imported link", url: "https://example.com/reference",
          noteContent: "", noteFormat: "plain", collectionIds: ["old"], tagIds: [], createdAt: 1, updatedAt: 1,
          previewStatus: "idle", previewRetry: null, previewAttemptedAt: null,
          previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.goto("/?collection=empty");
  await expect(page.getByRole("heading", { name: "Empty folder", exact: true })).toBeVisible();
  expect(previewRequests).toBe(0);
  await page.getByRole("button", { name: "Old folder", exact: true }).click();
  const card = page.locator('[data-item-id="old-link"]');
  await expect(card).toBeVisible();
  expect(previewRequests).toBe(0);
  await expect(card).toContainText("Fetched description", { timeout: 10_000 });
  expect(previewRequests).toBe(1);
});
