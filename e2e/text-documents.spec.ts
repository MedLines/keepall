import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

test.use({ serviceWorkers: "block" });

for (const extension of ["txt", "md"]) {
  test(`importing ${extension} replaces automatic clipboard text and keeps only the file after reload`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        readText: async () => "Old clipboard text",
      } });
    });
    await page.goto("/");
    await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
    await page.keyboard.press("Alt+k");
    const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
    await expect(capture.getByRole("textbox", { name: "Link, note, or image", exact: true })).toHaveValue("Old clipboard text");
    const chooser = page.waitForEvent("filechooser");
    await capture.getByRole("button", { name: "Add files", exact: true }).click();
    await (await chooser).setFiles({ name: `imported.${extension}`, mimeType: "", buffer: Buffer.from("File content") });
    await expect(capture.getByRole("textbox", { name: /^(Markdown|Text) content$/ })).toHaveValue("File content");
    await capture.getByRole("button", { name: "Save", exact: true }).click();
    await expect(capture).toBeHidden();
    await page.reload();
    await expect(page.locator("[data-item-id]")).toHaveCount(1);
    await page.locator('[data-item-id] a[href^="/items/"]').first().click();
    await expect(page.getByRole("article", { name: "Document content" })).toHaveText("File content");
  });
}

test("a successful batch closes the empty drawer and a plain-text file opens with editable content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const review = await chooseDocuments(page, [
    { name: "plain.txt", mimeType: "text/plain", buffer: Buffer.from("Plain file content") },
    { name: "second.md", mimeType: "text/markdown", buffer: Buffer.from("# Second note") },
  ]);
  await review.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Save to Keepall", exact: true })).toBeHidden();
  await expect(page.locator("[data-item-id]")).toHaveCount(2);
  await page.getByRole("link", { name: "Open plain", exact: true }).click();
  await expect(page.getByRole("article", { name: "Document content" })).toHaveText("Plain file content");
  await page.getByRole("button", { name: "Edit document", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit document", exact: true });
  const content = editor.getByRole("textbox", { name: "Text content", exact: true });
  await expect(content).toHaveValue("Plain file content");
  await content.fill("Changed plain file content");
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  await expect(page.getByRole("article", { name: "Document content" })).toHaveText("Changed plain file content");
});

test("images and Markdown save together, close the drawer, and remain editable after reload", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const capture = await chooseDocuments(page, [
    { name: "plan.md", mimeType: "text/markdown", buffer: Buffer.from("# Imported text\n\nWith the photo.") },
  ]);
  const imageChooser = page.waitForEvent("filechooser");
  await capture.getByRole("button", { name: "Add files", exact: true }).click();
  await (await imageChooser).setFiles({ name: "photo.png", mimeType: "image/png", buffer: await sharp({ create: { width: 4, height: 4, channels: 3, background: "#336699" } }).png().toBuffer() });
  await expect(capture.getByLabel("1 image attached")).toBeVisible();
  const text = capture.getByRole("textbox", { name: "Text beneath images", exact: true });
  await expect(text).toHaveValue("# Imported text\n\nWith the photo.");
  await text.fill("# Edited text\n\nSaved with the photo.");
  await capture.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(capture.getByRole("heading", { name: "Edited text", exact: true })).toBeVisible();
  const previewBox = await capture.getByRole("region", { name: "Image note preview" }).boundingBox();
  const paragraphBox = await capture.getByText("Saved with the photo.", { exact: true }).boundingBox();
  expect(paragraphBox!.y + paragraphBox!.height).toBeLessThanOrEqual(previewBox!.y + previewBox!.height);
  await page.screenshot({ path: testInfo.outputPath("combined-draft.png") });
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await page.locator('[data-item-id] a[href^="/items/"]').first().click();
  await expect(page.getByRole("heading", { name: "Edited text", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit details", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Edited text", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit image details", exact: true });
  const caption = editor.getByRole("textbox", { name: "Notes", exact: true });
  await expect(caption).toHaveValue("# Edited text\n\nSaved with the photo.");
  await page.screenshot({ path: testInfo.outputPath("combined-editor.png") });
  await caption.fill("# Updated after reload");
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Updated after reload", exact: true })).toBeVisible();
});


test("one Add files picker detects mixed media and text without replacing an unfinished note", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const review = await chooseDocuments(page, [
    { name: "photo.png", mimeType: "image/png", buffer: await sharp({ create: { width: 4, height: 4, channels: 3, background: "#336699" } }).png().toBuffer() },
    { name: "clip.mp4", mimeType: "video/mp4", buffer: await readFile(join(__dirname, "fixtures", "tiny.mp4")) },
    { name: "plan.md", mimeType: "", buffer: Buffer.from("# Imported note") },
  ], "Unfinished note");
  await expect(review).toContainText("photo.png");
  await expect(review).toContainText("clip.mp4");
  await expect(review).toContainText("Markdown note");
  await review.getByRole("button", { name: "Save", exact: true }).click();
  await expect(review.getByRole("region", { name: "Selected files" })).toBeHidden();
  const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await expect(capture).toContainText("3 files saved. Your draft is still here.");
  await expect(capture.getByRole("textbox", { name: "Link, note, or image", exact: true })).toHaveValue("Unfinished note");
  await capture.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(capture).toBeHidden();
  await expect(page.locator("[data-item-id]")).toHaveCount(3);
  await page.goto("/?type=note");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Open plan", exact: true })).toBeVisible();
});

async function chooseDocuments(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[], draft?: string) {
  await page.keyboard.press("Alt+k");
  const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await expect(capture).toBeVisible();
  await expect(capture.getByRole("button", { name: "Add files", exact: true })).toBeEnabled();
  if (draft) await capture.getByRole("textbox", { name: "Link, note, or image", exact: true }).fill(draft);
  const chooser = page.waitForEvent("filechooser");
  await capture.getByRole("button", { name: "Add files", exact: true }).click();
  await (await chooser).setFiles(files);
  return capture;
}

async function importAndOpen(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const capture = await chooseDocuments(page, [file]);
  await expect(capture.getByRole("textbox", { name: /^(Markdown|Text) content$/ })).toBeEnabled();
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
  await page.goto("/?type=note");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await page.locator('[data-item-id] a[href^="/items/"]').first().click();
  await expect(page).toHaveURL(/\/items\//);
}

test("Alt+K imports Markdown safely, edits personal notes, and downloads the unchanged original", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://document-fixture.invalid/**", (route) => { externalRequests.push(route.request().url()); return route.abort(); });
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const bytes = Buffer.from('\uFEFF# Architecture\r\n\n- [x] Unicode café مرحبا\n\n| File | Saved |\n| --- | --- |\n| plan.md | Yes |\n\n![Remote](https://document-fixture.invalid/pixel.png)\n\n![Local](keepall-image:secret)\n\n<iframe src="https://document-fixture.invalid/frame"></iframe><script>window.documentExecuted=true</script>\n\n[Unsafe](javascript:alert(1))');
  await importAndOpen(page, { name: "plan.md", mimeType: "application/octet-stream", buffer: bytes });
  await expect(page.getByRole("heading", { name: "Architecture", exact: true })).toBeVisible();
  const original = page.getByRole("article", { name: "Document content" });
  await expect(original.getByRole("checkbox")).toBeDisabled();
  await expect(original.getByRole("table")).toContainText("plan.md");
  await expect(original.locator("img, iframe, script")).toHaveCount(0);
  await expect(original.getByRole("link", { name: "Unsafe" })).toHaveCount(0);
  expect(await page.evaluate(() => "documentExecuted" in window)).toBe(false);
  expect(externalRequests).toEqual([]);

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`document-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Edit document", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit document", exact: true });
  await editor.getByRole("textbox", { name: "Title", exact: true }).fill("Planning document");
  await expect(editor.getByRole("textbox", { name: "Markdown content", exact: true })).toHaveValue(bytes.toString("utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"));
  await editor.getByText("Personal note (optional)", { exact: true }).click();
  await editor.getByRole("textbox", { name: "My note (optional)", exact: true }).fill("A separate personal note");
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Planning document", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Personal note" })).toContainText("A separate personal note");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Architecture", exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download file", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("plan.md");
  expect(await readFile((await download.path())!)).toEqual(bytes);
  await page.getByRole("link", { name: "Back to library", exact: true }).click();
  await expect(page).toHaveURL(/type=note/);
  await expect(page.getByRole("heading", { name: "Notes", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Planning document", exact: true })).toBeVisible();
  await page.locator(".library-card").filter({ hasText: "Planning document" }).hover();
  await page.getByRole("button", { name: "Actions for Planning document", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const cardEditor = page.getByRole("dialog", { name: "Edit document", exact: true });
  await cardEditor.getByRole("textbox", { name: "My note (optional)", exact: true }).fill("Updated from the library");
  await cardEditor.getByRole("textbox", { name: "Markdown content", exact: true }).fill("# Edited from the library\nمرحبا");
  await cardEditor.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(cardEditor).toBeHidden();
  await page.reload();
  await page.locator('[data-item-id] a[href^="/items/"]').first().click();
  await expect(page.getByRole("heading", { name: "Edited from the library", exact: true })).toBeVisible();
  const editedDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download file", exact: true }).click();
  expect(await readFile((await (await editedDownloadPromise).path())!)).toEqual(Buffer.from("# Edited from the library\nمرحبا"));
  await page.getByRole("link", { name: "Back to library", exact: true }).click();
  await page.keyboard.press("Alt+k");
  await expect(page.getByRole("dialog", { name: "Save to Keepall" }).getByRole("button", { name: "Bulk import", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("multi-file import reports invalid UTF-8 and supports empty files, preview, filtering and Trash recovery", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  const literal = '<script>literal text</script>\nمرحبا';
  const review = await chooseDocuments(page, [
    { name: "literal.TXT", mimeType: "", buffer: Buffer.from(literal) },
    { name: "empty.md", mimeType: "", buffer: Buffer.from("") },
    { name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from([0xc3, 0x28]) },
  ]);
  await review.getByRole("textbox", { name: "Collection" }).fill("Reading");
  await page.screenshot({ path: testInfo.outputPath("document-import.png") });
  await review.getByRole("button", { name: "Save", exact: true }).click();
  const complete = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await expect(complete).toContainText("2 saved, 1 failed");
  await expect(complete).toContainText("UTF-8");
  await complete.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Save to Keepall", exact: true })).toBeHidden();
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Reading", exact: true }).click();
  await expect(page).toHaveURL(/collection=/);
  const collectionUrl = page.url();
  await expect(page.getByRole("main", { name: "Reading", exact: true })).toBeVisible();
  await expect(page.locator("[data-item-id]")).toHaveCount(2);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.locator(".library-quick-preview[role=dialog]");
  await expect(preview).toContainText("This file is empty.");
  await preview.getByRole("button", { name: "Next item", exact: true }).click();
  await expect(preview).toContainText(literal);
  await expect(preview.locator("script")).toHaveCount(0);
  await preview.getByRole("button", { name: "Open full item", exact: true }).click();
  await expect(page.getByRole("article", { name: "Document content" })).toHaveText(literal);
  await page.getByRole("button", { name: "Move document to Trash", exact: true }).click();
  await page.getByRole("dialog", { name: "Move this document to Trash?" }).getByRole("button", { name: "Move to Trash", exact: true }).click();
  await expect(page).toHaveURL(collectionUrl);
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.goto("/?type=note&layout=list");
  await expect(page.locator("[data-item-id]")).toHaveCount(2);
  await page.getByRole("link", { name: "Open literal", exact: true }).last().click();
  await expect(page.getByRole("article", { name: "Document content" })).toHaveText(literal);
});

test("bulk files keep images, TXT, and Markdown separate in one collection after reload", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.keyboard.press("Alt+k");
  const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await capture.getByRole("button", { name: "Bulk import", exact: true }).click();
  const bulk = page.getByRole("dialog", { name: "Bulk import", exact: true });
  const chooser = page.waitForEvent("filechooser");
  await bulk.getByRole("button", { name: "Import files", exact: true }).click();
  await (await chooser).setFiles([
    { name: "photo.png", mimeType: "image/png", buffer: await readFile("public/icons/icon-192.png") },
    { name: "first.md", mimeType: "", buffer: Buffer.from("# First bulk note") },
    { name: "second.txt", mimeType: "", buffer: Buffer.from("Second bulk note") },
  ]);
  const review = capture;
  await expect(review).toContainText("3 files · Separate items");
  await review.getByRole("textbox", { name: "Collection", exact: true }).fill("Mixed bulk library");
  await review.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("mixed-bulk-complete.png") });
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Mixed bulk library", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/collection=/);
  await expect(page.getByRole("main", { name: "Mixed bulk library", exact: true })).toBeVisible();
  await expect(page.locator("[data-item-id]")).toHaveCount(3);
  await page.reload();
  await expect(page.locator("[data-item-id]")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Open Image", exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "Open first", exact: true }).click();
  await expect(page.getByRole("heading", { name: "First bulk note", exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole("link", { name: "Open second", exact: true }).click();
  await expect(page.getByRole("article", { name: "Document content" })).toHaveText("Second bulk note");
  expect(errors).toEqual([]);
});
