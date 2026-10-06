import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pdfFixture } from "../test-support/pdf-fixture";

test.use({ serviceWorkers: "block" });

async function counts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("keepall");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const names = ["items", "assets", "documentAssets", "videoAssets", "thumbnails", "collections", "tags"];
    try {
      const tx = db.transaction(names, "readonly");
      return Object.fromEntries(await Promise.all(names.map((name) => new Promise<[string, number]>((resolve, reject) => {
        const request = tx.objectStore(name).count();
        request.onsuccess = () => resolve([name, request.result]);
        request.onerror = () => reject(request.error);
      }))));
    } finally { db.close(); }
  });
}
async function openCapture(page: Page) {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.keyboard.press("Alt+k");
  const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await expect(capture.getByRole("button", { name: "Add files", exact: true })).toBeEnabled();
  return capture;
}

for (const source of ["capture", "files", "folder"] as const) {
  for (const mode of ["gallery", "separate"] as const) {
    test(`${source} images stay in the drawer until Save, cancel cleanly, and save as ${mode}`, async ({ page }, testInfo) => {
      await page.addInitScript(() => Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: undefined }));
      const folder = testInfo.outputPath("Image folder");
      if (source === "folder") {
        await mkdir(folder, { recursive: true });
        for (const size of [192, 512]) await writeFile(join(folder, `${size}.png`), await readFile(`public/icons/icon-${size}.png`));
      }
      for (const cancel of [true, false]) {
        const capture = await openCapture(page);
        if (source !== "capture") await capture.getByRole("button", { name: "Bulk import", exact: true }).click();
        const parent = source === "capture" ? capture : page.getByRole("dialog", { name: "Bulk import", exact: true });
        const chooser = page.waitForEvent("filechooser");
        await parent.getByRole("button", { name: source === "folder" ? "Import folder" : source === "files" ? "Import files" : "Add files", exact: true }).click();
        await (await chooser).setFiles(source === "folder" ? folder : ["public/icons/icon-192.png", "public/icons/icon-512.png"]);
        await expect(capture.getByLabel("2 images attached")).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(1);
        await expect(capture.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
        await capture.getByRole("radio", { name: mode === "gallery" ? /One image item/ : /Separate image items/ }).check();
        if (mode === "separate") await expect(capture.getByRole("radio", { name: /Separate image items/ })).toBeChecked();
        else await expect(capture.getByRole("textbox", { name: "Optional source URL or caption", exact: true })).toBeVisible();
        await capture.getByRole("button", { name: "Unsorted", exact: true }).click();
        await capture.getByRole("textbox", { name: "Collection", exact: true }).fill("Chosen images");
        await capture.getByRole("textbox", { name: "Tags", exact: true }).fill("Reference");
        expect(Object.values(await counts(page))).toEqual([0, 0, 0, 0, 0, 0, 0]);
        await expect(capture.getByRole("button", { name: "Add files", exact: true })).toBeEnabled();
        await capture.screenshot({ path: testInfo.outputPath(`drawer-${cancel ? "cancel" : "save"}.png`) });
        await capture.getByRole("button", { name: cancel ? "Cancel" : "Save", exact: true }).click();
        await expect(capture).toBeHidden();
        if (cancel) {
          expect(Object.values(await counts(page))).toEqual([0, 0, 0, 0, 0, 0, 0]);
          continue;
        }
        expect(await counts(page)).toMatchObject({ items: mode === "gallery" ? 1 : 2, assets: 2, collections: 1, tags: 1 });
        expect(await page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve) => { const r = indexedDB.open("keepall"); r.onsuccess = () => resolve(r.result); });
          try { return await new Promise<boolean>((resolve) => { const r = db.transaction("items").objectStore("items").getAll(); r.onsuccess = () => resolve(r.result.every((item) => item.tagIds.length === 1 && item.collectionIds.length === 1)); }); }
          finally { db.close(); }
        })).toBe(true);
        await page.reload();
        await expect(page.locator("[data-item-id]")).toHaveCount(mode === "gallery" ? 1 : 2);
      }
    });
  }
}

for (const source of ["capture", "files", "folder"] as const) {
  test(`${source} mixed files stay separate and Cancel leaves no stored files or organization`, async ({ page }, testInfo) => {
    await page.addInitScript(() => Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: undefined }));
    const files = [
      { name: "image.png", mimeType: "image/png", buffer: await readFile("public/icons/icon-192.png") },
      { name: "first.md", mimeType: "", buffer: Buffer.from("# First file") },
      { name: "second.txt", mimeType: "", buffer: Buffer.from("Second file") },
      { name: "reference.pdf", mimeType: "", buffer: Buffer.from(pdfFixture(["PDF reference text"])) },
    ];
    const folder = testInfo.outputPath("Mixed folder");
    if (source === "folder") { await mkdir(folder, { recursive: true }); for (const file of files) await writeFile(join(folder, file.name), file.buffer); }
    for (const cancel of [true, false]) {
      const capture = await openCapture(page);
      if (source !== "capture") await capture.getByRole("button", { name: "Bulk import", exact: true }).click();
      const parent = source === "capture" ? capture : page.getByRole("dialog", { name: "Bulk import", exact: true });
      const chooser = page.waitForEvent("filechooser");
      await parent.getByRole("button", { name: source === "capture" ? "Add files" : source === "folder" ? "Import folder" : "Import files", exact: true }).click();
      await (await chooser).setFiles(source === "folder" ? folder : files);
      await expect(capture.getByRole("region", { name: "Selected files" })).toContainText("4 files · Separate items");
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(capture.getByRole("radio")).toHaveCount(0);
      await capture.getByRole("button", { name: "Unsorted", exact: true }).click();
      await capture.getByRole("textbox", { name: "Collection", exact: true }).fill("Mixed files");
      await capture.getByRole("textbox", { name: "Tags", exact: true }).fill("Reference");
      await capture.getByRole("button", { name: cancel ? "Cancel" : "Save", exact: true }).click();
      await expect(capture).toBeHidden();
      if (cancel) { expect(Object.values(await counts(page))).toEqual([0, 0, 0, 0, 0, 0, 0]); continue; }
      expect(await counts(page)).toMatchObject({ items: 4, assets: 1, documentAssets: 3, collections: 1, tags: 1 });
      await page.reload();
      await expect(page.locator("[data-item-id]")).toHaveCount(4);
      await page.getByRole("link", { name: "Open first", exact: true }).click();
      await expect(page.getByRole("heading", { name: "First file", exact: true })).toBeVisible();
    }
  });
}

for (const width of [320, 1024]) {
  test(`image choices and caption keep their space at ${width}px with searchable filing and reduced motion`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
    if (width < 768) await page.getByRole("button", { name: "Close navigation", exact: true }).click();
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => { const r = indexedDB.open("keepall"); r.onsuccess = () => resolve(r.result); });
      const tx = db.transaction(["collections", "tags"], "readwrite");
      tx.objectStore("collections").put({ id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: [] });
      tx.objectStore("tags").put({ id: "reference", name: "Reference", createdAt: 1 });
      await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); }); db.close();
    });
    await page.reload();
    await page.keyboard.press("Alt+k");
    const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
    await capture.locator('input[data-capture-files]').setInputFiles(["public/icons/icon-192.png", "public/icons/icon-512.png"]);
    await expect(capture.getByLabel("2 images attached")).toBeVisible();
    await capture.getByRole("radio", { name: /Separate image items/ }).check();
    await capture.getByRole("textbox", { name: "Collection", exact: true }).fill("Read");
    await capture.getByRole("button", { name: "Reading", exact: true }).click();
    await capture.getByRole("textbox", { name: "Tags", exact: true }).fill("Ref");
    await capture.getByRole("button", { name: "Reference", exact: true }).click();
    const geometry = () => capture.evaluate((drawer) => {
      const selectors = ['[data-testid="capture-image-layout-slot"]', 'input[data-capture-files]', 'input[placeholder*="collection"]', 'input[placeholder*="tag"]'];
      return selectors.map((selector) => { const r = drawer.querySelector(selector)!.getBoundingClientRect(); return [r.x, r.y + drawer.querySelector('[data-testid="capture-scroll-region"]')!.scrollTop, r.width, r.height]; });
    });
    const before = await geometry();
    expect(await capture.getByTestId("capture-image-layout-slot").locator('[aria-hidden="false"]').evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("opacity, transform");
    await capture.getByRole("radio", { name: /One image item/ }).check();
    const caption = capture.getByRole("textbox", { name: "Optional source URL or caption", exact: true });
    await expect(caption).toBeFocused();
    await caption.fill("Keep this caption");
    expect(await geometry()).toEqual(before);
    await expect(capture.getByRole("radio")).toHaveCount(0);
    await capture.getByRole("button", { name: "Change image layout", exact: true }).click();
    await expect(capture.getByRole("radio", { name: /One image item/ })).toBeFocused();
    expect(await geometry()).toEqual(before);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await capture.getByRole("radio", { name: /One image item/ }).check();
    await expect(caption).toHaveValue("Keep this caption");
    expect(await geometry()).toEqual(before);
    expect(await capture.getByTestId("capture-image-layout-slot").locator('[aria-hidden="false"]').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s, 0s");
    await expect(capture.getByRole("button", { name: "Reading", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(capture.getByRole("button", { name: "Remove tag Reference", exact: true })).toBeEnabled();
    await capture.screenshot({ path: testInfo.outputPath("caption-reserved-space.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await counts(page)).toMatchObject({ items: 0, assets: 0, thumbnails: 0 });
  });
}
