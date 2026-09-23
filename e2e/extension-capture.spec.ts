import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type ExtensionTab = { id: number; url?: string; title?: string };
declare const chrome: {
  storage: { local: { set(values: Record<string, string>): Promise<void> } };
  runtime: { id: string; getURL(path: string): string };
  tabs: {
    query(query: { active: boolean; currentWindow: boolean }): Promise<ExtensionTab[]>;
    setZoom(tabId: number, zoomFactor: number): Promise<void>;
  };
  scripting: { executeScript(options: { target: { tabId: number }; func: () => void }): Promise<unknown> };
  action: { getTitle(details: { tabId: number }): Promise<string> };
  commands: { getAll(): Promise<Array<{ name: string; shortcut: string }>> };
};
declare function saveTab(tab: ExtensionTab, options?: { collectionId?: string; noteContent?: string; noteFormat?: "plain" | "markdown" }): Promise<void>;
declare function openEditor(tab: ExtensionTab): Promise<void>;
declare function keepallOrigin(): Promise<string>;

test("extension uses the canonical production library address", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "keepall-extension-origin-"));
  const extensionPath = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    expect(await worker.evaluate(() => chrome.runtime.id)).toBe("ehloefgfecmfjbncknaoleakbnjhkpea");
    expect(await worker.evaluate(() => keepallOrigin())).toBe("https://www.keepall.app");

    await worker.evaluate(() => chrome.storage.local.set({ origin: "https://keepall.app" }));
    expect(await worker.evaluate(() => keepallOrigin())).toBe("https://www.keepall.app");

    const options = await context.newPage();
    await options.goto(await worker.evaluate(() => chrome.runtime.getURL("options.html")));
    await expect(options.getByLabel("Keepall address")).toHaveValue("https://www.keepall.app");
    await expect(options.getByRole("link", { name: "Open library" })).toHaveAttribute("href", "https://www.keepall.app/");
    await options.getByLabel("Keepall address").fill("https://keepall.app");
    await options.getByRole("button", { name: "Save address" }).click();
    await expect(options.getByRole("status")).toHaveText("Address saved.");
    await expect(options.getByLabel("Keepall address")).toHaveValue("https://www.keepall.app");
    expect(await worker.evaluate(() => keepallOrigin())).toBe("https://www.keepall.app");
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("extension saves and edits links through the hidden Keepall bridge", async () => {
  test.setTimeout(60_000);
  const profile = await mkdtemp(path.join(tmpdir(), "keepall-extension-"));
  const extensionPath = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.local.set({ origin: "http://localhost:3100" }));
    expect(await worker.evaluate(() => chrome.commands.getAll())).toContainEqual(
      expect.objectContaining({ name: "open-editor", shortcut: "Alt+K" }),
    );

    const options = await context.newPage();
    await options.goto(await worker.evaluate(() => chrome.runtime.getURL("options.html")));
    await expect(options.getByRole("heading", { name: "Capture settings" })).toBeVisible();
    await expect(options.getByRole("region", { name: "Library address" })).toBeVisible();
    await options.getByLabel("Keepall address").fill("http://localhost:3100");
    await options.getByRole("button", { name: "Save address" }).click();
    await expect(options.getByRole("status")).toHaveText("Address saved.");
    await expect(options.getByRole("link", { name: "Open library" })).toHaveAttribute("href", "http://localhost:3100/");
    await options.close();

    const openLibrary = await context.newPage();
    await openLibrary.goto("http://localhost:3100/");
    await expect(openLibrary.getByText("No items yet.", { exact: true })).toBeVisible();

    const source = await context.newPage();
    await source.route("http://localhost:3100/test-article", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Example article</title><h1>Article outside Keepall</h1>",
    }));
    await source.goto("http://localhost:3100/test-article");
    await source.setViewportSize({ width: 320, height: 640 });
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (this: Element, options: ShadowRootInit) {
          return attach.call(this, { ...options, mode: "open" });
        };
      } });
    });

    const first = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveTab(tab);
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(first).toBe("Saved to Keepall");
    await expect(source.locator("#keepall-capture-ui .toast.is-visible")).toContainText("Saved to Keepall");
    await expect(openLibrary.getByText("Example article", { exact: true })).toBeVisible();
    await expect(source.locator("#keepall-capture-ui .toast")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    await expect(source.locator("#keepall-capture-ui .toast")).toHaveCSS("border-radius", "28px");
    const toastBounds = await source.locator("#keepall-capture-ui .toast").boundingBox();
    expect(toastBounds).not.toBeNull();
    expect(toastBounds!.x).toBeGreaterThanOrEqual(0);
    expect(toastBounds!.x + toastBounds!.width).toBeLessThanOrEqual(320);
    await source.emulateMedia({ colorScheme: "dark" });
    expect(await source.locator("#keepall-capture-ui").count()).toBe(1);
    expect(context.pages().some((page) => page.url().includes("/extension-bridge"))).toBe(false);

    const second = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveTab(tab);
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(second).toBe("This link was already saved");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveTab(tab, { noteContent: "First note" });
    });
    const conflict = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveTab(tab, { noteContent: "Different note" });
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(conflict).toContain("already has a personal note");
    await expect(source.locator("#keepall-capture-ui .toast.is-visible")).toContainText("already has a personal note");
    await expect(source.locator("#keepall-capture-ui .toast")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    await source.close();

    const organizationSetup = await context.newPage();
    await organizationSetup.goto("http://localhost:3100/");
    await organizationSetup.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("keepall");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(["collections", "tags"], "readwrite");
        tx.objectStore("collections").put({ id: "collection-reading", name: "Reading", createdAt: Date.now(), pinnedItemIds: [] });
        tx.objectStore("tags").put({ id: "tag-design", name: "Design", createdAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      database.close();
    });
    await organizationSetup.close();

    const movedPage = await context.newPage();
    await movedPage.route("http://localhost:3100/test-article", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Example article</title><h1>Article outside Keepall</h1>",
    }));
    await movedPage.goto("http://localhost:3100/test-article");
    const moved = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveTab(tab, { collectionId: "collection-reading" });
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(moved).toBe("Moved to Reading");
    await movedPage.close();

    const editorPage = await context.newPage();
    await editorPage.route("http://localhost:3200/note-article", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Note article</title><h1>Another page</h1>",
    }));
    await editorPage.goto("http://localhost:3200/note-article");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (this: Element, options: ShadowRootInit) {
          return attach.call(this, { ...options, mode: "open" });
        };
      } });
      await openEditor(tab);
    });
    const editor = editorPage.locator("#keepall-capture-ui");
    await expect(editor).toBeAttached();
    await editor.getByRole("textbox", { name: "Title" }).fill("Chosen title");
    await editor.getByRole("textbox", { name: "Your note (optional)" }).fill("# Read for layout ideas");
    await editor.getByRole("checkbox", { name: "Markdown" }).check();
    await editor.getByRole("button", { name: "Reading", exact: true }).click();
    await editor.getByRole("button", { name: "Design", exact: true }).click();
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return chrome.action.getTitle({ tabId: tab.id });
    })).toBe("Saved to Keepall");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await openEditor(tab);
    });
    await expect(editor.getByRole("heading", { name: "Edit saved link" })).toBeVisible();
    await expect(editor.getByRole("textbox", { name: "Title" })).toHaveValue("Chosen title");
    await expect(editor.getByRole("textbox", { name: "Your note (optional)" })).toHaveValue("# Read for layout ideas");
    await expect(editor.getByRole("checkbox", { name: "Markdown" })).toBeChecked();
    await editorPage.setViewportSize({ width: 320, height: 640 });
    await editorPage.locator("#keepall-capture-ui dialog").evaluate(async (dialog) => {
      await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
    });
    await editorPage.emulateMedia({ colorScheme: "light" });
    await expect(editor.getByRole("button", { name: "Save changes" })).toBeVisible();
    const drawer = editor.locator("dialog");
    const drawerBounds = await drawer.boundingBox();
    expect(drawerBounds).not.toBeNull();
    expect(drawerBounds!.x).toBeGreaterThanOrEqual(0);
    expect(drawerBounds!.x + drawerBounds!.width).toBeLessThanOrEqual(320);
    const lightBackground = await drawer.evaluate((node) => getComputedStyle(node).backgroundColor);
    await editorPage.emulateMedia({ colorScheme: "dark" });
    expect(await drawer.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(lightBackground);
    await editorPage.setViewportSize({ width: 640, height: 720 });
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.setZoom(tab.id, 2);
    });
    await expect(editor.getByRole("button", { name: "Save changes" })).toBeVisible();
    const fields = editor.locator(".fields");
    expect(await fields.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await fields.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await expect(editor.getByRole("button", { name: "Browse all tags" })).toBeInViewport();
    await fields.evaluate((node) => { node.scrollTop = 0; });
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.setZoom(tab.id, 1);
    });
    await editorPage.setViewportSize({ width: 1280, height: 720 });
    await editorPage.emulateMedia({ colorScheme: "light" });
    await editor.getByRole("textbox", { name: "Title" }).fill("Revised title");
    await editor.getByRole("textbox", { name: "Your note (optional)" }).fill("# Revised note");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect.poll(() => worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return chrome.action.getTitle({ tabId: tab.id });
    })).toBe("Your changes were saved");
    for (const [noteFormat, expectedTitle] of [["plain", "Your changes were saved"], ["markdown", "Your changes were saved"]] as const) {
      const feedback = await worker.evaluate(async ({ noteFormat }) => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await saveTab(tab, { noteContent: "# Revised note", noteFormat });
        return chrome.action.getTitle({ tabId: tab.id });
      }, { noteFormat });
      expect(feedback).toBe(expectedTitle);
    }
    await editorPage.close();

    const newNamesPage = await context.newPage();
    await newNamesPage.route("http://localhost:3200/new-name-article", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>New names article</title><h1>New names</h1>",
    }));
    await newNamesPage.goto("http://localhost:3200/new-name-article");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (this: Element, options: ShadowRootInit) {
          return attach.call(this, { ...options, mode: "open" });
        };
      } });
      await openEditor(tab);
    });
    const newNamesEditor = newNamesPage.locator("#keepall-capture-ui");
    await newNamesEditor.getByRole("textbox", { name: "Title" }).fill("New names article");
    await newNamesEditor.getByRole("textbox", { name: "Filter or new collection" }).fill("New collection");
    await newNamesEditor.getByRole("textbox", { name: "Filter or new collection" }).press("Enter");
    await newNamesEditor.getByRole("textbox", { name: "Filter or create tag" }).fill("New tag");
    await newNamesEditor.getByRole("textbox", { name: "Filter or create tag" }).press("Enter");
    await newNamesEditor.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return chrome.action.getTitle({ tabId: tab.id });
    })).toBe("Saved to Keepall");
    await newNamesPage.close();

    const library = await context.newPage();
    await library.goto("http://localhost:3100/");
    const items = await library.evaluate(() => new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const read = request.result.transaction("items", "readonly").objectStore("items").getAll();
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      };
    }));
    expect(items).toHaveLength(3);
    expect(items).toContainEqual(expect.objectContaining({
      url: "http://localhost:3200/note-article",
      title: "Revised title",
      noteContent: "# Revised note",
      noteFormat: "markdown",
      collectionIds: ["collection-reading"],
      tagIds: ["tag-design"],
    }));
    const markdownLink = items.find((item) => item.url === "http://localhost:3200/note-article");
    expect(typeof markdownLink?.id).toBe("string");
    await library.goto(`http://localhost:3100/items/${markdownLink?.id}`);
    await expect(library.getByRole("heading", { name: "Revised note", level: 2 })).toBeVisible();

    const namedOrganization = await library.evaluate(() => new Promise<{
      collections: Array<{ id: string; name: string }>;
      tags: Array<{ id: string; name: string }>;
    }>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction(["collections", "tags"], "readonly");
        const collectionRequest = tx.objectStore("collections").getAll();
        const tagRequest = tx.objectStore("tags").getAll();
        tx.oncomplete = () => resolve({ collections: collectionRequest.result, tags: tagRequest.result });
        tx.onerror = () => reject(tx.error);
      };
    }));
    const newCollection = namedOrganization.collections.find((entry) => entry.name === "New collection");
    const newTag = namedOrganization.tags.find((entry) => entry.name === "New tag");
    expect(newCollection).toBeDefined();
    expect(newTag).toBeDefined();
    expect(items).toContainEqual(expect.objectContaining({
      url: "http://localhost:3200/new-name-article",
      collectionIds: [newCollection?.id],
      tagIds: [newTag?.id],
    }));
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("extension picker browses the full list and accepts new names", async ({ page }) => {
  await page.setContent("<div id='picker-host'></div>");
  await page.addScriptTag({ path: "extension/org-picker.js" });
  const picker = await page.evaluateHandle(() => {
    const host = document.querySelector("#picker-host") as HTMLElement;
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ".choices{display:flex;flex-wrap:wrap;gap:4px;width:180px}.choice{min-height:28px;padding:4px 8px}.choice[hidden]{display:none}";
    shadow.append(style);
    const createPicker = (globalThis as typeof globalThis & {
      __keepallCreateOrgPicker: (root: ShadowRoot) => {
        element: HTMLElement;
        load: (message: unknown) => void;
        selection: () => { collectionId: string | null; tagNames: string[] };
      };
    }).__keepallCreateOrgPicker;
    const result = createPicker(shadow);
    shadow.append(result.element);
    result.load({
      type: "organizations",
      collections: Array.from({ length: 8 }, (_, index) => ({ id: `collection-${index}`, name: `Collection ${index + 1}` })),
      tags: [],
      collectionId: null,
      tagIds: [],
    });
    return result;
  });

  await expect(page.getByRole("button", { name: "Browse all collections" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Collection 8" })).toHaveCount(0);
  const rows = await page.locator(".choices").first().locator("button:visible").evaluateAll((chips) =>
    new Set(chips.map((chip) => chip.getBoundingClientRect().top)).size,
  );
  expect(rows).toBeLessThanOrEqual(2);
  await page.getByRole("button", { name: "Browse all collections" }).click();
  await page.getByRole("searchbox", { name: "Search collections" }).fill("Collection 8");
  await page.getByRole("button", { name: "Collection 8" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".choices").first().getByRole("button").nth(0)).toHaveText("Collection 8");
  await expect(page.locator(".choices").first().getByRole("button").nth(1)).toHaveText("Unsorted");
  await page.getByRole("textbox", { name: "Filter or create tag" }).fill("New tag");
  await page.getByRole("textbox", { name: "Filter or create tag" }).press("Enter");

  expect(await picker.evaluate((value) => value.selection())).toMatchObject({
    collectionId: "collection-7",
    tagNames: ["New tag"],
  });
});
