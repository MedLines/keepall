import { expect, test, type Page } from "@playwright/test";

async function storedRecordCounts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction(["items", "assets"], "readonly");
      return await Promise.all(
        ["items", "assets"].map(
          (name) => new Promise<number>((resolve, reject) => {
            const request = tx.objectStore(name).count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          }),
        ),
      );
    } finally {
      db.close();
    }
  });
}

for (const failFirstSave of [false, true]) {
  test(
    failFirstSave
      ? "failed image save rolls back bytes and allows retry"
      : "saving an image gallery survives reload",
    async ({ page }, testInfo) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      if (failFirstSave) {
        // Inject one storage failure only in this test's isolated browser context.
        await page.addInitScript(() => {
          const originalAdd = IDBObjectStore.prototype.add;
          let failNextImage = true;
          IDBObjectStore.prototype.add = function (value, key) {
            if (this.name === "items" && value?.type === "image" && failNextImage) {
              failNextImage = false;
              throw new DOMException("Simulated storage failure", "QuotaExceededError");
            }
            return originalAdd.call(this, value, key);
          };
        });
      }

      await page.goto("/");
      await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
      await page.keyboard.press("Alt+k");
      const dialog = page.getByRole("dialog");
      await dialog.locator('input[type="file"]').setInputFiles([
        "public/icons/icon-192.png",
        "public/icons/icon-512.png",
      ]);
      await page.getByLabel("Optional source URL or caption").fill("Atomic image capture");
      await dialog.getByRole("button", { name: "Save", exact: true }).click();

      if (failFirstSave) {
        await expect(dialog.getByText("Couldn't save. Try again.")).toBeVisible();
        expect(await storedRecordCounts(page)).toEqual([0, 0]);
        await expect(page.getByLabel("Optional source URL or caption"))
          .toHaveValue("Atomic image capture");
        await dialog.getByRole("button", { name: "Save", exact: true }).click();
      }

      await expect(dialog).toBeHidden();
      expect(await storedRecordCounts(page)).toEqual([1, 2]);
      await page.reload();
      await expect(page.getByLabel("Library").locator("button")
        .filter({ hasText: /^Atomic image capture$/ }))
        .toBeVisible();
      expect(await storedRecordCounts(page)).toEqual([1, 2]);
      await expect.poll(() => page.getByLabel("Library").locator("img").first()
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
        .toBe(true);
      expect(pageErrors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("image-capture.png") });
    },
  );
}
