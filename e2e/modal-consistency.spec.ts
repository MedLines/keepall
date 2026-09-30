import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

test.use({ serviceWorkers: "block" });
const title = "UI comparison test";
const content = `${title}\n\n${Array.from({ length: 70 }, (_, i) => `Paragraph ${i + 1}. Testing a long note.`).join("\n\n")}`;

async function openCapture(page: Page, text: string) {
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await drawer.getByRole("textbox", { name: "Link, note, or image", exact: true }).fill(text);
  return drawer;
}

async function createNote(page: Page) {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const closeSidebar = page.getByRole("button", { name: "Close sidebar", exact: true });
  if (await closeSidebar.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(closeSidebar).toBeHidden();
  }
  const drawer = await openCapture(page, content);
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
    const card = await createNote(page);
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
    await bulk.getByRole("button", { name: "Selection actions: 1 selected" }).click();
    await page.getByRole("menuitem", { name: "Organize", exact: true }).click();
    drawer = page.getByRole("dialog", { name: "Organize 1 selected item", exact: true });
    await expect(drawer.getByRole("combobox", { name: "Add tag to selection", exact: true })).toBeVisible();
    await expect(drawer.getByRole("combobox", { name: "Move selection to collection", exact: true })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Done", exact: true })).toBeInViewport();
    expect((await drawer.boundingBox())!.width).toBeCloseTo(singleWidth, 0);
    await page.screenshot({ path: testInfo.outputPath(`bulk-organizer-${width}.png`) });
    await drawer.getByRole("button", { name: "Remove tag ui-test from selection", exact: true }).click();
    await expect(drawer.getByText("The selected items have no tags.", { exact: true })).toBeVisible();
    await drawer.getByRole("combobox", { name: "Add tag to selection", exact: true }).fill("ui-test");
    await drawer.getByRole("button", { name: "Add", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Remove tag ui-test from selection", exact: true })).toBeVisible();
    await drawer.getByRole("combobox", { name: "Move selection to collection", exact: true }).fill("UI tests");
    await drawer.getByRole("button", { name: "Move", exact: true }).click();
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(card.getByRole("button", { name: "UI tests", exact: true })).toBeVisible();
    await bulk.getByRole("button", { name: "Selection actions: 1 selected" }).click();
    await page.getByRole("menuitem", { name: "Deselect all", exact: true }).click();
    await card.getByRole("button", { name: "1 tag", exact: true }).click();
    await card.getByRole("button", { name: "Remove tag ui-test", exact: true }).click();
    await expect(card.getByRole("button", { name: "1 tag", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm remove tag ui-test", exact: true })).toHaveCount(0);
    await cardAction(page, card, "Organize");
    drawer = page.getByRole("dialog", { name: `Organize ${title}`, exact: true });
    await drawer.getByRole("combobox", { name: "Add tag", exact: true }).fill("ui-test");
    await drawer.getByRole("button", { name: "Add", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Remove tag ui-test", exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Remove tag ui-test", exact: true }).click();
    await expect(drawer.getByText("No tags added.", { exact: true })).toBeVisible();
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
  await page.goto("/settings");
  const backup = page.getByRole("region", { name: "Backup", exact: true });
  const downloadPromise = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Export backup", exact: true }).click();
  const archivePath = await (await downloadPromise).path();
  const imports = page.getByRole("region", { name: "Import", exact: true });
  const bookmarkHtml = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://example.com">Example</A></DL><p>';
  for (const kind of ["backup", "bookmarks", "images"]) {
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
