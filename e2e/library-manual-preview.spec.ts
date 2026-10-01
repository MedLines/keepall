import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("manually enriches links from both card menus and searches the saved metadata", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let previewRequests = 0;
  let releasePreview!: () => void;
  const firstResponse = new Promise<void>(resolve => { releasePreview = resolve; });
  await page.route("**/api/preview", async route => {
    expect(route.request().postDataJSON()).toEqual({ url: "https://example.com/reference" });
    previewRequests += 1;
    if (previewRequests === 1) await firstResponse;
    await route.fulfill({ json: {
      title: "Layout handbook",
      description: previewRequests === 1 ? "A typography reference" : "A refreshed kerning reference",
      imageUrl: "https://example.com/cover.png",
    } });
  });
  await page.route("**/api/preview-image", route => route.fulfill({
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=", "base64"),
  }));
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
        const tx = db.transaction("items", "readwrite");
        tx.objectStore("items").put({
          id: "manual-link", type: "link", title: "Saved reference", url: "https://example.com/reference",
          noteContent: "My own note", noteFormat: "plain", collectionIds: [], tagIds: [], createdAt: 1, updatedAt: 1,
          previewStatus: "failed", previewRetry: "none", previewAttemptedAt: 1,
          previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  const card = page.locator('[data-item-id="manual-link"]');
  await expect(card).toBeVisible();
  expect(previewRequests).toBe(0);
  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Fetch preview", exact: true }).click();
  await expect.poll(() => previewRequests).toBe(1);
  await card.getByRole("button", { name: "Actions for Saved reference" }).click();
  await expect(page.getByRole("menuitem", { name: "Fetching preview…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  releasePreview();
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  await search.fill("typography");
  await expect(card.locator("mark").filter({ hasText: /^typography$/ }).first()).toBeVisible();
  await search.fill("handbook");
  await expect(card.locator("mark").filter({ hasText: /^handbook$/i }).first()).toBeVisible();
  await search.fill("");
  await card.getByRole("button", { name: "Actions for Saved reference" }).click();
  await expect(page.getByRole("menuitem", { name: "Refresh preview", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("manual-preview-menu.png") });
  await page.getByRole("menuitem", { name: "Refresh preview", exact: true }).click();
  await search.fill("kerning");
  await expect(card.locator("mark").filter({ hasText: /^kerning$/ }).first()).toBeVisible();
  expect(previewRequests).toBe(2);
  await expect(page).toHaveURL(/q=kerning/);
  await page.reload();
  await expect(card.locator("mark").filter({ hasText: /^kerning$/ }).first()).toBeVisible();
  await search.fill("My own note");
  await expect(card.locator("mark").filter({ hasText: /^own$/ }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
