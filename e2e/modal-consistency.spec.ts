import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

test.use({ serviceWorkers: "block" });
const title = "UI comparison test";
const content = `${title}\n\n${Array.from({ length: 70 }, (_, i) => `Paragraph ${i + 1}. Testing a long note.`).join("\n\n")}`;

async function openCapture(page: Page, text: string, keyboard = false) {
  const saveItem = page.getByRole("button", { name: "Save item", exact: true });
  if (keyboard) await saveItem.press("Enter");
  else await saveItem.click();
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await drawer.getByRole("textbox", { name: "Link, note, or image", exact: true }).fill(text);
  return drawer;
}

async function createNote(page: Page, keyboard = false) {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const closeSidebar = page.getByRole("button", { name: "Close navigation", exact: true });
  if (await closeSidebar.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(closeSidebar).toBeHidden();
  }
  const drawer = await openCapture(page, content, keyboard);
  await drawer.getByRole("textbox", { name: "Tags", exact: true }).fill("ui-test");
  await drawer.getByRole("textbox", { name: "Tags", exact: true }).press("Enter");
  await assertOrder(page, drawer, "Cancel", "Save");
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(drawer).toBeHidden();
  return page.locator("[data-item-id]").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

async function cardAction(page: Page, card: Locator, name: string) {
  await card.hover();
  await card.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

async function chooseSelectionAction(page: Page, bulk: Locator, count: number, action: string) {
  const inline = bulk.getByRole("button", { name: action, exact: true });
  if (await inline.isVisible()) await inline.click();
  else {
    await bulk.getByRole("button", { name: `Selection actions: ${count} selected`, exact: true }).click();
    await page.getByRole("menuitem", { name: action, exact: true }).click();
  }
}

async function assertOrder(page: Page, dialog: Locator, cancelName: string, actionName: string) {
  const cancel = dialog.getByRole("button", { name: cancelName, exact: true });
  const action = dialog.getByRole("button", { name: actionName, exact: true });
  await expect(cancel).toBeInViewport();
  await expect(action).toBeInViewport();
  const rects = await dialog.evaluate((element, names) => names.map(name => {
    const button = [...element.querySelectorAll("button")].find(button => button.textContent?.trim() === name)!;
    const r = button.getBoundingClientRect();
    return { x: r.x, right: r.right, y: r.y };
  }), [cancelName, actionName]);
  expect(rects[0].right).toBeLessThanOrEqual(rects[1].x);
  expect(rects[0].y).toBe(rects[1].y);
  await cancel.focus();
  await page.keyboard.press("Tab");
  await expect(action).toBeFocused();
}

for (const width of [320, 768, 1024, 1440]) {
  test(`note editing uses the same modal, controls, images and visible footer at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const card = await createNote(page);
    await cardAction(page, card, "Edit");
    const dialog = page.getByRole("dialog", { name: "Edit note", exact: true });
    await assertOrder(page, dialog, "Cancel edit", "Save note");
    await expect(dialog.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add image at cursor", exact: true })).toBeVisible();
    const editor = dialog.getByRole("textbox", { name: "Note content", exact: true });
    expect(await editor.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await dialog.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(dialog.getByLabel("Note preview")).toContainText("Paragraph 70");
    await dialog.getByRole("button", { name: "Edit", exact: true }).click();
    await editor.fill("Discard this edit");
    await dialog.getByRole("button", { name: "Cancel edit", exact: true }).click();
    await expect(dialog).toBeHidden();
    await cardAction(page, card, "Edit");
    await expect(editor).toHaveValue(content);
    const image = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#3399cc" } }).png().toBuffer();
    await dialog.getByLabel("Choose note images").setInputFiles({ name: "test.png", mimeType: "image/png", buffer: image });
    await expect(editor).toHaveValue(/keepall-image:/);
    await dialog.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(dialog).toBeHidden();
    await card.getByText("Read note →", { exact: true }).click();
    await expect(page.getByRole("img", { name: "Image", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit note", exact: true }).click();
    await assertOrder(page, dialog, "Cancel edit", "Save note");
    await expect(dialog.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add image at cursor", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Remove image 1", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`shared-note-editor-${width}.png`) });
    await dialog.getByRole("button", { name: "Remove image 1", exact: true }).click();
    await dialog.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("img", { name: "Image", exact: true })).toHaveCount(0);
  });

  test(`single and selected items share the organization drawer at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const card = await createNote(page, true);
    await cardAction(page, card, "Organize");
    let drawer = page.getByRole("dialog", { name: `Organize ${title}`, exact: true });
    await expect(drawer.getByRole("heading", { name: "Tags", exact: true })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Collection", exact: true })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Done", exact: true })).toBeInViewport();
    const singleWidth = (await drawer.boundingBox())!.width;
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await expect(drawer).toBeHidden();
    await card.hover();
    await card.locator("[data-selection-indicator]").click();
    const bulk = page.getByRole("region", { name: "Bulk actions", exact: true });
    await chooseSelectionAction(page, bulk, 1, "Organize");
    drawer = page.getByRole("dialog", { name: "Organize 1 selected item", exact: true });
    await expect(drawer.getByRole("textbox", { name: "Add tag to selection", exact: true })).toBeVisible();
    await expect(drawer.getByRole("textbox", { name: "Move selection to collection", exact: true })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Done", exact: true })).toBeInViewport();
    expect((await drawer.boundingBox())!.width).toBeCloseTo(singleWidth, 0);
    await page.screenshot({ path: testInfo.outputPath(`bulk-organizer-${width}.png`) });
    await drawer.getByRole("button", { name: "Remove tag ui-test from selection", exact: true }).click();
    await expect(drawer.getByRole("list", { name: "Selected tags" })).toHaveCount(0);
    await drawer.getByRole("textbox", { name: "Add tag to selection", exact: true }).fill("ui-test");
    await drawer.getByRole("textbox", { name: "Add tag to selection", exact: true }).press("Enter");
    await expect(drawer.getByRole("button", { name: "Remove tag ui-test from selection", exact: true })).toBeVisible();
    await drawer.getByRole("textbox", { name: "Move selection to collection", exact: true }).fill("UI tests");
    await drawer.getByRole("textbox", { name: "Move selection to collection", exact: true }).press("Enter");
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(card.getByRole("button", { name: "UI tests", exact: true })).toBeVisible();
    await chooseSelectionAction(page, bulk, 1, "Deselect all");
    await card.getByRole("button", { name: "1 tag", exact: true }).click();
    await card.getByRole("button", { name: "Remove tag ui-test", exact: true }).click();
    await expect(card.getByRole("button", { name: "1 tag", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm remove tag ui-test", exact: true })).toHaveCount(0);
    await cardAction(page, card, "Organize");
    drawer = page.getByRole("dialog", { name: `Organize ${title}`, exact: true });
    await drawer.getByRole("textbox", { name: "Add tag", exact: true }).fill("ui-test");
    await drawer.getByRole("textbox", { name: "Add tag", exact: true }).press("Enter");
    await expect(drawer.getByRole("button", { name: "Remove tag ui-test", exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Remove tag ui-test", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Remove tag ui-test", exact: true })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
  });
}

test("duplicate links and every import dialog share close, footer and backdrop behavior", async ({ page }, testInfo) => {
  const card = await createNote(page);
  await cardAction(page, card, "Edit");
  const edit = page.getByRole("dialog", { name: "Edit note", exact: true });
  await page.mouse.click(8, 8);
  await expect(edit).toBeHidden();
  for (const collection of ["Modal test A", "Modal test B"]) {
    const capture = await openCapture(page, "https://example.com/modal-test");
    await capture.getByRole("textbox", { name: "Collection", exact: true }).fill(collection);
    await capture.getByRole("textbox", { name: "Collection", exact: true }).press("Enter");
    await capture.getByRole("button", { name: "Save", exact: true }).click();
    if (collection === "Modal test A") await expect(capture).toBeHidden();
    else {
      const conflict = page.getByRole("dialog", { name: "Already saved", exact: true });
      await assertOrder(page, conflict, "Cancel", "Confirm");
      await expect(conflict.getByRole("button", { name: "Close", exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("duplicate-link.png") });
      await page.mouse.click(8, 8);
      await expect(conflict).toBeHidden();
      await expect(capture).toBeVisible();
      await capture.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  }
  await page.goto("/settings#storage");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  const downloadPromise = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Export backup", exact: true }).click();
  const archivePath = await (await downloadPromise).path();
  const bookmarkHtml = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://example.com">Example</A></DL><p>';
  for (const kind of ["backup", "bookmarks", "images"]) {
    if (kind !== "backup") {
      await page.goto("/");
      await page.keyboard.press("Alt+k");
      await page.getByRole("button", { name: "Bulk import", exact: true }).click();
    }
    const imports = page.getByRole("dialog", { name: "Bulk import", exact: true });
    if (kind === "backup") await backup.locator('input[accept*="application/zip"]').setInputFiles(archivePath!);
    if (kind === "bookmarks") await imports.locator('input[accept*="text/html"]').setInputFiles({ name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from(bookmarkHtml) });
    if (kind === "images") {
      const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#3399cc" } }).png().toBuffer();
      const folder = testInfo.outputPath("images");
      await mkdir(folder, { recursive: true });
      await writeFile(`${folder}/test.png`, png);
      await imports.locator('input[webkitdirectory]').setInputFiles(folder);
    }
    const dialog = page.getByRole("dialog", { name: kind === "backup" ? "Import backup" : kind === "bookmarks" ? "Import browser bookmarks" : "Import image folder", exact: true });
    await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`import-${kind}.png`) });
    await page.mouse.click(8, 8);
    await expect(dialog).toBeHidden();
  }
});


async function seedUnsortedOrganization(page: Page) {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["items", "tags", "collections"], "readwrite");
      const shared = { createdAt: 1, updatedAt: 1, collectionAddedAt: 7, tagIds: ["reference"], collectionIds: ["reading"] };
      const items = tx.objectStore("items");
      items.put({ ...shared, id: "note", type: "note", title: "Visible note", content: "Keep note body" });
      items.put({ ...shared, id: "link", type: "link", title: "Hidden link", url: "https://example.com", noteContent: "Keep link note", previewStatus: "ready", previewRetry: "none", previewAttemptedAt: null, previewTitle: "", previewDescription: "", previewImageUrl: "", previewAssetId: null });
      items.put({ ...shared, id: "image", type: "image", title: "Hidden image", assetIds: ["image-file"], caption: "Keep caption", sourceUrl: "" });
      items.put({ ...shared, id: "video", type: "video", title: "Hidden video", assetId: "video-file", sourceFileName: "clip.mp4", noteContent: "Keep video note" });
      tx.objectStore("tags").put({ id: "reference", name: "Reference", createdAt: 1 });
      tx.objectStore("collections").put({ id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: ["note"] });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator("[data-item-id]")).toHaveCount(4);
  const closeNavigation = page.getByRole("button", { name: "Close navigation", exact: true });
  if (await closeNavigation.isVisible()) await closeNavigation.click();
}

async function readUnsortedOrganization(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await Promise.all(["items", "tags", "collections"].map(store => new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })));
    db.close();
    return { items: rows[0], tags: rows[1], collections: rows[2] };
  });
}

for (const width of [320, 1280]) {
  test(`Unsorted single and detail drawers preserve tags after reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedUnsortedOrganization(page);
    const before = await readUnsortedOrganization(page);
    const card = page.locator('[data-item-id="note"]');
    await card.hover();
    await card.getByRole("button", { name: "Actions for Visible note", exact: true }).click();
    await page.getByRole("menuitem", { name: "Organize", exact: true }).click();
    let drawer = page.getByRole("dialog", { name: "Organize Visible note", exact: true });
    const clear = drawer.getByRole("button", { name: "Unsorted", exact: true });
    await clear.scrollIntoViewIfNeeded();
    await expect(clear).toBeInViewport();
    await clear.click();
    await expect(drawer.getByRole("button", { name: "Unsorted", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(drawer.getByRole("button", { name: "Remove tag Reference", exact: true })).toBeVisible();
    await drawer.getByRole("textbox", { name: "Move to collection", exact: true }).fill("Reading");
    await drawer.getByRole("textbox", { name: "Move to collection", exact: true }).press("Enter");
    await expect(drawer.getByRole("button", { name: "Reading", exact: true })).toHaveAttribute("aria-pressed", "true");
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await page.goto("/items/note?from=%2F");
    await page.getByRole("button", { name: "Organize", exact: true }).click();
    drawer = page.getByRole("dialog", { name: "Organize Visible note", exact: true });
    await drawer.getByRole("button", { name: "Unsorted", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Unsorted", exact: true })).toHaveAttribute("aria-pressed", "true");
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Organize", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unsorted", exact: true })).toHaveAttribute("aria-pressed", "true");
    const after = await readUnsortedOrganization(page);
    expect(after.tags).toEqual(before.tags);
    expect(after.collections).toEqual(before.collections);
    expect(after.items.find(item => item.id === "note")).toMatchObject({ collectionIds: [], tagIds: ["reference"], content: "Keep note body", collectionAddedAt: expect.any(Number) });
  });
}

for (const clearHidden of [false, true]) {
  test(`Unsorted mixed bulk includes hidden items unless cleared, clear hidden=${clearHidden}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await seedUnsortedOrganization(page);
    const before = await readUnsortedOrganization(page);
    for (const card of await page.locator("[data-item-id]").all()) {
      await card.hover();
      await card.locator("[data-selection-indicator]").click();
    }
    await page.getByRole("searchbox", { name: "Search", exact: true }).fill("Visible");
    const bulk = page.getByRole("region", { name: "Bulk actions", exact: true });
    await expect(bulk).toContainText("3 hidden");
    await bulk.getByRole("button", { name: "Selection actions: 4 selected", exact: true }).click();
    if (clearHidden) {
      await page.getByRole("menuitem", { name: "Clear hidden selection", exact: true }).click();
      await bulk.getByRole("button", { name: "Selection actions: 1 selected", exact: true }).click();
    }
    await page.getByRole("menuitem", { name: "Organize", exact: true }).click();
    const drawer = page.getByRole("dialog");
    const clear = drawer.getByRole("button", { name: "Unsorted", exact: true });
    await clear.scrollIntoViewIfNeeded();
    await expect(clear).toBeInViewport();
    await clear.click();
    await expect(clear).toBeEnabled();
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await expect(bulk).toContainText(clearHidden ? "1 selected" : "4 selected");
    await page.reload();
    const after = await readUnsortedOrganization(page);
    expect(after.tags).toEqual(before.tags);
    expect(after.collections).toEqual(before.collections);
    for (const original of before.items) {
      const actual = after.items.find(item => item.id === original.id);
      if (!clearHidden || original.id === "note") {
        expect(actual).toEqual({ ...original, collectionIds: [], updatedAt: expect.any(Number) });
      } else expect(actual).toEqual(original);
    }
  });
}

for (const width of [320, 1440]) {
  test(`unsaved editor dismissal keeps nested focus and saves once at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const card = await createNote(page);
    await cardAction(page, card, "Edit");
    const dialog = page.getByRole("dialog", { name: "Edit note", exact: true });
    const editor = dialog.getByRole("textbox", { name: "Note content", exact: true });
    await editor.fill("Unsaved revised note");
    await editor.press("Escape");
    const confirmation = page.getByRole("dialog", { name: "Discard unsaved changes?", exact: true });
    const keep = confirmation.getByRole("button", { name: "Keep editing", exact: true });
    await expect(keep).toBeFocused();
    await expect(confirmation.getByRole("button", { name: "Discard changes", exact: true })).toBeInViewport();
    expect(await confirmation.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press("Shift+Tab");
    await expect(confirmation.getByRole("button", { name: "Close", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirmation.getByRole("button", { name: "Discard changes", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeHidden();
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue("Unsaved revised note");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await keep.click();
    await expect(editor).toBeFocused();
    await editor.press("Control+Enter");
    await expect(dialog).toBeHidden();
    await expect(confirmation).toBeHidden();
    await expect(page.getByRole("heading", { name: "Unsaved revised note", exact: true })).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Unsaved revised note", exact: true })).toHaveCount(1);
  });
}
