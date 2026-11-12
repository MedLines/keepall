import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const collections = { success: true, collections: [{ id: "c1", name: "Reading" }], collectionIds: [], tags: [], tagIds: [], captureId: "x", itemId: "i" };
const withActions = { id: "action", canUndo: false, canScreenshot: false };

async function openPage(page: Page, markup: string, afterContent?: () => Promise<void>) {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.setContent(`<!doctype html><body style="margin:0;background:#c8d8f0">${markup}</body>`);
  await afterContent?.();
  const bridge = await page.evaluateHandle(() => {
    let listener: (message: Record<string, unknown>) => void;
    const keys: string[] = [];
    // Site shortcuts registered at page load, before the extension's scripts, on window and document.
    for (const target of [window, document]) {
      for (const type of ["keydown", "keypress", "keyup"]) {
        for (const capture of [true, false]) {
          target.addEventListener(type, (event) => {
            keys.push(`${target === window ? "window" : "document"}:${type}:${capture}:${(event as KeyboardEvent).key}`);
          }, capture);
        }
      }
    }
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      return attach.call(this, { ...options, mode: "open" });
    };
    const sent: Record<string, unknown>[] = [];
    Object.assign(globalThis, { chrome: { runtime: {
      getURL: () => "data:font/woff2;base64,",
      onMessage: { addListener: (callback: typeof listener) => { listener = callback; } },
      sendMessage: async (message: Record<string, unknown>) => {
        sent.push(message);
        return message.action === "collections" ? JSON.parse(JSON.stringify((globalThis as { __collections?: unknown }).__collections)) : { success: true };
      },
    } } });
    return { send: (message: Record<string, unknown>) => listener(message), keys: () => [...keys], sent: () => [...sent] };
  });
  await page.evaluate((value) => { (globalThis as { __collections?: unknown }).__collections = value; }, collections);
  for (const file of ["drawer-styles.js", "note-preview.js", "file-capture.js", "org-picker.js", "toast-collections.js", "page-ui.js"]) {
    await page.addScriptTag({ path: path.resolve("extension", file) });
  }
  return { bridge, frame: page.locator("iframe[data-keepall-toast-frame]").contentFrame() };
}

test("typing in the notice's search never reaches site shortcuts", async ({ page }) => {
  const { bridge, frame } = await openPage(page, "<button id='page-action'>Page action</button>");
  await bridge.evaluate((value, actions) => value.send({ type: "toast-feedback", message: "Link saved to Keepall", success: true, actions }), withActions);
  await frame.getByRole("button", { name: "Organize", exact: true }).click();
  const search = frame.getByRole("searchbox");
  await expect(search).toBeFocused();
  await expect(frame.getByRole("button", { name: "Reading" })).toBeVisible();
  await page.keyboard.type("sk");
  await expect(search).toHaveValue("sk");
  // Keys the organizer handles also stay inside the frame.
  await page.keyboard.press("Escape");
  await expect(frame.getByRole("dialog", { name: "Organize item" })).toHaveCount(0);
  expect(await bridge.evaluate((value) => value.keys())).toEqual([]);
});

test("the notice stays usable above a page's modal dialog", async ({ page }) => {
  const { bridge, frame } = await openPage(
    page,
    "<button id='page-action'>Page action</button><dialog id='lightbox'><p>Photo</p></dialog>",
    async () => { await page.evaluate(() => (document.getElementById("lightbox") as HTMLDialogElement).showModal()); },
  );
  await bridge.evaluate((value, actions) => value.send({ type: "toast-feedback", message: "Image saved to Keepall", success: true, actions }), withActions);
  const open = frame.getByRole("button", { name: "Open in Keepall" });
  await expect(open).toBeVisible();
  expect(await page.locator("#lightbox iframe[data-keepall-toast-frame]").count()).toBe(1);
  // The frame, not the inert page behind the dialog, receives the press.
  const box = (await open.boundingBox())!;
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches("iframe[data-keepall-toast-frame]"), [box.x + box.width / 2, box.y + box.height / 2])).toBe(true);
  await open.click();
  expect(await bridge.evaluate((value) => value.sent())).toContainEqual({ type: "capture-feedback-action", action: "open", actionId: "action" });
  // A finished action dismisses the notice and removes its container from the dialog.
  await expect(page.locator("#lightbox iframe[data-keepall-toast-frame]")).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator("#lightbox > div")).toHaveCount(0);
});

test("a notice outside any dialog sits in the extension's host and goes away when dismissed", async ({ page }) => {
  const { bridge, frame } = await openPage(page, "<button id='page-action'>Page action</button>");
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "Saved", success: true }));
  await expect(frame.locator(".toast")).toBeVisible();
  expect(await page.locator("#keepall-capture-ui iframe[data-keepall-toast-frame]").count()).toBe(1);
  await frame.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(page.locator("iframe[data-keepall-toast-frame]")).toHaveCount(0, { timeout: 2000 });
});

async function pixel(page: Page, x: number, y: number) {
  const png = (await page.screenshot({ clip: { x, y, width: 1, height: 1 } })).toString("base64");
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  }, png);
}

test("the notice follows a theme change and never paints an opaque backdrop", async ({ page }) => {
  const { bridge, frame } = await openPage(page, "<button id='page-action'>Page action</button>");
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "Saved", success: true }));
  await expect(frame.locator(".toast.is-visible")).toBeVisible();
  await page.waitForTimeout(400);
  for (const theme of ["dark", "light"]) {
    await bridge.evaluate((value, preference) => value.send({ type: "theme", theme: preference }), theme);
    await expect(frame.locator("html")).toHaveAttribute("data-theme", theme);
    expect(await frame.locator(".toast-card").evaluate((card) => getComputedStyle(card).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    // Beside the notice, inside the frame's padding, the page's own #c8d8f0 still shows.
    const box = (await frame.locator(".toast").boundingBox())!;
    const [red, green, blue] = await pixel(page, box.x - 22, box.y + box.height / 2);
    expect(Math.abs(red - 200) + Math.abs(green - 216) + Math.abs(blue - 240)).toBeLessThan(24);
  }
});

test("focus returns to the page element that held it before the notice took focus", async ({ page }) => {
  const { bridge, frame } = await openPage(page, "<button id='first'>First</button><button id='second'>Second</button>");
  await page.locator("#second").focus();
  await bridge.evaluate((value, actions) => value.send({ type: "toast-feedback", message: "Link saved to Keepall", success: true, focusShortcut: "Alt+Shift+K", actions }), withActions);
  await bridge.evaluate((value) => value.send({ type: "focus-toast" }));
  await expect(frame.getByRole("button", { name: "Open in Keepall" })).toBeFocused();
  await frame.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(page.locator("#second")).toBeFocused();
});

test("a screenshot hides the notice, including inside a page dialog", async ({ page }) => {
  const { bridge } = await openPage(
    page,
    "<dialog id='lightbox'><p>Photo</p></dialog>",
    async () => { await page.evaluate(() => (document.getElementById("lightbox") as HTMLDialogElement).showModal()); },
  );
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "Saved", success: true }));
  const container = page.locator("#lightbox > div").first();
  await expect(page.locator("iframe[data-keepall-toast-frame]")).toBeVisible();
  await bridge.evaluate((value) => value.send({ type: "screenshot-hide" }));
  await expect(container).toHaveCSS("visibility", "hidden");
  // The frame itself must not repaint itself visible inside a hidden container.
  await expect(page.locator("iframe[data-keepall-toast-frame]")).toHaveCSS("visibility", "hidden");
  await bridge.evaluate((value) => value.send({ type: "screenshot-show" }));
  await expect(container).toHaveCSS("visibility", "visible");
  await expect(page.locator("iframe[data-keepall-toast-frame]")).toHaveCSS("visibility", "visible");
});

test("a screenshot hides a notice that sits in the extension's host", async ({ page }) => {
  const { bridge } = await openPage(page, "<button id='page-action'>Page action</button>");
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "Saved", success: true }));
  await expect(page.locator("iframe[data-keepall-toast-frame]")).toBeVisible();
  await bridge.evaluate((value) => value.send({ type: "screenshot-hide" }));
  await expect(page.locator("iframe[data-keepall-toast-frame]")).toHaveCSS("visibility", "hidden");
  await bridge.evaluate((value) => value.send({ type: "screenshot-show" }));
  await expect(page.locator("iframe[data-keepall-toast-frame]")).toHaveCSS("visibility", "visible");
});

test("moving focus back to the page releases the notice so it can dismiss itself", async ({ page }) => {
  const { bridge, frame } = await openPage(page, "<button id='first'>First</button>");
  await bridge.evaluate((value, actions) => value.send({ type: "toast-feedback", message: "Link saved to Keepall", success: true, actions }), withActions);
  await frame.getByRole("button", { name: "Open in Keepall" }).focus();
  await expect(frame.getByRole("button", { name: "Open in Keepall" })).toBeFocused();
  await page.locator("#first").focus();
  await expect(page.locator("#first")).toBeFocused();
  expect(await frame.locator("body").evaluate((body) => body.ownerDocument.activeElement === body)).toBe(true);
});

test("the frame's transparent padding passes clicks through to the page", async ({ page }) => {
  const { bridge, frame } = await openPage(page, "");
  await bridge.evaluate((value, actions) => value.send({ type: "toast-feedback", message: "Link saved to Keepall", success: true, actions }), withActions);
  await expect(frame.locator(".toast.is-visible")).toBeVisible();
  await page.waitForTimeout(400);
  const box = (await frame.locator(".toast").boundingBox())!;
  const spots = { below: [box.x + 40, box.y + box.height + 30], left: [box.x - 12, box.y + 20] };
  await page.evaluate((points) => {
    (globalThis as { __hits?: string[] }).__hits = [];
    for (const [name, [x, y]] of Object.entries(points)) {
      const button = document.createElement("button");
      button.style.cssText = `position:fixed;left:${x - 6}px;top:${y - 6}px;width:12px;height:12px;padding:0`;
      button.addEventListener("click", () => (globalThis as { __hits?: string[] }).__hits!.push(name));
      document.body.append(button);
    }
  }, spots);
  for (const [x, y] of Object.values(spots)) await page.mouse.click(x, y);
  expect(await page.evaluate(() => (globalThis as { __hits?: string[] }).__hits)).toEqual(["below", "left"]);
  // Back over the notice, the frame takes the pointer again. (A real pointer always moves first;
  // Playwright's hit-test would run before its own move, so move explicitly.)
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await frame.getByRole("button", { name: "Organize", exact: true }).click();
  await expect(frame.getByRole("dialog", { name: "Organize item" })).toBeVisible();
  await frame.getByRole("button", { name: "Close organizer" }).click();
  await expect(frame.getByRole("dialog", { name: "Organize item" })).toHaveCount(0);
  await frame.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(page.locator("iframe[data-keepall-toast-frame]")).toHaveCount(0, { timeout: 2000 });
});
