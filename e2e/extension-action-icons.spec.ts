import { expect, test } from "@playwright/test";
import path from "node:path";

test("extension Organize uses the app icon and still opens its collection and tag picker", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const capture = page.getByRole("dialog", { name: "Save to Keepall", exact: true });
  await capture.getByRole("textbox", { name: "Link, note, or image", exact: true }).fill("Icon consistency");
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await expect(capture).toBeHidden();
  await page.locator(".library-card").hover();
  await page.getByRole("button", { name: "Actions for Icon consistency", exact: true }).click();
  const appPaths = await page.getByRole("menuitem", { name: "Organize", exact: true }).locator("path").evaluateAll(paths => paths.map(node => node.getAttribute("d")));
  await page.goto("about:blank");
  await page.setContent("<h1>Extension notification test</h1>");
  const bridge = await page.evaluateHandle(() => {
    let listener: (message: Record<string, unknown>) => void;
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) { return attach.call(this, { ...options, mode: "open" }); };
    Object.assign(globalThis, { chrome: { runtime: {
      getURL: () => "data:font/woff2;base64,",
      onMessage: { addListener: (callback: typeof listener) => { listener = callback; } },
      sendMessage: async () => ({ success: true, collections: [{ id: "reading", name: "Reading" }], tags: [{ id: "reference", name: "Reference" }, { id: "research", name: "Research" }], collectionIds: [], tagIds: [] }),
    } } });
    return { send: (message: Record<string, unknown>) => listener(message) };
  });
  for (const file of ["toast-collections.js", "page-ui.js"]) await page.addScriptTag({ path: path.resolve("extension", file) });
  await bridge.evaluate(value => value.send({ type: "toast-feedback", message: "Saved to Keepall", success: true, actions: { id: "saved-note", canUndo: true } }));
  const toast = page.locator("#keepall-capture-ui .toast");
  const organize = toast.getByRole("button", { name: "Organize", exact: true });
  await expect(organize).toBeVisible();
  expect(await organize.locator("path").evaluateAll(paths => paths.map(node => node.getAttribute("d")))).toEqual(appPaths);
  await expect(organize.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await organize.click();
  const picker = toast.getByRole("dialog", { name: "Organize item", exact: true });
  await expect(picker.getByRole("button", { name: "Reading", exact: true })).toBeVisible();
  await picker.getByRole("button", { name: "Tags", exact: true }).click();
  await expect(picker.getByRole("button", { name: "Reference", exact: true })).toBeVisible();
  await picker.getByRole("button", { name: "Collection", exact: true }).click();
  await picker.getByRole("searchbox").fill("Read");
  await picker.getByRole("button", { name: "Tags", exact: true }).click();
  for (const theme of ["light", "dark"]) {
    await bridge.evaluate((value, theme) => value.send({ type: "theme", theme }), theme);
    const search = picker.getByRole("searchbox", { name: "Find a tag" });
    const clear = picker.getByRole("button", { name: "Clear search", exact: true });
    await search.fill("Ref");
    await expect(picker.getByRole("button", { name: "Research", exact: true })).toBeHidden();
    const bounds = await clear.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(40); expect(bounds!.height).toBeGreaterThanOrEqual(40);
    expect(await search.evaluate(node => [...(node.getRootNode() as ShadowRoot).querySelectorAll("style")].flatMap(style => [...(style.sheet?.cssRules ?? [])]).some(rule => rule instanceof CSSStyleRule && rule.selectorText === ".toast-collections-search::-webkit-search-cancel-button" && rule.style.display === "none"))).toBe(true);
    await toast.screenshot({ path: testInfo.outputPath(`extension-organize-${theme}.png`) });
    await clear.click({ position: { x: 3, y: 3 } });
    await expect(search).toHaveValue(""); await expect(search).toBeFocused();
    await expect(clear).toBeHidden(); await expect(picker).toBeVisible();
    await expect(picker.getByRole("button", { name: "Research", exact: true })).toBeVisible();
    await expect(picker.getByRole("button", { name: "Reference", exact: true })).toBeVisible();
    await picker.getByRole("button", { name: "Collection", exact: true }).click();
    await expect(picker.getByRole("searchbox")).toHaveValue("Read");
    await picker.getByRole("button", { name: "Tags", exact: true }).click();
    await expect(search).toHaveValue("");
    await search.fill("Keyboard"); await search.press("Tab"); await expect(clear).toBeFocused();
    await clear.press(theme === "light" ? "Enter" : "Space");
    await expect(search).toHaveValue(""); await expect(search).toBeFocused();
    await expect(picker).toBeVisible();
  }
  await picker.getByRole("button", { name: "Close organizer", exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(organize).toBeFocused();
});
