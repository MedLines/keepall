import { test, expect, chromium, type Page } from "@playwright/test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
const origin = `http://localhost:${process.env.KEEPALL_E2E_PORT ?? "3100"}`;
declare const chrome: {
  storage: { local: { set(value: object): Promise<void> }; session: { get(key: string): Promise<Record<string, { editorId: string }>> } };
  tabs: { query(value: object): Promise<Array<{ id: number; url: string }>> };
  scripting: { executeScript(value: object): Promise<unknown> };
  runtime: { sendMessage(value: Record<string, unknown>): Promise<Record<string, unknown>> };
};
declare function openEditor(tab: { id: number; url: string }): Promise<void>;
async function setup() {
  const profile = await mkdtemp(path.join(tmpdir(), "keepall-files-"));
  const extension = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, { channel: "chromium", headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  await worker.evaluate(origin => chrome.storage.local.set({ origin }), origin);
  const library = await context.newPage(); await library.goto(origin);
  await expect(library.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
  const page = await context.newPage();
  await page.route("http://localhost:3200/files", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Source article</title><h1>Source article</h1>" }));
  await page.goto("http://localhost:3200/files");
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (options) { return attach.call(this, { ...options, mode: "open" }); };
    } });
  });
  const open = async () => { await page.bringToFront(); await worker.evaluate(async () => { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); await openEditor(tab); }); };
  await open();
  const editor = page.locator("#keepall-capture-ui").frameLocator("iframe");
  await expect(editor.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  return { context, page, library, worker, open, editor, dispose: async () => { await context.close(); await rm(profile, { recursive: true, force: true }); } };
}
async function records(page: Page, store = "items") {
  return page.evaluate(store => new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
    const request = indexedDB.open("keepall"); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction(store); const read = tx.objectStore(store).getAll(); read.onsuccess = () => resolve(read.result); tx.oncomplete = () => db.close(); };
  }), store);
}
async function documentHashes(page: Page) {
  return page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const request = indexedDB.open("keepall"); request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const read = request.result.transaction("documentAssets").objectStore("documentAssets").getAll();
      read.onsuccess = async () => resolve(await Promise.all(read.result.map(async asset => [...new Uint8Array(await crypto.subtle.digest("SHA-256", asset.bytes))].map(byte => byte.toString(16).padStart(2, "0")).join(""))));
    };
  }));
}
const png = () => readFile(path.resolve("public/icons/icon-192.png"));

test("files preserve page drafts, Markdown preview is local, and text bytes persist with organization", async ({}, info) => {
  test.setTimeout(90_000); const f = await setup();
  try {
    await f.page.screenshot({ path: info.outputPath("fresh-open-drawer.png") });
    await f.editor.getByRole("textbox", { name: "Title", exact: true }).fill("My page draft");
    await f.editor.getByRole("textbox", { name: "Your note (optional)" }).fill("Page note");
    const bytes = Buffer.from("\ufeff# Document\r\n\r\n![remote](https://example.invalid/image.png)\r\n<script>evil()</script>\r\n");
    const requests: string[] = []; f.context.on("request", request => { if (request.url().includes("example.invalid")) requests.push(request.url()); });
    await f.editor.locator('input[type="file"]').setInputFiles({ name: "original.md", mimeType: "text/markdown", buffer: bytes });
    await expect(f.editor.getByRole("heading", { name: "Save files to Keepall" })).toBeVisible();
    await expect(f.editor.getByRole("button", { name: "Markdown", exact: true })).toHaveAttribute("aria-pressed", "true");
    await f.editor.getByRole("button", { name: "Preview", exact: true }).click();
    const preview = f.editor.getByRole("region", { name: "File contents preview" });
    await expect(preview.getByRole("heading", { name: "Document" })).toBeVisible();
    await expect(preview).toContainText("<script>evil()</script>"); expect(await preview.locator("img").count()).toBe(0);
    await f.editor.getByRole("button", { name: "Edit", exact: true }).click();
    await f.editor.getByRole("textbox", { name: "Filter or new collection" }).fill("Research");
    await f.editor.getByRole("button", { name: "Create collection “Research”", exact: true }).click();
    await f.editor.getByRole("textbox", { name: "Filter or create tag" }).fill("Files");
    await f.editor.getByRole("button", { name: "Create tag “Files”", exact: true }).click();
    await f.editor.getByRole("button", { name: "Close", exact: true }).click(); await f.open();
    await expect(f.editor.getByRole("textbox", { name: "File contents" })).toBeVisible();
    for (const [scheme, width, height] of [["light", 1280, 900], ["dark", 360, 640], ["light", 1000, 440]] as const) {
      await f.page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" }); await f.page.setViewportSize({ width, height });
      await expect(f.editor.getByRole("button", { name: "Save files", exact: true })).toBeInViewport();
      await f.page.screenshot({ path: info.outputPath(`files-${scheme}-${width}.png`) });
    }
    await f.editor.getByRole("button", { name: "Save files", exact: true }).click();
    await expect(f.editor.locator(".file-progress")).toHaveText("1 file saved to Keepall.", { timeout: 30_000 });
    await f.library.reload(); const items = await records(f.library); expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "document", sourceFileName: "original.md", collectionIds: expect.any(Array), tagIds: expect.any(Array) });
    const collections = await records(f.library, "collections"); const tags = await records(f.library, "tags");
    expect(items[0].collectionIds).toEqual([collections.find(value => value.name === "Research")?.id]);
    expect(items[0].tagIds).toEqual([tags.find(value => value.name === "Files")?.id]);
    const stored = await f.library.evaluate(() => new Promise<string>((resolve, reject) => {
      const request = indexedDB.open("keepall"); request.onerror = () => reject(request.error); request.onsuccess = () => { const read = request.result.transaction("documentAssets").objectStore("documentAssets").getAll(); read.onsuccess = async () => resolve(btoa(String.fromCharCode(...read.result[0].bytes))); };
    })); expect(stored).toBe(bytes.toString("base64")); expect(requests).toEqual([]);
    await f.editor.getByRole("button", { name: "Done", exact: true }).click(); await f.open();
    await expect(f.editor.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("My page draft");
    await expect(f.editor.getByRole("textbox", { name: "Your note (optional)" })).toHaveValue("Page note");
    await f.editor.locator('input[type="file"]').setInputFiles({ name: "edited.md", mimeType: "text/markdown", buffer: Buffer.from("Original text") });
    await f.editor.getByRole("textbox", { name: "File contents" }).fill("Edited UTF-8 café");
    await f.editor.getByRole("button", { name: "Plain text", exact: true }).click();
    await f.editor.getByRole("button", { name: "Save files", exact: true }).click();
    await expect(f.editor.locator(".file-progress")).toHaveText("1 file saved to Keepall.", { timeout: 30_000 });
    await f.library.reload(); const editedItems = await records(f.library);
    expect(editedItems).toHaveLength(2);
    expect(editedItems).toContainEqual(expect.objectContaining({ sourceFileName: "edited.txt", format: "text" }));
    expect(await documentHashes(f.library)).toContain(createHash("sha256").update("Edited UTF-8 café").digest("hex"));
  } finally { await f.dispose(); }
});

test("image picker and paste save a gallery, separate files, video and PDF without capturing the page", async () => {
  test.setTimeout(120_000); const f = await setup();
  try {
    const image = await png();
    await f.editor.locator('input[type="file"]').setInputFiles({ name: "one.png", mimeType: "image/png", buffer: image });
    await f.editor.getByRole("textbox", { name: "Caption (optional)" }).fill("# Gallery caption");
    await f.editor.getByRole("button", { name: "Markdown", exact: true }).click();
    await f.editor.locator("form").evaluate((form, data) => {
      const transfer = new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob(data), value => value.charCodeAt(0))], "pasted.png", { type: "image/png" }));
      form.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }));
    }, image.toString("base64"));
    await f.editor.getByRole("button", { name: "One image item", exact: true }).click();
    await expect(f.editor.getByRole("textbox", { name: "Caption (optional)" })).toHaveValue("# Gallery caption");
    await f.editor.getByRole("button", { name: "Save files", exact: true }).click();
    await expect(f.editor.locator(".file-progress")).toHaveText("2 files saved to Keepall.", { timeout: 30_000 });
    let items = await records(f.library); expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "image", caption: "# Gallery caption", captionFormat: "markdown", sourceUrl: "http://localhost:3200/files" });
    await f.editor.getByRole("button", { name: "Done", exact: true }).click(); await f.open();
    await f.editor.locator('input[type="file"]').setInputFiles([{ name: "separate-one.png", mimeType: "image/png", buffer: image }, { name: "separate-two.png", mimeType: "image/png", buffer: image }]);
    await f.editor.getByRole("button", { name: "Separate image items", exact: true }).click();
    await f.editor.getByRole("button", { name: "Save files", exact: true }).click();
    await expect(f.editor.locator(".file-progress")).toHaveText("2 files saved to Keepall.", { timeout: 30_000 });
    await f.editor.getByRole("button", { name: "Done", exact: true }).click(); await f.open();
    const titleStyle = await f.editor.getByRole("textbox", { name: "Title", exact: true }).evaluate(node => { const css = getComputedStyle(node); return { backgroundColor: css.backgroundColor, borderRadius: css.borderRadius, padding: css.padding, height: css.height }; });
    await f.editor.locator('input[type="file"]').setInputFiles(path.resolve("e2e/fixtures/tiny.mp4"));
    expect(await f.editor.getByRole("textbox", { name: "Video title" }).evaluate(node => { const css = getComputedStyle(node); return { backgroundColor: css.backgroundColor, borderRadius: css.borderRadius, padding: css.padding, height: css.height }; })).toEqual(titleStyle);
    await f.editor.getByRole("textbox", { name: "Video title" }).fill("Local clip");
    await f.editor.getByRole("textbox", { name: "Video note (optional)" }).fill("Video note");
    await f.editor.getByRole("button", { name: "Save files", exact: true }).click();
    await expect(f.editor.locator(".file-progress")).toHaveText("1 file saved to Keepall.", { timeout: 30_000 });
    await f.editor.getByRole("button", { name: "Done", exact: true }).click(); await f.open();
    await f.editor.locator('input[type="file"]').setInputFiles(path.resolve("public/marketing/demos/field-notes.pdf"));
    await f.editor.getByRole("button", { name: "Save files", exact: true }).click();
    await expect(f.editor.locator(".file-progress")).toHaveText("1 file saved to Keepall.", { timeout: 30_000 });
    await f.library.reload(); items = await records(f.library); expect(items).toHaveLength(5); expect(items.some(item => item.type === "link")).toBe(false);
    expect(items).toContainEqual(expect.objectContaining({ type: "video", title: "Local clip", noteContent: "Video note" }));
    expect(items).toContainEqual(expect.objectContaining({ type: "document", sourceFileName: "field-notes.pdf" }));
    expect(await documentHashes(f.library)).toContain(createHash("sha256").update(await readFile("public/marketing/demos/field-notes.pdf")).digest("hex"));
  } finally { await f.dispose(); }
});

test("busy shortcut preserves registration, cancellation settles, and a lost commit reply resumes once", async () => {
  test.setTimeout(90_000); const f = await setup();
  try {
    await f.worker.evaluate(() => {
      const scope = globalThis as typeof globalThis & { releaseChunk?: () => void; held?: boolean };
      const original = chrome.runtime.sendMessage.bind(chrome.runtime); let hold = true; let lose = true;
      chrome.runtime.sendMessage = async message => {
        if (message.type === "file-action" && message.operation === "chunk" && hold) { hold = false; scope.held = true; await new Promise<void>(resolve => { scope.releaseChunk = resolve; }); }
        const result = await original(message);
        if (message.type === "file-action" && message.operation === "commit" && lose) { lose = false; throw new Error("Simulated lost commit reply"); }
        return result;
      };
    });
    await f.editor.locator('input[type="file"]').setInputFiles({ name: "recover.txt", mimeType: "text/plain", buffer: Buffer.from("recover unchanged") });
    await f.editor.getByRole("button", { name: "Save files", exact: true }).click();
    await expect.poll(() => f.worker.evaluate(() => (globalThis as typeof globalThis & { held?: boolean }).held)).toBe(true);
    const editorId = () => f.worker.evaluate(async () => { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return (await chrome.storage.session.get(`file-editor:${tab.id}`))[`file-editor:${tab.id}`].editorId; });
    const registered = await editorId(); await f.open(); expect(await editorId()).toBe(registered);
    await expect(f.editor.getByRole("button", { name: "Close", exact: true })).toBeDisabled();
    await f.editor.getByRole("button", { name: "Cancel import", exact: true }).click();
    await f.worker.evaluate(() => (globalThis as typeof globalThis & { releaseChunk?: () => void }).releaseChunk?.());
    await expect(f.editor.locator(".file-progress")).toContainText("Import cancelled", { timeout: 30_000 });
    expect(await records(f.library)).toHaveLength(0);
    await f.editor.getByRole("button", { name: "Continue import", exact: true }).click();
    await expect(f.editor.locator(".file-capture").getByRole("alert")).toContainText("Simulated lost commit reply");
    await expect(f.editor.getByRole("button", { name: "Close", exact: true })).toBeDisabled();
    await f.editor.getByRole("button", { name: "Continue import", exact: true }).click();
    await expect(f.editor.locator(".file-progress")).toHaveText("1 file saved to Keepall.", { timeout: 30_000 });
    await f.library.reload(); expect(await records(f.library)).toHaveLength(1);
    await f.editor.getByRole("button", { name: "Open in Keepall", exact: true }).click();
    await expect(f.library).toHaveURL(/\/items\/[0-9a-f-]+\?from=%2F$/);
  } finally { await f.dispose(); }
});

test("partial results survive reopen and Bulk import preserves the draft and item tab", async () => {
  test.setTimeout(90_000); const f = await setup();
  try {
    await f.editor.locator('input[type="file"]').setInputFiles([{ name: "saved.txt", mimeType: "text/plain", buffer: Buffer.from("saved") }, { name: "invalid.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF") }]);
    await f.editor.getByRole("button", { name: "Save files", exact: true }).click();
    await expect(f.editor.locator(".file-progress")).toHaveText("1 of 2 files saved. Some files could not be saved.", { timeout: 30_000 });
    expect(await records(f.library)).toHaveLength(1);
    await expect(f.editor.locator(".file-row").filter({ hasText: "invalid.pdf" })).not.toContainText("Saved");
    await f.editor.getByRole("button", { name: "Done", exact: true }).click(); await f.open();
    await f.editor.getByRole("button", { name: "Open in Keepall", exact: true }).click();
    await expect(f.library).toHaveURL(/\/items\/[0-9a-f-]+\?from=%2F$/); const itemUrl = f.library.url();
    await f.page.bringToFront();
    const created = f.context.waitForEvent("page"); await f.editor.getByRole("button", { name: "Bulk import", exact: true }).click();
    const bulk = await created; await expect(bulk.getByRole("dialog", { name: "Bulk import" })).toBeVisible();
    await expect(bulk).toHaveURL(`${origin}/`); expect(f.library.url()).toBe(itemUrl);
    await f.page.bringToFront(); await f.editor.getByRole("button", { name: "Remove invalid.pdf" }).click();
    expect(await records(f.library)).toHaveLength(1);
  } finally { await f.dispose(); }
});
