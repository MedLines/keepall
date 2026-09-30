import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

async function storedGalleryHashes(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction(["items", "assets"], "readonly");
      const read = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const items = await read<{ type: string; assetIds?: string[] }[]>(tx.objectStore("items").getAll());
      const ids = items.find((item) => item.type === "image")?.assetIds ?? [];
      const assets = await Promise.all(ids.map((id) => read<{ contentHash: string }>(tx.objectStore("assets").get(id))));
      return assets.map((asset) => asset.contentHash);
    } finally {
      db.close();
    }
  });
}

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
      await dialog.locator('input[accept^="image/"]').setInputFiles([
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
      await expect(page.getByLabel("Library").getByRole("link", { name: "Open Atomic image capture" }))
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

test("gallery append rejects a later invalid file, survives reload, and retries in order", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Alt+k");
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[accept^="image/"]').setInputFiles("public/icons/icon-192.png");
  await page.getByLabel("Optional source URL or caption").fill("Append regression gallery");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: "Open Append regression gallery" }).click();
  await expect(page.getByRole("region", { name: "Image gallery" })).toBeVisible();
  expect(await storedRecordCounts(page)).toEqual([1, 1]);

  const input = page.getByLabel("Choose images to add");
  await input.setInputFiles([
    { name: "icon-512.png", mimeType: "image/png", buffer: readFileSync("public/icons/icon-512.png") },
    { name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) },
  ]);
  await expect(page.getByRole("alert").filter({ hasText: "No images were added." })).toBeVisible();
  expect(await storedRecordCounts(page)).toEqual([1, 1]);
  await page.reload();
  await expect(page.getByRole("region", { name: "Image gallery" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show image 2" })).toHaveCount(0);

  await page.getByLabel("Choose images to add").setInputFiles([
    "public/icons/icon-512.png",
    "public/icons/icon-maskable-512.png",
  ]);
  await expect(page.getByRole("button", { name: "Show image 3" })).toHaveAttribute("aria-current", "true");
  expect(await storedRecordCounts(page)).toEqual([1, 3]);
  const expectedHashes = ["icon-192.png", "icon-512.png", "icon-maskable-512.png"]
    .map((name) => createHash("sha256").update(readFileSync(`public/icons/${name}`)).digest("hex"));
  expect(await storedGalleryHashes(page)).toEqual(expectedHashes);
  await page.reload();
  await expect(page.getByRole("button", { name: "Show image 3" })).toBeVisible();
  expect(await storedRecordCounts(page)).toEqual([1, 3]);
  expect(await storedGalleryHashes(page)).toEqual(expectedHashes);
});
