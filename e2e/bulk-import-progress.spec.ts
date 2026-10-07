import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function holdWrites(page: Page) {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      const tx = original.apply(this, args);
      const gate = window as typeof window & { holdFileWrites?: boolean; writesBeforeHold?: number };
      if (gate.holdFileWrites && tx.mode === "readwrite" && tx.objectStoreNames.contains("items")) {
        if ((gate.writesBeforeHold ?? 0) > 0) gate.writesBeforeHold! -= 1;
        else {
          const keepAlive = () => {
            if (!gate.holdFileWrites) return;
            tx.objectStore("items").count().onsuccess = keepAlive;
          };
          keepAlive();
        }
      }
      return tx;
    };
  });
}

async function storedItems(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("keepall");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      return await new Promise<number>((resolve, reject) => {
        const request = db.transaction("items").objectStore("items").count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
}

test("Bulk import is immediately available during a pending clipboard read", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      read: () => new Promise<ClipboardItem[]>(() => {}),
    } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  await page.keyboard.press("Alt+k");
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await expect(drawer.getByRole("button", { name: "Bulk import", exact: true })).toBeEnabled();
  await drawer.getByRole("button", { name: "Bulk import", exact: true }).click();
  const bulk = page.getByRole("dialog", { name: "Bulk import", exact: true });
  await expect(bulk.getByRole("button", { name: "Import files", exact: true })).toBeEnabled();
  await bulk.getByRole("button", { name: "Done", exact: true }).click();
  await expect(drawer.getByRole("textbox", { name: "Link, note, or image", exact: true })).toBeEnabled();
});

test("large batches show committed counts and failures, stay open, and retry without duplicates", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await holdWrites(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await page.getByRole("button", { name: "Import items", exact: true }).click();
  const bulk = page.getByRole("dialog", { name: "Bulk import", exact: true });
  const files = Array.from({ length: 25 }, (_, index) => ({ name: `note-${index}.txt`, mimeType: "text/plain", buffer: Buffer.from(`Note ${index}`) }));
  files.splice(1, 0, { name: "unsupported.html", mimeType: "text/html", buffer: Buffer.from("Unsupported") });
  await bulk.locator('input[data-bulk-files]').setInputFiles(files);
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await expect(drawer.getByRole("region", { name: "Selected files" })).toContainText("26 files");
  await page.evaluate(() => {
    Object.assign(window, { holdFileWrites: true, writesBeforeHold: 1 });
  });
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Importing files", exact: true });
  await expect(progress).toContainText("Saving files");
  await expect(progress).toContainText("note-1.txt");
  await expect(progress).toContainText("2 of 26 files processed");
  await expect(progress).toContainText("1 saved · 1 failed");
  await expect(progress.getByRole("progressbar")).toHaveAttribute("value", "2");
  await expect(progress.getByRole("progressbar")).toHaveAttribute("max", "26");
  await expect(progress.getByRole("button", { name: "Close", exact: true })).toBeDisabled();
  await page.mouse.click(8, 8);
  await page.keyboard.press("Escape");
  await expect(progress).toBeVisible();
  await expect(progress).toHaveCSS("opacity", "1");
  expect(await progress.evaluate((dialog) => {
    const bounds = dialog.getBoundingClientRect();
    return dialog.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
  })).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("bulk-progress-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(progress.getByRole("progressbar")).toBeInViewport();
  await page.mouse.click(8, 8);
  await page.keyboard.press("Escape");
  await expect(progress).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("bulk-progress-mobile.png") });
  await page.evaluate(() => Object.assign(window, { holdFileWrites: false }));
  await expect(progress).toBeHidden();
  await expect(drawer.getByRole("alert")).toContainText("25 saved, 1 failed");
  expect(await storedItems(page)).toBe(25);
  await drawer.getByRole("button", { name: "Retry failed files", exact: true }).click();
  await expect(drawer.getByRole("button", { name: "Retry failed files", exact: true })).toBeEnabled();
  expect(await storedItems(page)).toBe(25);
  await page.reload();
  expect(await storedItems(page)).toBe(25);
  expect(errors).toEqual([]);
});

test("gallery saves show activity until the atomic write commits", async ({ page }, testInfo) => {
  await holdWrites(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Import items", exact: true }).click();
  await page.getByRole("dialog", { name: "Bulk import", exact: true }).locator('input[data-bulk-files]')
    .setInputFiles(["public/icons/icon-192.png", "public/icons/icon-512.png"]);
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await expect(drawer.getByLabel("2 images attached")).toBeVisible();
  await drawer.getByRole("radio", { name: /One image item/ }).check();
  await page.evaluate(() => Object.assign(window, { holdFileWrites: true }));
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  const progress = page.getByRole("dialog", { name: "Importing files", exact: true });
  await expect(progress).toContainText("Saving gallery");
  await expect(progress).toContainText("2 images in this gallery");
  await expect(progress.getByRole("progressbar")).not.toHaveAttribute("value");
  await page.keyboard.press("Escape");
  await expect(progress).toBeVisible();
  await expect(progress).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("gallery-progress.png") });
  await page.evaluate(() => Object.assign(window, { holdFileWrites: false }));
  await expect(progress).toBeHidden();
  await expect(drawer).toBeHidden();
  expect(await storedItems(page)).toBe(1);
  await page.reload();
  expect(await storedItems(page)).toBe(1);
});
