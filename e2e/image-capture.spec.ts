import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

test("drawer image controls remove individual photos and clear all attachments", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await page.keyboard.press("Alt+k");
  const drawer = page.getByRole("dialog", { name: "Save to Keepall" });
  const files = ["icon-192.png", "icon-512.png", "icon-maskable-512.png"];
  const input = drawer.locator('input[accept^="image/"]');
  await input.setInputFiles(files.map((name) => `public/icons/${name}`));
  await drawer.getByLabel("Optional source URL or caption").fill("Gallery controls");
  const images = drawer.getByRole("list", { name: "3 images attached" });
  const removeAll = drawer.getByRole("button", { name: "Remove all images" });

  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(images).toBeVisible();
    const imageBox = (await images.boundingBox())!;
    const removeBox = (await removeAll.boundingBox())!;
    expect(removeBox.y).toBeGreaterThanOrEqual(imageBox.y + imageBox.height);
    for (let index = 0; index < 3; index++) {
      const thumbnail = (await images.locator("img").nth(index).boundingBox())!;
      const cross = (await drawer.getByRole("button", { name: `Remove image ${index + 1}` }).boundingBox())!;
      expect(cross.x).toBeGreaterThan(thumbnail.x + thumbnail.width / 2);
      expect(cross.y).toBeLessThan(thumbnail.y + thumbnail.height / 2);
    }
    const bulkButton = drawer.getByRole("button", { name: "Bulk import" });
    await expect(drawer.getByRole("button", { name: "Import image folder" })).toHaveCount(0);
    const bulkBox = (await bulkButton.boundingBox())!;
    const cancelBox = (await drawer.getByRole("button", { name: "Cancel", exact: true }).boundingBox())!;
    expect(bulkBox.x + bulkBox.width).toBeLessThanOrEqual(cancelBox.x);
    expect(bulkBox.y).toBeCloseTo(cancelBox.y, 0);
    await page.screenshot({ path: testInfo.outputPath(`drawer-images-${width}.png`) });
    await bulkButton.click();
    const bulk = page.getByRole("dialog", { name: "Bulk import", exact: true });
    await expect(bulk.getByRole("button", { name: "Import image folder" })).toBeVisible();
    await expect(bulk.getByRole("button", { name: "Import bookmarks HTML" })).toBeVisible();
    const bulkModalBox = (await bulk.boundingBox())!;
    expect(bulkModalBox.x + bulkModalBox.width / 2).toBeCloseTo(width / 2, 0);
    await page.screenshot({ path: testInfo.outputPath(`bulk-import-${width}.png`) });
    await bulk.getByRole("button", { name: "Done", exact: true }).click();
    await expect(bulk).toBeHidden();
  }

  await removeAll.click();
  await expect(drawer.getByRole("list", { name: /images? attached/ })).toHaveCount(0);
  await expect(drawer.getByLabel("Link, note, or image")).toHaveValue("Gallery controls");
  await input.setInputFiles(files.map((name) => `public/icons/${name}`));
  const removeSecond = drawer.getByRole("button", { name: "Remove image 2" });
  await removeSecond.focus();
  await page.keyboard.press("Enter");
  await expect(drawer.getByRole("list", { name: "2 images attached" })).toBeVisible();
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(drawer).toBeHidden();
  expect(await storedRecordCounts(page)).toEqual([1, 2]);
  const expectedHashes = [files[0], files[2]].map((name) =>
    createHash("sha256").update(readFileSync(`public/icons/${name}`)).digest("hex"));
  expect(await storedGalleryHashes(page)).toEqual(expectedHashes);
  await page.reload();
  expect(await storedGalleryHashes(page)).toEqual(expectedHashes);
  expect(pageErrors).toEqual([]);
});

for (const width of [320, 1024]) {
  const entry = "drawer";
  test(`image folder import from ${entry} at ${width}px saves separate items and reports skipped files`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(window, "showDirectoryPicker", { value: undefined, configurable: true });
      const readBytes = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = async function () {
        await new Promise((resolve) => setTimeout(resolve, 650));
        return readBytes.call(this);
      };
    });
    const folder = testInfo.outputPath("Holiday");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "first.png"), readFileSync("public/icons/icon-192.png"));
    writeFileSync(join(folder, "second.png"), readFileSync("public/icons/icon-512.png"));
    writeFileSync(join(folder, "readme.txt"), "Skip this text file");
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/");
    if (width < 768) {
      const navigation = page.getByRole("dialog", { name: "Sidebar navigation", exact: true });
      await expect(navigation).toBeVisible();
      await navigation.getByRole("button", { name: "Close navigation", exact: true }).click();
      await expect(navigation).toBeHidden();
    }
    await page.keyboard.press("Alt+k");
    await page.getByLabel("Link, note, or image").fill("Unfinished note");
    await page.getByRole("button", { name: "Bulk import", exact: true }).click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import image folder", exact: true }).click();
    await (await chooser).setFiles(folder);
    const review = page.getByRole("dialog", { name: "Import image folder" });
    await expect(review.getByLabel("Collection (optional)")).toHaveValue("Holiday");
    await review.getByLabel("Collection (optional)").fill("Imported photos");
    await review.getByRole("button", { name: "Import images", exact: true }).click();
    const importing = page.getByRole("dialog", { name: "Importing images", exact: true });
    await expect(importing).toBeVisible();
    await expect(importing.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "3");
    await expect(importing.getByRole("button", { name: "Close", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(importing).toBeVisible();
    await importing.screenshot({ path: testInfo.outputPath(`image-import-progress-${entry}.png`) });
    const complete = page.getByRole("dialog", { name: "Import complete", exact: true });
    await expect(complete).toBeVisible();
    await expect(complete.getByRole("status")).toContainText("Images: 2 added, 1 skipped.");
    await expect(complete.getByRole("status")).toContainText("Skipped: 1 unsupported type.");
    await expect(complete.getByRole("button", { name: "Open folder", exact: true })).toBeEnabled();
    const completionIcon = complete.locator(".rounded-panel > span").filter({
      has: page.locator('path[d="M8 12.5L10.5 15L16 9"]'),
    });
    await expect(completionIcon).toHaveCSS("opacity", "1");
    await complete.screenshot({ path: testInfo.outputPath(`image-import-complete-${entry}.png`) });
    expect(await storedRecordCounts(page)).toEqual([2, 2]);
    await complete.getByRole("button", { name: "Open folder", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Discard unsaved changes?" });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(page).not.toHaveURL(/collection=/);
    await expect(page.getByLabel("Link, note, or image")).toHaveValue("Unfinished note");
    await page.getByRole("button", { name: "Bulk import", exact: true }).click();
    await page.getByRole("dialog", { name: "Bulk import", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByLabel("Link, note, or image")).toHaveValue("Unfinished note");
    await page.getByRole("dialog", { name: "Save to Keepall" }).getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto("/");
    if (width < 768) {
      await page.locator('button[aria-controls="library-sidebar"]').click();
      await expect(page.getByRole("dialog", { name: "Sidebar navigation", exact: true })).toBeVisible();
    }
    await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Imported photos", exact: true }).click();
    await expect(page).toHaveURL(/collection=/);
    await expect(page.getByRole("main", { name: "Imported photos" }).getByRole("link", { name: "Open Image", exact: true })).toHaveCount(2);
    await page.reload();
    expect(await storedRecordCounts(page)).toEqual([2, 2]);
    await expect(page.getByRole("main", { name: "Imported photos" }).getByRole("link", { name: "Open Image", exact: true })).toHaveCount(2);
    expect(pageErrors).toEqual([]);
  });
}

for (const width of [320, 1024]) {
  const entry = "drawer";
  test(`bookmark file import from ${entry} at ${width}px preserves the draft and survives reload`, async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width < 768) {
      const navigation = page.getByRole("dialog", { name: "Sidebar navigation", exact: true });
      await expect(navigation).toBeVisible();
      await navigation.getByRole("button", { name: "Close navigation", exact: true }).click();
      await expect(navigation).toBeHidden();
    }
    await page.keyboard.press("Alt+k");
    await page.getByLabel("Link, note, or image").fill("Unfinished note");
    await page.getByRole("button", { name: "Bulk import", exact: true }).click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import bookmarks HTML", exact: true }).click();
    await (await chooser).setFiles({
      name: "bookmarks.html",
      mimeType: "text/html",
      buffer: Buffer.from('<!DOCTYPE NETSCAPE-Bookmark-file-1><TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p><DT><A HREF="https://example.com/article">Example bookmark</A></DL><p>'),
    });
    const review = page.getByRole("dialog", { name: "Import browser bookmarks" });
    await expect(review.getByRole("radio", { name: /Browser folder → Unsorted only/ })).toBeChecked();
    const radii = await review.locator(".bookmark-import-option").evaluateAll((rows) => rows.map((row) => getComputedStyle(row).borderTopLeftRadius));
    expect(radii).toEqual(["10px", "10px", "10px"]);
    await review.screenshot({ path: testInfo.outputPath(`bookmark-import-options-${entry}.png`) });
    await review.getByRole("button", { name: "Import bookmarks", exact: true }).click();
    await expect(review).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Bookmarks: 1 added, 0 merged, 0 skipped." })).toBeVisible();
    expect(await storedRecordCounts(page)).toEqual([1, 0]);
    await page.getByRole("dialog", { name: "Bulk import", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByLabel("Link, note, or image")).toHaveValue("Unfinished note");
    await page.getByRole("dialog", { name: "Save to Keepall" }).getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto("/");
    const bookmark = page.getByRole("heading", { name: "Example bookmark", level: 2 }).getByRole("link");
    await expect(bookmark).toHaveAttribute("href", "https://example.com/article");
    await page.reload();
    await expect(bookmark).toHaveAttribute("href", "https://example.com/article");
    expect(pageErrors).toEqual([]);
  });
}

test("Open folder from an empty drawer closes the import dialogs and shows its images", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", { value: undefined, configurable: true });
  });
  const folder = testInfo.outputPath("New photos");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "first.png"), readFileSync("public/icons/icon-192.png"));
  await page.goto("/");
  await page.keyboard.press("Alt+k");
  await expect(page.getByLabel("Link, note, or image")).toBeEnabled();
  await page.getByRole("button", { name: "Bulk import", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import image folder", exact: true }).click();
  await (await chooser).setFiles(folder);
  await page.getByRole("dialog", { name: "Import image folder" }).getByRole("button", { name: "Import images", exact: true }).click();
  await page.getByRole("dialog", { name: "Import complete" }).getByRole("button", { name: "Open folder", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/collection=/);
  await expect(page.getByRole("main", { name: "New photos" }).getByRole("link", { name: "Open Image", exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("main", { name: "New photos" }).getByRole("link", { name: "Open Image", exact: true })).toHaveCount(1);
});

test("read-only folder import scans nested files without triggering the upload chooser", async ({ page }, testInfo) => {
  const pngs = ["icon-192.png", "icon-512.png"].map((name) => readFileSync(`public/icons/${name}`).toString("base64"));
  await page.addInitScript((images) => {
    const pickerWindow = window as unknown as {
      showDirectoryPicker: (options: { mode: string; id: string }) => Promise<unknown>;
      keepallPickerOptions?: { mode: string; id: string };
    };
    const files = images.map((base64, index) => new File([
      Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)),
    ], `photo-${index}.png`, { type: "image/png" }));
    const fileEntry = (file: File) => ({
      kind: "file", name: file.name,
      async getFile() {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return file;
      },
    });
    pickerWindow.showDirectoryPicker = async (options) => {
      pickerWindow.keepallPickerOptions = options;
      return {
        kind: "directory", name: "Read-only photos",
        async *values() {
          yield fileEntry(files[0]);
          yield {
            kind: "directory", name: "Nested",
            async *values() { yield fileEntry(files[1]); },
          };
          yield fileEntry(new File(["Skip this file"], "readme.txt", { type: "text/plain" }));
        },
      };
    };
  }, pngs);
  let uploadChooserOpened = false;
  page.on("filechooser", () => { uploadChooserOpened = true; });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.keyboard.press("Alt+k");
  await page.getByRole("button", { name: "Bulk import", exact: true }).click();
  await page.getByRole("button", { name: "Import image folder", exact: true }).click();
  const reading = page.getByRole("dialog", { name: "Reading image folder", exact: true });
  await expect(reading).toBeVisible();
  await expect(reading.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  await expect(reading.getByRole("button", { name: "Close", exact: true })).toBeDisabled();
  await reading.screenshot({ path: testInfo.outputPath("image-folder-scanning.png") });
  const review = page.getByRole("dialog", { name: "Import image folder", exact: true });
  await expect(review.getByLabel("Collection (optional)")).toHaveValue("Read-only photos");
  await expect(review).toContainText("3 files selected");
  expect(uploadChooserOpened).toBe(false);
  expect(await page.evaluate(() => (window as unknown as { keepallPickerOptions: unknown }).keepallPickerOptions)).toEqual({ mode: "read", id: "keepall-image-folder" });
  await review.getByRole("button", { name: "Import images", exact: true }).click();
  const complete = page.getByRole("dialog", { name: "Import complete", exact: true });
  await expect(complete.getByRole("status")).toContainText("Images: 2 added, 1 skipped.");
  await complete.getByRole("button", { name: "Open folder", exact: true }).click();
  await expect(page).toHaveURL(/collection=/);
  await expect(page.getByRole("main", { name: "Read-only photos" }).getByRole("link", { name: "Open Image", exact: true })).toHaveCount(2);
  expect(errors).toEqual([]);
});
