import { test, expect, chromium, type Locator } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const origin = `http://localhost:${process.env.KEEPALL_E2E_PORT ?? "3100"}`;
declare const chrome: {
  storage: { local: { set(value: object): Promise<void> } };
  tabs: { query(value: object): Promise<Array<{ id: number; url: string }>> };
  scripting: { executeScript(value: object): Promise<unknown> };
};
declare function openEditor(tab: { id: number; url: string }): Promise<void>;
const controlProperties = ["backgroundColor", "color", "borderTopColor", "borderTopWidth", "borderRadius", "cornerShape", "fontFamily", "fontSize", "fontWeight", "lineHeight", "height", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "boxShadow"];
async function style(node: Locator, properties = controlProperties) {
  return node.evaluate((element, keys) => { const css = getComputedStyle(element); return Object.fromEntries(keys.map(key => [key, css[key as keyof CSSStyleDeclaration]])); }, properties);
}
async function same(app: Locator, extension: Locator, name: string, properties = controlProperties) {
  await expect.poll(async () => {
    const expected = await style(app, properties); const actual = await style(extension, properties);
    return Object.fromEntries(properties.filter(key => expected[key] !== actual[key]).map(key => [key, { app: expected[key], extension: actual[key] }]));
  }, { message: name }).toEqual({});
}
for (const theme of ["light", "dark"] as const) {
  test(`extension uses actual app controls and styles in ${theme}`, async ({}, info) => {
    test.setTimeout(90_000);
    const profile = await mkdtemp(path.join(tmpdir(), "keepall-parity-"));
    const extensionPath = path.resolve("extension");
    const context = await chromium.launchPersistentContext(profile, { channel: "chromium", headless: true, viewport: { width: 1280, height: 900 }, colorScheme: theme, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
    try {
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
      await worker.evaluate(value => chrome.storage.local.set(value), { origin, theme });
      const app = await context.newPage(); await app.goto(origin);
      await expect(app.getByRole("heading", { name: "Start your library", exact: true })).toBeVisible();
      await app.evaluate(() => new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("keepall"); request.onerror = () => reject(request.error);
        request.onsuccess = () => { const tx = request.result.transaction(["collections", "tags"], "readwrite");
          for (const [store, names] of [["collections", ["Reading", "Later"]], ["tags", ["Design", "Reference"]]] as const) for (const name of names) tx.objectStore(store).put({ id: name.toLowerCase(), name, createdAt: Date.now(), updatedAt: Date.now() });
          tx.oncomplete = () => { request.result.close(); resolve(); }; tx.onerror = () => reject(tx.error);
        };
      }));
      await app.reload();
      await app.evaluate(theme => { document.documentElement.dataset.theme = theme; window.dispatchEvent(new Event("keepall:open-capture")); }, theme);
      const drawer = app.getByRole("dialog", { name: "Save to Keepall", exact: true });
      await drawer.getByRole("textbox", { name: "Link, note, or image", exact: true }).fill("https://example.com/reference");
      await drawer.getByRole("textbox", { name: "Your note (optional)" }).fill("Preview text");
      const page = await context.newPage();
      await page.route("http://localhost:3200/design", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Reference</title><h1>Reference</h1>" }));
      await page.goto("http://localhost:3200/design");
      await worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
          const attach = Element.prototype.attachShadow;
          Element.prototype.attachShadow = function (options) { return attach.call(this, { ...options, mode: "open" }); };
        } });
        await openEditor(tab);
      });
      const frame = page.locator("#keepall-capture-ui").frameLocator("iframe");
      await expect(frame.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
      await frame.getByRole("textbox", { name: "Your note (optional)" }).fill("Preview text");
      await Promise.all([app.evaluate(() => document.fonts.ready), frame.locator("body").evaluate(node => node.ownerDocument.fonts.ready)]);
      await app.screenshot({ path: `/tmp/keepall-008-app-${theme}.png` });
      await page.screenshot({ path: `/tmp/keepall-008-extension-${theme}.png` });
      const pairs = [
        ["Save", "Save"], ["Cancel", "Close"], ["Close drawer", "Close drawer"], ["Add files", "Add files"], ["Bulk import", "Bulk import"], ["Plain text", "Plain text"], ["Markdown", "Markdown"], ["Edit", "Edit"], ["Preview", "Preview"],
      ];
      for (const [appName, extensionName] of pairs) await same(drawer.getByRole("button", { name: appName, exact: true }), frame.getByRole("button", { name: extensionName, exact: true }), appName);
      await same(drawer.locator(".icon-segmented-thumb").first(), frame.locator(".icon-segmented-thumb").first(), "Selected format thumb");
      await same(drawer.locator(".scroll-textarea").filter({ has: app.getByRole("textbox", { name: "Your note (optional)" }) }), frame.getByRole("textbox", { name: "Your note (optional)" }), "Personal note field");
      const settle = async (node: Locator) => node.evaluate(async element => { await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running" && Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {}))); });
      for (const [appName, extensionName] of pairs.slice(0, 5)) {
        const a = drawer.getByRole("button", { name: appName, exact: true }); const e = frame.getByRole("button", { name: extensionName, exact: true });
        await a.hover(); await settle(a); const hover = await style(a); await e.hover(); await settle(e);
        await expect.poll(() => style(e), { message: `${appName} hover` }).toEqual(hover);
        for (const button of [a, e]) await button.evaluate(node => { (node as HTMLButtonElement).disabled = true; });
        await Promise.all([settle(a), settle(e)]);
        await same(a, e, `${appName} disabled`, [...controlProperties, "opacity", "cursor"]);
        for (const button of [a, e]) await button.evaluate(node => { (node as HTMLButtonElement).disabled = false; });
      }
      const appNote = drawer.getByRole("textbox", { name: "Your note (optional)" });
      const extensionNote = frame.getByRole("textbox", { name: "Your note (optional)" });
      await appNote.focus();
      const focusedNote = await style(drawer.locator(".scroll-textarea").filter({ has: app.getByRole("textbox", { name: "Your note (optional)" }) }), ["outlineColor", "outlineWidth", "outlineOffset"]);
      await extensionNote.focus();
      await expect.poll(() => style(extensionNote, ["outlineColor", "outlineWidth", "outlineOffset"])).toEqual(focusedNote);
      await same(drawer.locator("header"), frame.locator(".header"), "Header", ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "gap"]);
      const backdropKeys = ["backgroundImage", "backdropFilter"];
      const appBackdrop = await style(app.locator(".ui-drawer-backdrop"), backdropKeys);
      const extensionBackdrop = await frame.locator(".keepall-drawer").evaluate((node, keys) => { const css = getComputedStyle(node, "::backdrop"); return Object.fromEntries(keys.map(key => [key, css[key as keyof CSSStyleDeclaration]])); }, backdropKeys);
      expect(extensionBackdrop).toEqual(appBackdrop);
      for (const label of ["Reading", "Design"]) {
        await drawer.getByRole("button", { name: label, exact: true }).click(); await frame.getByRole("button", { name: label, exact: true }).click();
      }
      await same(drawer.getByRole("button", { name: "Reading", exact: true }), frame.getByRole("button", { name: "Reading", exact: true }), "Selected collection");
      await same(drawer.getByRole("button", { name: "Remove tag Design", exact: true }).locator(".."), frame.locator(".selected-tag"), "Selected tag");
      await drawer.getByRole("button", { name: "Browse all collections" }).click(); await frame.getByRole("button", { name: "Browse all collections" }).click();
      const appBrowse = app.getByRole("dialog", { name: "Choose a collection" }); const extensionBrowse = frame.locator(".browse");
      await same(appBrowse, extensionBrowse, "Browse dialog");
      await same(appBrowse.getByRole("searchbox"), extensionBrowse.getByRole("searchbox"), "Browse search");
      await same(appBrowse.getByRole("button", { name: /^Reading/ }), extensionBrowse.getByRole("button", { name: /^Reading/ }), "Selected browse row");
      await appBrowse.getByRole("button", { name: "Close", exact: true }).click(); await extensionBrowse.getByRole("button", { name: "Close", exact: true }).click();
      await drawer.getByRole("button", { name: "Preview", exact: true }).click(); await frame.getByRole("button", { name: "Preview", exact: true }).click();
      await same(app.getByRole("region", { name: "Personal note preview" }).locator("p"), frame.locator(".note-plain"), "Plain preview text", ["fontSize", "fontWeight", "lineHeight", "whiteSpace", "overflowWrap", "color"]);
      for (const surface of [drawer, frame]) {
        await surface.getByRole("button", { name: "Edit", exact: true }).click();
        await surface.getByRole("textbox", { name: "Your note (optional)" }).fill("# Heading\n\n**Strong** [link](https://example.com)");
        await surface.getByRole("button", { name: "Markdown", exact: true }).click();
        await surface.getByRole("button", { name: "Preview", exact: true }).click();
      }
      await same(app.getByRole("region", { name: "Personal note preview" }).getByRole("heading", { name: "Heading" }), frame.getByRole("region", { name: "Your note (optional) preview" }).getByRole("heading", { name: "Heading" }), "Markdown heading", ["fontSize", "fontWeight", "lineHeight", "color"]);
      await drawer.getByRole("button", { name: "Edit", exact: true }).hover();
      const appTooltip = app.getByText("Edit notes", { exact: true });
      await expect(appTooltip).toBeVisible();
      const tooltipStyle = await style(appTooltip);
      await frame.getByRole("button", { name: "Edit", exact: true }).hover();
      const extensionTooltip = frame.getByText("Edit notes", { exact: true });
      await expect(extensionTooltip).toBeVisible();
      await expect.poll(() => style(extensionTooltip)).toEqual(tooltipStyle);
      expect(await extensionTooltip.evaluate(node => !!node.closest("dialog.keepall-drawer"))).toBe(true);
      await drawer.getByRole("button", { name: "Edit", exact: true }).click(); await frame.getByRole("button", { name: "Edit", exact: true }).click();
      for (const viewport of [{ width: 1280, height: 900 }, { width: 360, height: 740 }, { width: 1000, height: 440 }]) {
        await Promise.all([app.setViewportSize(viewport), page.setViewportSize(viewport)]);
        await app.screenshot({ path: info.outputPath(`app-${viewport.width}.png`) });
        await page.screenshot({ path: info.outputPath(`extension-${viewport.width}.png`) });
      }
      await Promise.all([app.setViewportSize({ width: 1280, height: 900 }), page.setViewportSize({ width: 1280, height: 900 })]);
      const selectedFiles = [
        { name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("First document") },
        { name: "second.md", mimeType: "text/markdown", buffer: Buffer.from("# Second document") },
      ];
      await drawer.locator('input[type="file"]').setInputFiles(selectedFiles);
      await frame.locator('input[type="file"]').setInputFiles(selectedFiles);
      for (const selector of [".file-details", ".file-progress", ".error", ".file-actions"]) await expect(frame.locator(".file-staging").locator(selector)).toBeHidden();
      const appFile = drawer.getByRole("listitem").filter({ hasText: "first.txt" });
      const extensionFile = frame.locator(".file-row").filter({ hasText: "first.txt" });
      await same(appFile, extensionFile, "File row");
      await same(appFile.locator("div").first(), extensionFile.locator(".file-icon"), "File icon container");
      await same(appFile.getByRole("button"), extensionFile.getByRole("button"), "Remove file");
      await app.screenshot({ path: info.outputPath("app-files.png") });
      await page.screenshot({ path: info.outputPath("extension-files.png") });
    } finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
  });
}
