import { expect, test } from "@playwright/test";

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
      const tx = db.transaction(["items", "collections"], "readwrite");
      tx.objectStore("collections").put({ id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: [] });
      for (let index = 0; index < 90; index++) {
        const title = `Batch ${String(index).padStart(3, "0")}`;
        tx.objectStore("items").put({ id: `note-${index}`, type: "note", title,
          content: `Body for ${title}.\n${"A note with useful context. ".repeat(index % 5 + 1)}`,
          createdAt: 1000 - index, updatedAt: 1, tagIds: [], collectionIds: index < 78 ? ["reading"] : [],
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
});

for (const layout of ["grid", "list"]) {
  test(`${layout}: filtered keyboard selection, continuous preview, and virtualized focus`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/?layout=${layout}&collection=reading&q=Batch`);
    const card = (index: number) => page.locator(`[data-item-id="note-${index}"]`);
    await expect(card(0)).toBeVisible();
    await card(0).focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect(card(1)).toBeFocused();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText("2 selected");
    await page.keyboard.press("Shift+ArrowRight");
    await expect(card(2)).toBeFocused();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText("3 selected");
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(card(1)).toBeFocused();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText("2 selected");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Bulk actions" })).toHaveCount(0);
    await page.keyboard.press("Space");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName("Batch 001");
    await expect(dialog).toBeFocused();
    const initialScroll = await page.locator("main[aria-labelledby='library-heading']").evaluate(node => node.scrollTop);
    for (let index = 2; index <= 35; index++) {
      await page.keyboard.press("ArrowRight");
      await expect(dialog).toHaveAccessibleName(`Batch ${String(index).padStart(3, "0")}`);
    }
    await expect(dialog).toHaveCount(1);
    expect(await page.locator("main[aria-labelledby='library-heading']").evaluate(node => node.scrollTop)).toBe(initialScroll);
    await page.screenshot({ path: testInfo.outputPath(`${layout}-continuous-preview.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(card(35)).toBeFocused();
    await expect(card(35)).toBeInViewport();
    for (let index = 36; index <= 77; index++) {
      await page.keyboard.press("ArrowDown");
      await expect(card(index)).toBeFocused();
    }
    await expect(card(77)).toBeInViewport();
    await page.keyboard.press("ArrowRight");
    await expect(card(77)).toBeFocused();
    expect(await page.locator("[data-item-id]").count()).toBeLessThan(78);
    await page.keyboard.press("Space");
    await expect(dialog).toHaveAccessibleName("Batch 077");
    await expect(dialog.getByRole("button", { name: "Next item" })).toBeDisabled();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/items\/note-77\?from=/);
    expect(new URL(page.url()).searchParams.get("from")).toContain("collection=reading");
    expect(new URL(page.url()).searchParams.get("from")).toContain("q=Batch");
    expect(errors).toEqual([]);
  });
}

test("search, nested actions, and editing keep their normal keyboard behavior", async ({ page }) => {
  await page.goto("/?layout=list");
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  await search.fill("Batch 000");
  await search.press("ArrowLeft");
  await search.press("Space");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await search.fill("Batch 000");
  const checkbox = page.getByRole("checkbox", { name: "Select Batch 000", exact: true });
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const actions = page.getByRole("button", { name: "Actions for Batch 000" });
  await actions.click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const field = dialog.getByRole("textbox").first();
  await field.focus();
  await page.keyboard.press("ArrowRight");
  await expect(field).toBeFocused();
  await expect(dialog).not.toContainText("Quick preview");
});

test("preview adapts to mobile width and respects reduced motion", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?layout=list&q=Batch%20000");
  const sidebar = page.getByRole("dialog", { name: "Sidebar navigation" });
  if (await sidebar.isVisible()) await page.keyboard.press("Escape");
  await page.locator('[data-item-id="note-0"]').focus();
  await page.keyboard.press("Space");
  const dialog = page.getByRole("dialog", { name: "Batch 000" });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile-quick-preview.png") });
  await dialog.getByRole("button", { name: "Close preview" }).click();
  await expect(page.locator('[data-item-id="note-0"]')).toBeFocused();
});

test("gallery controls stay separate from item navigation and Markdown remains readable", async ({ page }, testInfo) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 420;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#9cb7a4"; context.fillRect(0, 0, 600, 420);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "assets"], "readwrite");
      for (const id of ["gallery-a", "gallery-b"]) tx.objectStore("assets").put({ id, bytes, mimeType: "image/png", byteLength: bytes.length, contentHash: id, createdAt: 1 });
      const common = { updatedAt: 1, tagIds: [], collectionIds: [] };
      tx.objectStore("items").put({ ...common, id: "gallery", type: "image", title: "Gallery reference", assetIds: ["gallery-a", "gallery-b"], caption: "## Saved context\nA **formatted** caption.", captionFormat: "markdown", sourceUrl: "", createdAt: 3000 });
      tx.objectStore("items").put({ ...common, id: "gallery-note", type: "note", title: "Gallery note", content: "## Useful heading\nA **readable** note.", format: "markdown", createdAt: 2000 });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto("/?q=Gallery");
  await page.locator('[data-item-id="gallery"]').focus();
  await page.keyboard.press("Space");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Gallery reference");
  await expect(dialog.locator("img")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Saved context" })).toBeVisible();
  await dialog.getByRole("button", { name: "Next gallery image" }).click();
  await expect(dialog).toContainText("Image 2 of 2");
  await page.keyboard.press("ArrowRight");
  await expect(dialog).toHaveAccessibleName("Gallery note");
  await expect(dialog.getByRole("heading", { name: "Useful heading" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog).toHaveAccessibleName("Gallery reference");
  await expect(dialog).toContainText("Image 1 of 2");
  await page.screenshot({ path: testInfo.outputPath("image-quick-preview.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-item-id="gallery"]')).toBeFocused();
});

for (const layout of ["grid", "list"]) {
  test(`${layout}: toolbar, right-click, and action-menu preview share current collection results`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/?layout=${layout}&collection=reading&q=Batch`);
    const preview = page.getByRole("button", { name: "Preview", exact: true });
    await expect(preview).toBeEnabled();
    await preview.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName("Batch 000");
    await expect(dialog).toBeFocused();
    await dialog.getByRole("button", { name: "Next item" }).click();
    await expect(dialog).toHaveAccessibleName("Batch 001");
    await expect(dialog.getByRole("status")).toContainText("2 of 78");
    await dialog.getByRole("button", { name: "Close preview" }).click();
    await expect(page.locator('[data-item-id="note-1"]')).toBeFocused();
    await preview.click();
    await expect(dialog).toHaveAccessibleName("Batch 001");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    const fourth = page.locator('[data-item-id="note-4"]');
    await fourth.click({ button: "right", position: { x: 20, y: 20 } });
    await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
    await expect(dialog).toHaveAccessibleName("Batch 004");
    await expect(dialog).toBeFocused();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toHaveAccessibleName("Batch 005");
    await dialog.getByRole("button", { name: "Close preview" }).click();
    const fifth = page.locator('[data-item-id="note-5"]');
    await expect(fifth).toBeFocused();
    await fifth.getByRole("button", { name: "Actions for Batch 005" }).click();
    await page.getByRole("menuitem", { name: "Preview", exact: true }).click();
    await expect(dialog).toHaveAccessibleName("Batch 005");
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(fifth).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`${layout}-preview-toolbar.png`) });
    expect(errors).toEqual([]);
  });
}

test("toolbar preview stays within a tag and search and handles empty results and overview pages", async ({ page }) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open("keepall"); request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "tags"], "readwrite");
      tx.objectStore("tags").put({ id: "selected-tag", name: "References", createdAt: 1 });
      for (const index of [2, 4]) {
        const request = tx.objectStore("items").get(`note-${index}`);
        request.onsuccess = () => tx.objectStore("items").put({ ...request.result, tagIds: ["selected-tag"] });
      }
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto("/?tag=selected-tag&q=Batch&layout=list");
  const preview = page.getByRole("button", { name: "Preview", exact: true });
  await preview.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Batch 002");
  await dialog.getByRole("button", { name: "Next item" }).click();
  await expect(dialog).toHaveAccessibleName("Batch 004");
  await expect(dialog.getByRole("button", { name: "Next item" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("no matching save");
  await expect(preview).toBeDisabled();
  for (const query of ["collections=1", "tags=1", "trash=1"]) {
    await page.goto(`/?${query}`);
    await expect(page.getByRole("button", { name: "Preview", exact: true })).toHaveCount(0);
  }
});

test("preview toolbar fits narrow screens and is usable without a keyboard", async ({ page }, testInfo) => {
  await page.goto("/?layout=list&q=Batch%20000");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const sidebar = page.getByRole("dialog", { name: "Sidebar navigation" });
    if (await sidebar.isVisible()) await sidebar.getByRole("button", { name: "Close navigation" }).click();
    const preview = page.getByRole("button", { name: "Preview", exact: true });
    await expect(preview).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await preview.click();
    const dialog = page.getByRole("dialog", { name: "Batch 000" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close preview" }).click();
    await expect(page.locator('[data-item-id="note-0"]')).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`preview-entry-${width}.png`) });
  }
});
