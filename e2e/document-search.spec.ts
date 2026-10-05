import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function seed(page: Page, documents: { id: string; title: string; text?: string }[]) {
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.evaluate(async documents => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["items", "documentAssets"], "readwrite");
        for (const document of documents) {
          const assetId = `original-${document.id}`;
          tx.objectStore("items").put({ id: document.id, type: "document", format: "text", title: document.title, sourceFileName: `${document.id}.txt`, assetId, noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 });
          if (document.text !== undefined) {
            const bytes = new TextEncoder().encode(document.text);
            tx.objectStore("documentAssets").put({ id: assetId, bytes, byteLength: bytes.length, contentHash: assetId, createdAt: 1 });
          }
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, documents);
  await page.reload();
  await expect(page.locator("[data-item-id]")).toHaveCount(documents.length);
}

test("imported file contents produce highlighted results through filters, editing, reload and Trash", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("No items yet.", { exact: true })).toBeVisible();
  await page.keyboard.press("Alt+k");
  const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  const chooser = page.waitForEvent("filechooser");
  await capture.getByRole("button", { name: "Add files", exact: true }).click();
  await (await chooser).setFiles([
    { name: "reference.md", mimeType: "text/markdown", buffer: Buffer.from("# Chapter\n\n" + "Padding paragraph.\n".repeat(2_000) + "Unicorn animation examples مرحبا café") },
    { name: "other.txt", mimeType: "text/plain", buffer: Buffer.from("Different file contents") },
  ]);
  await capture.getByRole("textbox", { name: "Collection", exact: true }).fill("Reading");
  await capture.getByRole("textbox", { name: "Collection", exact: true }).press("Enter");
  await capture.getByRole("textbox", { name: "Tags", exact: true }).fill("Research");
  await capture.getByRole("textbox", { name: "Tags", exact: true }).press("Enter");
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
  await expect(page.locator("[data-item-id]")).toHaveCount(2);

  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  await search.fill("UNICORN");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt")).toContainText("File contents:");
  await expect(page.locator(".search-excerpt mark")).toHaveText("Unicorn");
  const id = await page.locator("[data-item-id]").getAttribute("data-item-id");
  await page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: "Reading", exact: true }).click();
  await search.fill('reference "animation examples" research');
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.getByText("Searching file contents…", { exact: true })).toBeHidden();
  await expect(page.locator(".search-excerpt")).toBeVisible();
  await expect(page.locator(".search-excerpt mark")).toHaveText("animation examples");
  await search.fill("مرحبا CAFÉ");
  await expect(page.locator(".search-excerpt mark")).toHaveText(["مرحبا", "café"]);
  await expect(page).toHaveURL(/q=/);
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("مرحبا CAFÉ");
  const collectionUrl = page.url();
  const params = new URL(collectionUrl).searchParams;
  params.set("layout", "list");
  params.set("type", "note");
  await page.goto(`/?${params}`);
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt mark")).toHaveText(["مرحبا", "café"]);
  await page.screenshot({ path: testInfo.outputPath("document-content-search-list.png") });

  await page.locator(".library-list-row").hover();
  await page.getByRole("button", { name: "Actions for reference", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit document", exact: true });
  await editor.getByRole("textbox", { name: "Markdown content", exact: true }).fill("# Replacement\nNewkeyword content");
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.locator("[data-item-id]")).toHaveCount(0);
  await search.fill("newkeyword");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt mark")).toHaveText("Newkeyword");
  await expect(page).toHaveURL(/q=newkeyword/);
  await page.reload();
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator("[data-item-id]")).toHaveAttribute("data-item-id", id!);
  await expect(page.locator(".search-excerpt mark")).toHaveText("Newkeyword");
  await page.getByRole("link", { name: "Open reference", exact: true }).last().click();
  await page.getByRole("button", { name: "Move document to Trash", exact: true }).click();
  await page.getByRole("dialog", { name: "Move this document to Trash?" }).getByRole("button", { name: "Move to Trash", exact: true }).click();
  await page.goto("/?trash=1&q=newkeyword");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt mark")).toHaveText("Newkeyword");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.goto("/?q=newkeyword");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator("[data-item-id]")).toHaveAttribute("data-item-id", id!);
  await expect(page.locator(".search-excerpt mark")).toHaveText("Newkeyword");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Close navigation", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sidebar navigation", exact: true })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("document-content-search-mobile.png") });
  expect(errors).toEqual([]);
});

test("large originals search in a worker and rapid queries keep only the newest results", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const workerUrls: string[] = [];
  page.on("worker", worker => workerUrls.push(worker.url()));
  // Five originals exceed the worker's decoded-text cache capacity.
  await seed(page, Array.from({ length: 5 }, (_, index) => ({ id: `large-${index}`, title: `Large reference ${index}`, text: "İ" + "Padding paragraph.\n".repeat(350_000) + `Late token ${index} مرحبا` })));
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  const started = Date.now();
  await search.fill("obsolete");
  await search.fill('"late token"');
  await search.fill('"late token" 3');
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator("[data-item-id]")).toHaveAttribute("data-item-id", "large-3");
  await expect(page.locator(".search-excerpt")).toContainText("Late token 3");
  expect(workerUrls).toHaveLength(1);
  await search.fill("مرحبا");
  await expect(page.locator("[data-item-id]")).toHaveCount(5);
  await expect(page.getByText("Searching file contents…", { exact: true })).toBeHidden();
  await search.fill('"late token" 1');
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator("[data-item-id]")).toHaveAttribute("data-item-id", "large-1");
  await testInfo.attach("large-search-timing", { body: `Five 6.3 MB originals; initial rapid search plus two subsequent queries: ${Date.now() - started} ms`, contentType: "text/plain" });
});

test("refining document searches keeps existing results mounted and in place", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const delayedEvents = new WeakSet<Event>();
    window.Worker = class extends NativeWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        this.addEventListener("message", event => {
          if (delayedEvents.has(event)) return;
          event.stopImmediatePropagation();
          const delayed = new MessageEvent("message", { data: event.data });
          delayedEvents.add(delayed);
          // Make the pending state observable even with cached, tiny originals.
          setTimeout(() => this.dispatchEvent(delayed), 750);
        });
      }
    };
  });
  await seed(page, [
    { id: "reference", title: "Reading material", text: "Unicorn animation examples" },
    { id: "replacement", title: "Another reference", text: "Replacement subject" },
  ]);
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  const result = page.locator('[data-item-id="reference"]');
  await search.fill("unicorn");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(result.locator(".search-excerpt mark")).toHaveText("Unicorn");
  await expect(page.getByText("Searching file contents…", { exact: true })).toBeHidden();
  const originalNode = await result.elementHandle();
  expect(originalNode).not.toBeNull();
  const originalBounds = await result.boundingBox();
  expect(originalBounds).not.toBeNull();

  await search.fill("unicorn animation");
  await expect(page.getByText("Searching file contents…", { exact: true })).toBeVisible();
  expect(await originalNode!.evaluate(node => node.isConnected)).toBe(true);
  const pendingBounds = await result.boundingBox();
  expect(pendingBounds).not.toBeNull();
  expect(pendingBounds!.y).toBeCloseTo(originalBounds!.y, 0);
  await expect(result.locator(".search-excerpt mark")).toHaveText(["Unicorn", "animation"]);
  await expect(page.getByText("Searching file contents…", { exact: true })).toBeHidden();
  expect(await originalNode!.evaluate(node => node.isConnected)).toBe(true);

  await search.fill("replacement");
  await expect(page.locator('[data-item-id="replacement"]')).toBeVisible();
  await expect(result).toHaveCount(0);
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await expect(page.locator(".search-excerpt mark")).toHaveText("Replacement");
});

test("missing originals leave title search usable and Retry search recovers restored text", async ({ page }) => {
  await seed(page, [{ id: "missing", title: "Findable title" }]);
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  await search.fill("findable");
  await expect(page.getByRole("main")).toContainText("1 file couldn't be searched");
  await expect(page.locator("[data-item-id]")).toHaveCount(1);
  await page.evaluate(async () => {
    const request = indexedDB.open("keepall");
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result); });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("documentAssets", "readwrite");
        const bytes = new TextEncoder().encode("Restored findable body");
        tx.objectStore("documentAssets").put({ id: "original-missing", bytes, byteLength: bytes.length, contentHash: "restored", createdAt: 1 });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.getByRole("button", { name: "Retry search", exact: true }).click();
  await expect(page.getByText(/1 file couldn't be searched/)).toBeHidden();
  await search.fill("restored");
  await expect(page.locator(".search-excerpt mark")).toHaveText("Restored");
});
