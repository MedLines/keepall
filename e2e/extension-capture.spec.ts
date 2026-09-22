import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type ExtensionTab = { id: number; url?: string; title?: string };
declare const chrome: {
  storage: { local: { set(values: Record<string, string>): Promise<void> } };
  runtime: { getURL(path: string): string };
  tabs: { query(query: { active: boolean; currentWindow: boolean }): Promise<ExtensionTab[]> };
  action: { getTitle(details: { tabId: number }): Promise<string> };
  commands: { getAll(): Promise<Array<{ name: string; shortcut: string }>> };
};
declare function saveTab(tab: ExtensionTab): Promise<void>;
declare function openEditor(tab: ExtensionTab): Promise<void>;

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

    const source = await context.newPage();
    await source.route("http://localhost:3100/test-article", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Example article</title><h1>Article outside Keepall</h1>",
    }));
    await source.goto("http://localhost:3100/test-article");

    const first = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveTab(tab);
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(first).toBe("Saved to Keepall");
    expect(await source.locator("#keepall-capture-ui").count()).toBe(1);
    expect(context.pages().some((page) => page.url().includes("/extension-bridge"))).toBe(false);

    const second = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveTab(tab);
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(second).toBe("Already in Keepall");
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

    const editorPage = await context.newPage();
    await editorPage.route("https://keepall.app/note-article", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Note article</title><h1>Another page</h1>",
    }));
    await editorPage.goto("https://keepall.app/note-article");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await openEditor(tab);
    });
    await expect(editorPage.locator("#keepall-capture-ui")).toBeAttached();
    await editorPage.keyboard.type("Chosen title");
    await editorPage.keyboard.press("Tab");
    await editorPage.keyboard.type("Read for layout ideas");
    await editorPage.keyboard.press("Tab");
    await editorPage.keyboard.press("Tab");
    await editorPage.keyboard.press("Space");
    await editorPage.keyboard.press("Tab");
    await editorPage.keyboard.press("Tab");
    await editorPage.keyboard.press("Space");
    await editorPage.keyboard.press("Control+Enter");
    await expect.poll(() => worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return chrome.action.getTitle({ tabId: tab.id });
    })).toBe("Saved to Keepall");
    await editorPage.close();

    const newNamesPage = await context.newPage();
    await newNamesPage.route("https://keepall.app/new-name-article", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>New names article</title><h1>New names</h1>",
    }));
    await newNamesPage.goto("https://keepall.app/new-name-article");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await openEditor(tab);
    });
    await newNamesPage.keyboard.type("New names article");
    await newNamesPage.keyboard.press("Tab");
    await newNamesPage.keyboard.press("Tab");
    await newNamesPage.keyboard.press("Tab");
    await newNamesPage.keyboard.press("Tab");
    await newNamesPage.keyboard.type("New collection");
    await newNamesPage.keyboard.press("Enter");
    await newNamesPage.keyboard.press("Tab");
    await newNamesPage.keyboard.press("Tab");
    await newNamesPage.keyboard.type("New tag");
    await newNamesPage.keyboard.press("Enter");
    await newNamesPage.keyboard.press("Control+Enter");
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
      url: "https://keepall.app/note-article",
      title: "Chosen title",
      noteContent: "Read for layout ideas",
      collectionIds: ["collection-reading"],
      tagIds: ["tag-design"],
    }));
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
      url: "https://keepall.app/new-name-article",
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
  await page.getByRole("button", { name: "Browse all collections" }).click();
  await page.getByRole("searchbox", { name: "Search collections" }).fill("Collection 8");
  await page.getByRole("button", { name: "Collection 8" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Filter or create tag" }).fill("New tag");
  await page.getByRole("textbox", { name: "Filter or create tag" }).press("Enter");

  expect(await picker.evaluate((value) => value.selection())).toMatchObject({
    collectionId: "collection-7",
    tagNames: ["New tag"],
  });
});
