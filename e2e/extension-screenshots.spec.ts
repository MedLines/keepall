import { test, expect, chromium, type Page } from "@playwright/test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const port = process.env.KEEPALL_E2E_PORT ?? "3100";
const origin = `http://localhost:${port}`;

type ExtensionTab = { id: number; url?: string; title?: string };
declare const chrome: {
  storage: { local: { set(values: Record<string, string>): Promise<void> } };
  tabs: { query(query: { active: boolean; currentWindow: boolean }): Promise<ExtensionTab[]> };
  scripting: { executeScript(options: { target: { tabId: number }; func: () => void }): Promise<unknown> };
  action: { getTitle(details: { tabId: number }): Promise<string> };
};
declare function saveTab(tab: ExtensionTab, options?: Record<string, unknown>): Promise<void>;
declare function saveContext(info: Record<string, unknown>, tab: ExtensionTab): Promise<void> | undefined;

type StoredLink = { url: string; screenshots?: { assetId: string; width: number; height: number }[] };

/** Reads links and samples each screenshot's top-right corner, where the toast sits on the page. */
async function storedLinks(library: Page) {
  return library.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = <T,>(store: string) => new Promise<T[]>((resolve) => {
      const request = db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
    });
    const links = (await all<StoredLink & { type: string }>("items")).filter((item) => item.type === "link");
    const assets = new Map((await all<{ id: string; bytes: Uint8Array; mimeType: string }>("assets")).map((asset) => [asset.id, asset]));
    db.close();
    return Promise.all(links.map(async (link) => ({
      url: link.url,
      shots: await Promise.all((link.screenshots ?? []).map(async (shot) => {
        const asset = assets.get(shot.assetId)!;
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(asset.bytes)], { type: asset.mimeType }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        const [r, g, b] = context.getImageData(bitmap.width - 40, 40, 1, 1).data;
        return { mimeType: asset.mimeType, width: shot.width, height: shot.height, decoded: [bitmap.width, bitmap.height], corner: [r, g, b] };
      })),
    })));
  });
}

test("toast and page menu add screenshots of the visible page without Keepall's own UI", async () => {
  test.setTimeout(90_000);
  const profile = await mkdtemp(path.join(tmpdir(), "keepall-screenshot-"));
  // A real toolbar or menu click grants activeTab, which Playwright cannot perform. This copy holds
  // <all_urls> instead so captureVisibleTab is allowed; the manifest key keeps the extension ID.
  const extensionPath = path.join(profile, "extension");
  await cp(path.resolve("extension"), extensionPath, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(extensionPath, "manifest.json"), "utf8"));
  manifest.host_permissions.push("<all_urls>");
  await writeFile(path.join(extensionPath, "manifest.json"), JSON.stringify(manifest));
  const context = await chromium.launchPersistentContext(path.join(profile, "user-data"), {
    channel: "chromium",
    headless: true,
    viewport: { width: 1000, height: 700 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await worker.evaluate((value) => chrome.storage.local.set({ origin: value }), origin);

    const library = await context.newPage();
    await library.goto(`${origin}/`);
    await expect(library.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();

    const source = await context.newPage();
    for (const route of ["design-site", "second-site", "dialog-site"]) {
      await source.route(`${origin}/${route}`, (request) => request.fulfill({
        contentType: "text/html",
        body: `<!doctype html><title>${route}</title><body style="margin:0;background:rgb(220,30,30);height:3000px"><h1>${route}</h1><a href="${origin}/linked-page">Linked page</a>${route === "dialog-site" ? "<style>dialog::backdrop { background: transparent }</style><dialog id='lightbox'><p>Photo</p></dialog><script>document.getElementById('lightbox').showModal()</script>" : ""}</body>`,
      }));
    }
    await source.goto(`${origin}/design-site`);
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (this: Element, options: ShadowRootInit) {
          return attach.call(this, { ...options, mode: "open" });
        };
      } });
      await saveTab(tab);
    });

    const toast = source.locator("iframe[data-keepall-toast-frame]").contentFrame().locator(".toast.is-visible");
    await expect(toast).toContainText("Link saved to Keepall");
    const screenshot = toast.getByRole("button", { name: "Add screenshot" });
    await expect(screenshot).toBeVisible();
    const actionsBox = await toast.locator(".toast-actions").boundingBox();
    expect(actionsBox!.height).toBeLessThan(40);

    await screenshot.click();
    await expect(toast).toContainText("Screenshot added");
    await source.mouse.wheel(0, 900);
    await screenshot.click();
    await expect(toast).toContainText("Screenshot added (2)");

    let [saved] = await storedLinks(library);
    expect(saved.url).toBe(`${origin}/design-site`);
    expect(saved.shots).toHaveLength(2);
    for (const shot of saved.shots) {
      expect(["image/webp", "image/png"]).toContain(shot.mimeType);
      expect(shot.decoded).toEqual([shot.width, shot.height]);
      expect(shot.width).toBeLessThanOrEqual(2000);
      // The page background, not the toast that was on screen when the button was clicked.
      expect(shot.corner[0]).toBeGreaterThan(200);
      expect(shot.corner[1]).toBeLessThan(60);
    }

    // A right-clicked link is not the page on screen, so it offers no screenshot.
    await worker.evaluate(async (linkUrl) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", linkUrl, pageUrl: tab.url }, tab);
    }, `${origin}/linked-page`);
    await expect(toast).toContainText("Link saved to Keepall");
    await expect(toast.getByRole("button", { name: "Add screenshot" })).toHaveCount(0);

    // The page menu saves and captures in one step.
    await source.goto(`${origin}/second-site`);
    const title = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-page-with-screenshot", pageUrl: tab.url }, tab);
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(title).toBe("Page and screenshot saved");
    saved = (await storedLinks(library)).find((link) => link.url === `${origin}/second-site`)!;
    expect(saved.shots).toHaveLength(1);

    // Under a page's modal dialog the notice sits inside that dialog, outside our host, and must be hidden too.
    await source.goto(`${origin}/dialog-site`);
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveTab(tab);
    });
    const dialogFrame = source.locator("dialog#lightbox iframe[data-keepall-toast-frame]").contentFrame();
    await expect(dialogFrame.locator(".toast.is-visible")).toContainText("Link saved to Keepall");
    await dialogFrame.getByRole("button", { name: "Add screenshot" }).click();
    await expect(dialogFrame.locator(".toast")).toContainText("Screenshot added");
    saved = (await storedLinks(library)).find((link) => link.url === `${origin}/dialog-site`)!;
    expect(saved.shots).toHaveLength(1);
    expect(saved.shots[0].corner[0]).toBeGreaterThan(200);
    expect(saved.shots[0].corner[1]).toBeLessThan(60);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
