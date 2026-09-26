import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";

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
  permissions: { contains(details: { origins: string[] }): Promise<boolean>; getAll(): Promise<{ origins?: string[] }>; remove(details: { origins: string[] }): Promise<boolean> };
};
declare function saveTab(tab: ExtensionTab, options?: { collectionId?: string; noteContent?: string; noteFormat?: "plain" | "markdown" }): Promise<void>;
declare function openEditor(tab: ExtensionTab): Promise<void>;
declare function saveContext(info: { menuItemId: string; mediaType?: string; srcUrl?: string; linkUrl?: string; pageUrl?: string }, tab: ExtensionTab): Promise<void> | undefined;
declare function imageSourceUrl(pageUrl: string, linkUrl?: string): string;
declare function keepallOrigin(): Promise<string>;

test("extension registers one direct menu action for images and links", async () => {
  const menus: Array<{ id: string; title: string; contexts: string[] }> = [];
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const event = (name: string) => ({
    addListener: (listener: (...args: unknown[]) => void) => listeners.set(name, listener),
  });
  let clears = 0;
  runInNewContext(await readFile(path.resolve("extension/worker.js"), "utf8"), {
    chrome: {
      storage: { local: { setAccessLevel: () => Promise.resolve() } },
      alarms: { create: () => Promise.resolve(), onAlarm: event("alarm") },
      runtime: { onInstalled: event("install"), onMessage: event("message") },
      contextMenus: {
        removeAll: (done: () => void) => { clears++; menus.length = 0; done(); },
        create: (menu: typeof menus[number]) => menus.push(menu),
        onClicked: event("menu"),
      },
      tabs: { onUpdated: event("tab"), onRemoved: event("tab-removed") },
      action: { onClicked: event("toolbar") },
      commands: { onCommand: event("command") },
    },
  });
  listeners.get("install")!();
  listeners.get("install")!();
  expect(clears).toBe(2);
  expect(menus).toEqual([expect.objectContaining({
    id: "save-to-keepall",
    title: "Save to Keepall",
    contexts: ["image", "link"],
  })]);
});

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
    const imageSources = await worker.evaluate(() => [
      imageSourceUrl("https://x.com/home", "https://x.com/designer/status/123456789/photo/2?s=20"),
      imageSourceUrl("https://x.com/designer", "/designer/status/234567890/photo/1"),
      imageSourceUrl("https://twitter.com/home", "https://twitter.com/designer/status/345678901/photo/1#image"),
      imageSourceUrl("https://x.com/designer/status/456789012/photo/3?s=20"),
      imageSourceUrl("https://x.com/home", "https://example.com/designer/status/123456789"),
      imageSourceUrl("https://x.com/home", "javascript:alert(1)"),
      imageSourceUrl("https://example.com/gallery", "https://x.com/designer/status/123456789"),
      imageSourceUrl("https://x.com/home"),
    ]);
    expect(imageSources).toEqual([
      "https://x.com/designer/status/123456789",
      "https://x.com/designer/status/234567890",
      "https://x.com/designer/status/345678901",
      "https://x.com/designer/status/456789012",
      "https://x.com/home",
      "https://x.com/home",
      "https://example.com/gallery",
      "https://x.com/home",
    ]);

    await worker.evaluate(() => chrome.storage.local.set({ origin: "https://keepall.app" }));
    expect(await worker.evaluate(() => keepallOrigin())).toBe("https://www.keepall.app");

    const options = await context.newPage();
    await options.goto(await worker.evaluate(() => chrome.runtime.getURL("options.html")));
    await expect(options.getByLabel("Keepall address")).toHaveValue("https://www.keepall.app");
    await expect(options.getByRole("region", { name: "Image saving" })).toBeVisible();
    await expect(options.getByText("Your current choice. No setup needed.", { exact: true })).toBeVisible();
    await expect(options.getByRole("button", { name: "Allow access to all websites", exact: true })).toBeEnabled();
    const imageGuide = options.getByRole("region", { name: "Image saving", exact: true });
    expect(await imageGuide.locator("h3, h4").allTextContents()).toEqual([
      "1. Right-click an image",
      "2. Allow access to that website",
      "Allow each website as you need it",
      "Want frictionless saving on every website?",
      "What this means for your privacy",
      "Change or remove website access",
    ]);
    await expect(imageGuide.locator("details")).toHaveCount(0);
    const contextMenu = options.locator('img[src="image-context-menu.png"]');
    await expect(contextMenu).toBeVisible();
    expect(await contextMenu.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const warning = options.locator('img[src="permission-all-websites.png"]');
    await expect(warning).toBeVisible();
    expect(await warning.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const singleWebsite = options.locator('img[src="permission-one-website.png"]');
    await expect(singleWebsite).toBeVisible();
    expect(await singleWebsite.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const permissions = await worker.evaluate(() => chrome.permissions.getAll());
    expect(permissions.origins).not.toContain("https://*/*");
    expect(permissions.origins).not.toContain("http://*/*");
    expect(permissions.origins).not.toContain("*://*/*");
    await options.setViewportSize({ width: 375, height: 812 });
    expect(await options.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await expect(options.getByRole("link", { name: "Open library" })).toHaveAttribute("href", "https://www.keepall.app/");
    await options.getByLabel("Keepall address").fill("https://keepall.app");
    await options.getByRole("button", { name: "Save address" }).click();
    await expect(options.locator("#status")).toHaveText("Address saved.");
    await expect(options.getByLabel("Keepall address")).toHaveValue("https://www.keepall.app");
    expect(await worker.evaluate(() => keepallOrigin())).toBe("https://www.keepall.app");
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("Options shows the actual shortcut and refreshes after Chrome changes", async ({}, testInfo) => {
  const profile = await mkdtemp(path.join(tmpdir(), "keepall-extension-shortcut-"));
  const extensionPath = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    const options = await context.newPage();
    const errors: string[] = [];
    options.on("pageerror", (error) => errors.push(error.message));
    await options.goto(await worker.evaluate(() => chrome.runtime.getURL("options.html")));
    const card = options.getByRole("region", { name: "Keyboard shortcut", exact: true });
    const value = card.locator("#shortcut-value");
    const getShortcut = () => worker.evaluate(async () => (await chrome.commands.getAll()).find(({ name }) => name === "open-editor")?.shortcut);
    await expect(value).toHaveText((await getShortcut())!);
    await card.scrollIntoViewIfNeeded();
    const initialHeight = (await card.boundingBox())!.height;
    const [settings] = await Promise.all([
      context.waitForEvent("page"),
      card.getByRole("button", { name: "Change shortcut", exact: true }).click(),
    ]);
    await expect(settings).toHaveURL("chrome://extensions/shortcuts");
    const shortcutInput = settings.getByRole("textbox", { name: "Shortcut Open Keepall capture on this page for Keepall Capture", exact: true });
    await settings.getByRole("button", { name: "Edit shortcut Open Keepall capture on this page for Keepall Capture", exact: true }).click();
    await shortcutInput.press("Control+Shift+Y");
    await expect.poll(getShortcut).toBe("Ctrl+Shift+Y");
    await options.bringToFront();
    await expect(value).toHaveText("Ctrl+Shift+Y");
    await options.emulateMedia({ colorScheme: "light" });
    await card.screenshot({ path: testInfo.outputPath("shortcut-assigned-light.png") });

    await settings.bringToFront();
    await settings.getByRole("button", { name: "Clear", exact: true }).last().click();
    await expect.poll(getShortcut).toBe("");
    await options.bringToFront();
    await expect(card.getByText("No shortcut set", { exact: true })).toBeVisible();
    await expect(value).toBeHidden();
    expect((await card.boundingBox())!.height).toBe(initialHeight);
    await options.setViewportSize({ width: 375, height: 812 });
    await options.emulateMedia({ colorScheme: "dark" });
    await card.screenshot({ path: testInfo.outputPath("shortcut-unassigned-dark.png") });
    expect(await options.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    await options.evaluate(() => {
      chrome.commands.getAll = async () => { throw new Error("Test API failure"); };
      window.dispatchEvent(new Event("focus"));
    });
    await expect(card.getByText("Could not check your shortcut", { exact: true })).toBeVisible();
    await expect(card.getByText("No shortcut set", { exact: true })).toBeHidden();
    await options.reload();
    await expect(card.getByText("No shortcut set", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("Chrome access management preserves library recovery and saving", async () => {
  test.setTimeout(60_000);
  const profile = await mkdtemp(path.join(tmpdir(), "keepall-extension-revoke-"));
  const extensionPath = path.resolve("extension");
  const launch = () => chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let context = await launch();
  const initialWorker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const extensionId = await initialWorker.evaluate(() => chrome.runtime.id);
  await context.close();
  // Seed prior approval because headless Chrome cannot accept a native prompt.
  // All permission operations below still use Chrome's real API.
  const preferencesPath = path.join(profile, "Default", "Preferences");
  const preferences = JSON.parse(await readFile(preferencesPath, "utf8"));
  const extension = preferences.extensions.settings[extensionId];
  const approvedHosts = ["*://*/*"];
  extension.active_permissions.explicit_host = approvedHosts;
  extension.granted_permissions.explicit_host = approvedHosts;
  extension.runtime_granted_permissions = { api: [], explicit_host: approvedHosts, manifest_permissions: [], scriptable_host: [] };
  await writeFile(preferencesPath, JSON.stringify(preferences));
  context = await launch();
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.local.set({ origin: "http://localhost:3100" }));
    const library = await context.newPage();
    await library.goto("http://localhost:3100/");
    const options = await context.newPage();
    await options.goto(await worker.evaluate(() => chrome.runtime.getURL("options.html")));
    await expect(options.locator("#image-access-remove")).toHaveCount(0);
    await expect(options.getByRole("button", { name: "Access to all websites enabled" })).toBeDisabled();
    const [management] = await Promise.all([
      context.waitForEvent("page"),
      options.getByRole("button", { name: "Manage access in Chrome" }).click(),
    ]);
    await expect.poll(() => management.url()).toBe(`chrome://extensions/?id=${extensionId}`);
    await management.close();
    const source = await context.newPage();
    await source.goto("http://localhost:3100/help");
    const save = (url: string) => worker.evaluate(async (linkUrl) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", linkUrl }, tab);
      return chrome.action.getTitle({ tabId: tab.id });
    }, url);
    expect(await save("https://example.com/after-revoke")).toBe("Link saved to Keepall");
    await expect(library.locator(".library-card")).toHaveCount(1);
    const sourceTab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
    await worker.evaluate(() => chrome.permissions.remove({ origins: ["*://*/*"] }));
    await worker.evaluate((tab) => {
      void saveContext({ menuItemId: "save-to-keepall", linkUrl: "https://example.com/missing-connection" }, tab);
    }, sourceTab);
    await expect.poll(() => worker.evaluate((tabId) => chrome.action.getTitle({ tabId }), sourceTab.id)).toContain("Library access is missing");
    await expect(library.locator(".library-card")).toHaveCount(1);
    await options.reload();
    await expect(options.getByRole("button", { name: "Restore library access" })).toBeVisible();
    await options.getByRole("button", { name: "Restore library access" }).click();
    await expect(options.getByRole("button", { name: "Restore library access" })).toBeHidden();
    await source.bringToFront();
    expect(await save("https://example.com/after-reconnect")).toBe("Link saved to Keepall");
    await expect(library.locator(".library-card")).toHaveCount(2);
    const imageMessage = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", mediaType: "image", srcUrl: "http://localhost:3100/icons/icon-192.png" }, tab);
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(imageMessage).toBe("Image saved to Keepall");
    await expect(library.locator(".library-card")).toHaveCount(3);
    expect(await worker.evaluate(() => chrome.permissions.contains({ origins: ["*://*/*"] }))).toBe(false);
    await expect(options.getByRole("button", { name: "Allow access to all websites", exact: true })).toBeEnabled();

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
    await expect(options.locator("#status")).toHaveText("Address saved.");
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
    expect(first).toBe("Link saved to Keepall");
    await expect(source.locator("#keepall-capture-ui .toast.is-visible")).toContainText("Link saved to Keepall");
    await expect(openLibrary.getByText("Example article", { exact: true })).toBeVisible();
    await expect(source.locator("#keepall-capture-ui .toast")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    await expect(source.locator("#keepall-capture-ui .toast-card")).toHaveCSS("border-radius", "32px");
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
    await editor.getByRole("button", { name: "Close drawer" }).click();
    await expect(editor.locator("dialog")).toHaveCount(0);
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await openEditor(tab);
    });
    await expect(editor.getByText("Draft restored", { exact: true })).toBeVisible();
    await expect(editor.getByRole("textbox", { name: "Title" })).toHaveValue("Chosen title");
    await expect(editor.getByRole("textbox", { name: "Your note (optional)" })).toHaveValue("# Read for layout ideas");
    await expect(editor.getByRole("checkbox", { name: "Markdown" })).toBeChecked();
    await expect(editor.getByRole("button", { name: "Reading", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(editor.getByRole("button", { name: "Remove tag Design" })).toBeVisible();
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
    await expect(editor.getByText("Draft restored", { exact: true })).toHaveCount(0);
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


test("save notifications open the item and undo only new captures", async ({}, testInfo) => {
  const profile = await mkdtemp(path.join(tmpdir(), "keepall-extension-actions-"));
  const extensionPath = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.local.set({ origin: "http://localhost:3100" }));
    const library = await context.newPage();
    await library.goto("http://localhost:3100/");
    await expect(library.getByText("No items yet.", { exact: true })).toBeVisible();
    const source = await context.newPage();
    await source.route("http://localhost:3100/action-article", (route) => route.fulfill({
      contentType: "text/html", body: "<!doctype html><title>Action article</title><h1>Article</h1>",
    }));
    await source.goto("http://localhost:3100/action-article");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (options) { return attach.call(this, { ...options, mode: "open" }); };
      } });
    });
    const save = () => worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveTab(tab);
    });
    const toast = source.locator("#keepall-capture-ui .toast");
    await save();
    await expect(toast.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    await expect(library.getByText("Action article", { exact: true })).toBeVisible();
    for (const colorScheme of ["light", "dark"] as const) {
      await source.emulateMedia({ colorScheme });
      await source.setViewportSize({ width: 320, height: 640 });
      await expect(toast).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
      await expect(toast.getByRole("button", { name: "Open in Keepall" })).toBeInViewport();
      const bounds = await toast.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
      const card = await toast.locator(".toast-card").boundingBox();
      const actions = await toast.getByRole("group", { name: "Save actions" }).boundingBox();
      expect(actions!.y).toBeGreaterThan(card!.y + card!.height);
      await expect(toast.locator(".toast-card .toast-action")).toHaveCount(0);
      await expect(toast.locator(".toast-action svg")).toHaveCount(3);
      await source.screenshot({ path: testInfo.outputPath(`save-actions-${colorScheme}.png`) });
    }
    await toast.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(toast).toContainText("Save undone");
    await expect(library.getByText("No items yet.", { exact: true })).toBeVisible();

    await save();
    await save();
    await expect(toast).toContainText("This link was already saved");
    await expect(toast.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);
    await library.evaluate(() => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("collections", "readwrite");
        for (const [id, name] of [["reading", "Reading"], ["inspiration", "Inspiration"]]) {
          tx.objectStore("collections").put({ id, name, createdAt: Date.now(), pinnedItemIds: [] });
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    }));
    await toast.getByRole("button", { name: "Organize", exact: true }).click();
    const picker = toast.getByRole("dialog", { name: "Move to collection" });
    await expect(picker.getByRole("button", { name: "Unsorted", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(picker.getByRole("searchbox")).toBeFocused();
    await picker.getByRole("searchbox").fill("missing collection");
    await expect(picker).toContainText("No collections found");
    await picker.getByRole("searchbox").fill("");
    for (const colorScheme of ["light", "dark"] as const) {
      await source.emulateMedia({ colorScheme });
      await source.screenshot({ path: testInfo.outputPath(`organize-${colorScheme}.png`), animations: "disabled" });
      const bounds = await picker.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    }
    await picker.getByRole("searchbox").press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(toast.getByRole("button", { name: "Organize", exact: true })).toBeFocused();
    await toast.getByRole("button", { name: "Organize", exact: true }).click();
    await picker.getByRole("searchbox").fill("read");
    await picker.getByRole("button", { name: "Reading", exact: true }).click();
    await expect(picker).toHaveCount(0);
    await expect(toast).toContainText("Moved to Reading");
    await toast.getByRole("button", { name: "Organize", exact: true }).click();
    await expect(picker.getByRole("button", { name: "Reading", exact: true })).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "Unsorted", exact: true }).click();
    await expect(toast).toContainText("Moved to Unsorted");
    const pageCount = context.pages().length;
    await toast.getByRole("button", { name: "Open in Keepall" }).click();
    await expect(library).toHaveURL(/localhost:3100\/items\/[0-9a-f-]+\?from=%2F$/);
    await expect(library.getByRole("heading", { name: "Action article", level: 1 })).toBeVisible();
    await expect(library.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/");
    expect(context.pages()).toHaveLength(pageCount);
    // Reuse that same tab after it has navigated into the detail page.
    await source.bringToFront();
    await save();
    await toast.getByRole("button", { name: "Open in Keepall" }).click();
    await expect(library).toHaveURL(/localhost:3100\/items\/[0-9a-f-]+\?from=%2F$/);
    expect(context.pages()).toHaveLength(pageCount);

    // Image undo also cleans its stored bytes without touching the saved link.
    await source.bringToFront();
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", mediaType: "image", srcUrl: "http://localhost:3100/icons/icon-192.png" }, tab);
    });
    await expect(toast).toContainText("Image saved to Keepall");
    await toast.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(toast).toContainText("Save undone");
    const stored = await library.evaluate(() => new Promise<{ types: string[]; assets: number }>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["items", "assets"], "readonly");
        const items = tx.objectStore("items").getAll();
        const assets = tx.objectStore("assets").count();
        tx.oncomplete = () => { db.close(); resolve({ types: items.result.map((item) => item.type), assets: assets.result }); };
        tx.onerror = () => reject(tx.error);
      };
    }));
    expect(stored).toEqual({ types: ["link"], assets: 0 });
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", mediaType: "image", srcUrl: "http://localhost:3100/icons/icon-192.png" }, tab);
    });
    await expect(toast.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    await toast.getByRole("button", { name: "Organize", exact: true }).click();
    await picker.getByRole("button", { name: "Inspiration", exact: true }).click();
    await expect(toast).toContainText("Moved to Inspiration");
    await expect(toast.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);
    await toast.getByRole("button", { name: "Organize", exact: true }).click();
    await expect(picker.getByRole("button", { name: "Inspiration", exact: true })).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "Close collections" }).click();
    await library.close();
    await source.bringToFront();
    await save();
    const newLibrary = context.waitForEvent("page");
    await toast.getByRole("button", { name: "Open in Keepall" }).click();
    const opened = await newLibrary;
    await expect(opened).toHaveURL(/localhost:3100\/items\/[0-9a-f-]+\?from=%2F$/);
    await expect(opened.getByRole("heading", { name: "Action article", level: 1 })).toBeVisible();
    await expect(opened.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/");
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("extension saves a right-clicked image to the local library", async () => {
  test.setTimeout(60_000);
  const profile = await mkdtemp(path.join(tmpdir(), "keepall-extension-image-"));
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
    const grantedOrigins = await worker.evaluate(() => chrome.permissions.getAll());
    expect(grantedOrigins.origins).not.toContain("https://*/*");
    expect(grantedOrigins.origins).not.toContain("http://*/*");
    expect(grantedOrigins.origins).not.toContain("*://*/*");
    const library = await context.newPage();
    await library.goto("http://localhost:3100/");
    await expect(library.getByText("No items yet.", { exact: true })).toBeVisible();

    const source = await context.newPage();
    await source.route("http://localhost:3100/test-image-source", (route) => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><title>Image source</title><img alt="Keepall logo" src="/icons/icon-192.png">',
    }));
    await source.goto("http://localhost:3100/test-image-source");
    await expect(source.getByRole("img", { name: "Keepall logo" })).toBeVisible();
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (this: Element, options: ShadowRootInit) {
          return attach.call(this, { ...options, mode: "open" });
        };
      } });
    });
    const imageUrl = "http://localhost:3100/icons/icon-192.png";

    const first = await worker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", mediaType: "image", srcUrl: url, linkUrl: "https://destination.example/linked-image" }, tab);
      return chrome.action.getTitle({ tabId: tab.id });
    }, imageUrl);
    expect(first).toBe("Image saved to Keepall");
    await expect(source.locator("#keepall-capture-ui .toast.is-visible")).toContainText("Image saved to Keepall");
    await expect(library.locator(".library-card")).toHaveCount(1);

    const item = await library.evaluate(() => new Promise<{ type: string; sourceUrl: string; assetIds: string[]; bytes: number }>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["items", "assets"], "readonly");
        const itemsRequest = tx.objectStore("items").getAll();
        itemsRequest.onsuccess = () => {
          const image = itemsRequest.result[0];
          const assetRequest = tx.objectStore("assets").get(image.assetIds[0]);
          assetRequest.onsuccess = () => resolve({
            type: image.type,
            sourceUrl: image.sourceUrl,
            assetIds: image.assetIds,
            bytes: assetRequest.result.bytes.byteLength,
          });
          assetRequest.onerror = () => reject(assetRequest.error);
        };
        itemsRequest.onerror = () => reject(itemsRequest.error);
      };
    }));
    expect(item).toMatchObject({
      type: "image",
      sourceUrl: "http://localhost:3100/test-image-source",
    });
    expect(item.bytes).toBeGreaterThan(0);

    const second = await worker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", mediaType: "image", srcUrl: url, linkUrl: "https://destination.example/linked-image" }, tab);
      return chrome.action.getTitle({ tabId: tab.id });
    }, imageUrl);
    expect(second).toBe("This image was already saved");
    await expect(library.locator(".library-card")).toHaveCount(1);

    const unsupported = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", mediaType: "image", srcUrl: "http://localhost:3100/icon.svg", linkUrl: "https://destination.example/unsupported-image" }, tab);
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(unsupported).toContain("PNG, JPEG, GIF, WebP, or AVIF");
    await expect(source.locator("#keepall-capture-ui .toast.is-visible"))
      .toContainText("PNG, JPEG, GIF, WebP, or AVIF");
    await expect(library.locator(".library-card")).toHaveCount(1);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("extension saves a clicked link destination without opening it", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "keepall-extension-link-menu-"));
  const extensionPath = path.resolve("extension");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.local.set({ origin: "http://localhost:3100" }));
    const library = await context.newPage();
    await library.goto("http://localhost:3100/");
    const source = await context.newPage();
    await source.route("http://localhost:3100/link-source", (route) => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><title>Source page title</title><a href="https://destination.example/article?ref=feed">An article to save</a>',
    }));
    await source.goto("http://localhost:3100/link-source");
    const destination = await source.getByRole("link", { name: "An article to save" }).getAttribute("href");
    const save = () => worker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", linkUrl: url }, tab);
      return chrome.action.getTitle({ tabId: tab.id });
    }, destination!);
    expect(await save()).toBe("Link saved to Keepall");
    expect(source.url()).toBe("http://localhost:3100/link-source");
    await expect(library.locator(".library-card")).toHaveCount(1);
    const saved = await library.evaluate(() => new Promise<{ url: string; title: string; collectionIds: string[] }>((resolve, reject) => {
      const request = indexedDB.open("keepall");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const items = db.transaction("items", "readonly").objectStore("items").getAll();
        items.onsuccess = () => { resolve(items.result[0]); db.close(); };
        items.onerror = () => { reject(items.error); db.close(); };
      };
    }));
    expect(saved.url).toBe(destination);
    expect(saved.title).not.toBe("Source page title");
    expect(saved.collectionIds).toEqual([]);
    expect(await save()).toBe("This link was already saved");
    await expect(library.locator(".library-card")).toHaveCount(1);
    const invalid = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await saveContext({ menuItemId: "save-to-keepall", linkUrl: "javascript:alert(1)" }, tab);
      return chrome.action.getTitle({ tabId: tab.id });
    });
    expect(invalid).toBe("This link cannot be saved to Keepall.");
    await expect(library.locator(".library-card")).toHaveCount(1);
    const permissions = await worker.evaluate(() => chrome.permissions.getAll());
    expect(permissions.origins).not.toContain("https://*/*");
    expect(permissions.origins).not.toContain("https://destination.example/*");
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("extension drafts stay isolated, survive failed saves, and can be discarded", async ({ page }, testInfo) => {
  await page.route("http://localhost:3100/draft-fixture", (route) => route.fulfill({
    contentType: "text/html", body: "<!doctype html><title>Draft fixture</title>",
  }));
  await page.goto("http://localhost:3100/draft-fixture");
  const bridge = await page.evaluateHandle(() => {
    let listener: (message: Record<string, unknown>) => void;
    let lastSave: unknown;
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      return attach.call(this, { ...options, mode: "open" });
    };
    Object.assign(globalThis, { chrome: { runtime: {
      getURL: (file: string) => `http://localhost:3100/${file}`,
      onMessage: { addListener: (callback: typeof listener) => { listener = callback; } },
      sendMessage: (message: unknown) => { lastSave = message; },
    } } });
    return {
      send: (message: Record<string, unknown>) => listener(message),
      lastSave: () => lastSave,
    };
  });
  for (const file of ["org-picker.js", "page-ui.js"]) {
    await page.addScriptTag({ content: await readFile(path.resolve("extension", file), "utf8") });
  }
  const editor = page.locator("#keepall-capture-ui");
  const note = editor.getByRole("textbox", { name: "Your note (optional)" });
  const snapshot = { id: "saved-link", title: "Saved title", noteContent: "Saved note", noteFormat: "plain", collectionIds: [], tagIds: [] };
  const organizations = { type: "organizations", collections: [], tags: [], existingLink: snapshot, collectionId: null, tagIds: [] };
  let editorId = "";
  const open = async (url = "https://example.com/article", origin = "http://localhost:3100", load = true) => {
    editorId = crypto.randomUUID();
    await bridge.evaluate((value, message) => value.send(message), { type: "editor", url, origin, title: "Page title", editorId });
    if (load) await bridge.evaluate((value, message) => value.send(message), { ...organizations, editorId });
  };
  const close = async (name = "Close") => {
    await editor.getByRole("button", { name, exact: true }).click();
    await expect(editor.locator("dialog")).toHaveCount(0);
  };

  await open();
  await note.fill("# Unfinished note");
  await editor.getByRole("checkbox", { name: "Markdown" }).check();
  await editor.getByRole("textbox", { name: "Filter or new collection" }).fill("New collection");
  await editor.getByRole("textbox", { name: "Filter or new collection" }).press("Enter");
  await editor.getByRole("textbox", { name: "Filter or create tag" }).fill("New tag");
  await editor.getByRole("textbox", { name: "Filter or create tag" }).press("Enter");
  await note.press("Escape");
  await expect(editor.locator("dialog")).toHaveCount(0);
  await open("https://example.com/other");
  await expect(note).toHaveValue("Saved note");
  await expect(editor.getByText("Draft restored", { exact: true })).toHaveCount(0);
  await close();
  await open(undefined, "https://www.keepall.app");
  await expect(note).toHaveValue("Saved note");
  await close();

  await open();
  await expect(note).toHaveValue("# Unfinished note");
  await expect(editor.getByRole("checkbox", { name: "Markdown" })).toBeChecked();
  await expect(editor.getByRole("button", { name: "New collection", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByRole("button", { name: "Remove tag New tag" })).toBeVisible();
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 375, height: 812 });
    await editor.locator("dialog").evaluate(async (node) => {
      await Promise.all(node.getAnimations().map((animation) => animation.finished));
    });
    await expect(editor.getByRole("button", { name: "Discard draft" })).toBeInViewport();
    await expect(editor.getByRole("button", { name: "Save changes" })).toBeInViewport();
    expect(await editor.locator("dialog").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`restored-draft-${colorScheme}.png`) });
  }
  await close("Close drawer");
  await open(undefined, undefined, false);
  await expect(note).toHaveValue("# Unfinished note");
  await bridge.evaluate((value, message) => value.send(message), { type: "organization-error", editorId });
  await expect(editor.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await close();

  // A newer library note must not replace the original conflict-check snapshot.
  organizations.existingLink = { ...snapshot, noteContent: "Newer library note" };
  await open();
  await editor.getByRole("button", { name: "Save changes" }).click();
  expect(await bridge.evaluate((value) => value.lastSave())).toMatchObject({
    noteContent: "# Unfinished note", noteFormat: "markdown", existingLink: snapshot,
    collectionName: "New collection", tagNames: ["New tag"],
  });
  await bridge.evaluate((value, message) => value.send(message), {
    type: "editor-feedback", editorId, success: false, message: "This link changed in Keepall.",
  });
  await close();
  await open();
  await expect(note).toHaveValue("# Unfinished note");
  await close("Discard draft");
  await open();
  await expect(note).toHaveValue("Newer library note");
  await expect(editor.getByText("Draft restored", { exact: true })).toHaveCount(0);
  await close();
  await open();
  await expect(editor.getByText("Draft restored", { exact: true })).toHaveCount(0);

  await editor.getByRole("textbox", { name: "Filter or new collection" }).fill("Temporary collection");
  await editor.getByRole("textbox", { name: "Filter or new collection" }).press("Enter");
  await close();
  await open();
  await editor.getByRole("button", { name: "Unsorted", exact: true }).click();
  await close();
  await open();
  await expect(editor.getByText("Draft restored", { exact: true })).toHaveCount(0);

  // Edits made before the library responds also survive closing.
  await close();
  await open(undefined, undefined, false);
  await note.fill("Typed while loading");
  await close();
  await open();
  await expect(note).toHaveValue("Typed while loading");
  await editor.getByRole("button", { name: "Save changes" }).click();
  expect(await bridge.evaluate((value) => value.lastSave())).toMatchObject({ existingLink: organizations.existingLink });
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
