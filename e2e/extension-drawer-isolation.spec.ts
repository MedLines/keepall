import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const origin = `http://localhost:${process.env.KEEPALL_E2E_PORT ?? "3100"}`;

async function openDrawerOnShortcutPage(page: Page) {
  await page.addInitScript(() => {
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      return attach.call(this, { ...options, mode: "open" });
    };
  });
  await page.setContent(`<!doctype html>
    <style>html { overflow-y: scroll } body { margin: 0; min-height: 6000px; overflow: auto } #page-action { position: fixed; top: 16px; left: 16px }</style>
    <button id="page-action">Page action</button><div style="height: 5000px">Timeline</div>`);
  const bridge = await page.evaluateHandle(() => {
    let listener: (message: Record<string, unknown>) => void;
    let lastSave: Record<string, unknown> | undefined;
    const keys: string[] = [];
    let clicks = 0;
    document.documentElement.style.setProperty("overflow", "auto", "important");
    document.body.style.setProperty("overflow", "auto", "important");
    document.querySelector("#page-action")!.addEventListener("click", () => clicks++);
    for (const target of [window, document]) {
      for (const type of ["keydown", "keypress", "keyup"]) {
        for (const capture of [true, false]) {
          target.addEventListener(type, (event) => {
            const key = (event as KeyboardEvent).key;
            keys.push(`${target === window ? "window" : "document"}:${type}:${capture}:${key}`);
            if (type === "keydown" && ["j", "k"].includes(key)) {
              event.preventDefault();
              window.scrollBy(0, key === "j" ? 100 : -100);
            }
          }, capture);
        }
      }
    }
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      return attach.call(this, { ...options, mode: "open" });
    };
    Object.assign(globalThis, { chrome: { runtime: {
      getURL: () => "data:font/woff2;base64,",
      onMessage: { addListener: (callback: typeof listener) => { listener = callback; } },
      sendMessage: (message: Record<string, unknown>) => { lastSave = message; },
    } } });
    (document.querySelector("#page-action") as HTMLButtonElement).focus();
    window.scrollTo(0, 400);
    return {
      send: (message: Record<string, unknown>) => listener(message),
      keys: () => [...keys],
      clicks: () => clicks,
      lastSave: () => lastSave,
    };
  });
  for (const file of ["org-picker.js", "page-ui.js"]) {
    await page.addScriptTag({ path: path.resolve("extension", file) });
  }
  await bridge.evaluate((value, origin) => value.send({
    type: "editor", url: "https://example.com/timeline", title: "Timeline", editorId: "isolation-editor", origin,
  }), origin);
  await bridge.evaluate((value) => value.send({
    type: "organizations", editorId: "isolation-editor",
    collections: Array.from({ length: 40 }, (_, index) => ({ id: `collection-${index}`, name: `Collection ${index}` })),
    tags: [{ id: "tag-jk", name: "jk reference" }],
    collectionId: null, tagIds: [],
  }));
  const host = page.locator("#keepall-capture-ui");
  const editor = await host.locator("iframe").count() ? host.frameLocator("iframe") : host;
  await expect(editor.getByRole("textbox", { name: "Your note (optional)" })).toBeVisible();
  return { bridge, editor, host };
}

test("drawer typing is isolated from host capture and bubble shortcuts", async ({ page }) => {
  const { bridge, editor } = await openDrawerOnShortcutPage(page);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  for (const name of ["Title", "Your note (optional)", "Filter or new collection", "Filter or create tag"]) {
    const input = editor.getByRole("textbox", { name, exact: true });
    await input.fill("");
    await input.pressSequentially("jkl");
    await expect(input).toHaveValue("jkl");
  }
  expect(await bridge.evaluate((value) => value.keys())).toEqual([]);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
});

test("drawer blocks background wheel scrolling and restores it when closed", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  const { bridge, editor, host } = await openDrawerOnShortcutPage(page);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.move(100, 250);
  await page.mouse.wheel(0, 600);
  // Let the browser process the wheel gesture before checking that the page stayed still.
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  const fields = editor.locator(".fields");
  await fields.hover();
  await page.mouse.wheel(0, 300);
  await expect.poll(() => fields.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await editor.getByRole("button", { name: "Close drawer", exact: true }).click();
  await expect(host.locator("dialog")).toHaveCount(0);
  await expect(page.locator("#page-action")).toBeFocused();
  expect(await page.evaluate(() => ({
    html: document.documentElement.style.overflow,
    body: document.body.style.overflow,
    htmlPriority: document.documentElement.style.getPropertyPriority("overflow"),
    bodyPriority: document.body.style.getPropertyPriority("overflow"),
  }))).toEqual({ html: "auto", body: "auto", htmlPriority: "important", bodyPriority: "important" });
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("#page-action").click();
  expect(await bridge.evaluate((value) => value.clicks())).toBe(1);
});

test("nested browse keeps shortcuts isolated and Escape restores page interaction after closing", async ({ page }) => {
  const { bridge, editor, host } = await openDrawerOnShortcutPage(page);
  const note = editor.getByRole("textbox", { name: "Your note (optional)" });
  await editor.getByRole("button", { name: "Browse all collections", exact: true }).click();
  const browse = editor.locator("dialog.browse");
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const results = browse.locator(".browse-results");
  await results.hover();
  await page.mouse.wheel(0, 300);
  await expect.poll(() => results.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  const search = browse.getByRole("searchbox", { name: "Search collections" });
  await search.pressSequentially("jkl");
  await expect(search).toHaveValue("jkl");
  await search.press("Escape");
  await expect(browse).toHaveCount(0);
  await expect(note).toBeVisible();
  await note.fill("");
  await note.pressSequentially("jkl");
  await expect(note).toHaveValue("jkl");
  expect(await bridge.evaluate((value) => value.keys())).toEqual([]);
  await note.press("Escape");
  await expect(host.locator("dialog")).toHaveCount(0);
  expect(await bridge.evaluate((value) => value.keys())).toEqual([]);
  const scrollAfterClosing = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("j");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollAfterClosing);
  await page.keyboard.press("l");
  const keys = await bridge.evaluate((value) => value.keys());
  for (const type of ["keydown", "keyup"]) {
    expect(keys).toContain(`window:${type}:true:j`);
    expect(keys).toContain(`document:${type}:true:j`);
    expect(keys).toContain(`document:${type}:false:j`);
    expect(keys).toContain(`window:${type}:false:j`);
  }
  for (const target of ["window", "document"]) {
    for (const capture of [true, false]) {
      expect(keys).toContain(`${target}:keypress:${capture}:l`);
    }
  }
});

test("collection and tag creation has explicit buttons and preserves the clicked selections", async ({ page }) => {
  const { bridge, editor } = await openDrawerOnShortcutPage(page);
  const collection = editor.getByRole("textbox", { name: "Filter or new collection", exact: true });
  const tag = editor.getByRole("textbox", { name: "Filter or create tag", exact: true });
  await collection.fill("Collection 0");
  await expect(editor.getByRole("button", { name: /^Create collection / })).toHaveCount(0);
  await tag.fill("jk reference");
  await expect(editor.getByRole("button", { name: /^Create tag / })).toHaveCount(0);

  await collection.fill("Research links");
  await editor.getByRole("button", { name: "Create collection “Research links”", exact: true }).click();
  await expect(collection).toHaveValue("");
  await expect(editor.getByRole("button", { name: "Research links", exact: true })).toHaveAttribute("aria-pressed", "true");
  await tag.fill("Read later");
  await editor.getByRole("button", { name: "Create tag “Read later”", exact: true }).click();
  await expect(tag).toHaveValue("");
  await expect(editor.getByRole("button", { name: "Remove tag Read later", exact: true })).toBeVisible();
  expect(await bridge.evaluate((value) => value.lastSave())).toBeUndefined();

  await collection.fill("Unfinished collection");
  await tag.fill("Unfinished tag");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Create collection “Unfinished collection”", exact: true })).toBeDisabled();
  await expect(editor.getByRole("button", { name: "Create tag “Unfinished tag”", exact: true })).toBeDisabled();
  expect(await bridge.evaluate((value) => value.lastSave())).toMatchObject({
    type: "save-from-editor", collectionId: null, collectionName: "Research links", tagIds: [], tagNames: ["Read later"],
  });
});

for (const modifier of ["Control", "Meta"]) {
  test(`${modifier}+Enter saves while textarea newlines and selection shortcuts stay native`, async ({ page }) => {
    const { bridge, editor } = await openDrawerOnShortcutPage(page);
    const note = editor.getByRole("textbox", { name: "Your note (optional)", exact: true });
    await note.pressSequentially("jkl");
    await note.press("Enter");
    await note.pressSequentially("Second line");
    await expect(note).toHaveValue("jkl\nSecond line");
    expect(await bridge.evaluate((value) => value.lastSave())).toBeUndefined();
    await note.press("Control+A");
    expect(await note.evaluate((node) => {
      const textarea = node as HTMLTextAreaElement;
      return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    })).toBe("jkl\nSecond line");
    await note.press("Control+C");
    await expect(note).toHaveValue("jkl\nSecond line");
    await note.press(`${modifier}+Enter`);
    expect(await bridge.evaluate((value) => value.lastSave())).toMatchObject({
      type: "save-from-editor", noteContent: "jkl\nSecond line", noteFormat: "plain",
    });
    expect(await bridge.evaluate((value) => value.keys())).toEqual([]);
  });
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 360, height: 740 }, { width: 1000, height: 440 }]) {
  for (const theme of ["light", "dark"] as const) {
    test(`drawer and Browse all remain usable at ${viewport.width}x${viewport.height} in ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const { bridge, editor } = await openDrawerOnShortcutPage(page);
      const longUrl = `https://example.com/${"long-source/".repeat(80)}`;
      await bridge.evaluate((value, { url, origin }) => value.send({ type: "editor", url, title: "Long source", editorId: "long-source", origin }), { url: longUrl, origin });
      await bridge.evaluate((value) => value.send({ type: "organizations", editorId: "long-source", collections: Array.from({ length: 40 }, (_, index) => ({ id: `collection-${index}`, name: `Collection ${index}` })), tags: [{ id: "t1", name: "Reference" }], tagIds: [] }));
      const drawer = editor.locator("dialog:not(.browse)");
      const footer = drawer.locator(".footer");
      await expect(drawer).toHaveCSS("animation-name", "none");
      await expect(drawer.locator(".description")).toHaveAttribute("title", longUrl);
      const headerBounds = (await drawer.locator(".header").boundingBox())!;
      const footerBounds = (await footer.boundingBox())!;
      expect(headerBounds.height).toBeLessThan(160);
      expect(footerBounds.y + footerBounds.height).toBeLessThanOrEqual(viewport.height);
      await expect(footer.getByRole("button")).toHaveText(["Close", "Save"]);
      const note = editor.getByRole("textbox", { name: "Your note (optional)" });
      await note.fill("A note\n".repeat(50));
      await note.press("End");
      await note.pressSequentially("jkl");
      await expect(note).toHaveValue(/jkl/);
      await editor.getByRole("textbox", { name: "Filter or create tag" }).fill("ref");
      await expect(editor.getByRole("button", { name: /Create tag/ })).toHaveCount(0);
      await editor.getByRole("textbox", { name: "Filter or create tag" }).press("Enter");
      await expect(editor.getByRole("button", { name: "Remove tag Reference" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`drawer-${theme}-${viewport.width}x${viewport.height}.png`) });
      await editor.getByRole("button", { name: "Browse all collections" }).click();
      const browse = editor.locator("dialog.browse");
      const bounds = (await browse.boundingBox())!;
      expect(bounds.height).toBeCloseTo(Math.min(viewport.height * .8, 576), 0);
      const search = browse.getByRole("searchbox");
      await expect(browse.locator(".browse-results")).toHaveCSS("--fade-top", "0px");
      await expect(browse.locator(".browse-results")).toHaveCSS("--fade-bottom", "12px");
      await search.fill("Collection 39");
      await expect(browse.locator(".browse-results")).toHaveCSS("--fade-bottom", "0px");
      expect(await browse.boundingBox()).toEqual(bounds);
      await search.fill("no match");
      expect(await browse.boundingBox()).toEqual(bounds);
      await search.fill("");
      const results = browse.locator(".browse-results");
      await results.hover();
      await page.mouse.wheel(0, 300);
      await expect.poll(() => results.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      await expect(results).toHaveCSS("--fade-top", "12px");
      await page.screenshot({ path: testInfo.outputPath(`browse-${theme}-${viewport.width}x${viewport.height}.png`) });
      await search.fill("Collection 39");
      await browse.getByRole("button", { name: "Collection 39", exact: true }).click();
      await expect(browse).toHaveCount(0);
      await expect(editor.getByRole("button", { name: "Browse all collections" })).toBeFocused();
      await expect(footer.getByRole("button", { name: "Save", exact: true })).toBeInViewport();
    });
  }
}
