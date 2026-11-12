import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

async function openToastPage(page: Page, sendMessage: "ok" | "fail" = "ok") {
  await page.clock.install();
  await page.setContent("<!doctype html><body><button id='page-action'>Page action</button></body>");
  const bridge = await page.evaluateHandle((mode) => {
    let listener: (message: Record<string, unknown>) => void;
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      return attach.call(this, { ...options, mode: "open" });
    };
    Object.assign(globalThis, { chrome: { runtime: {
      getURL: () => "data:font/woff2;base64,",
      onMessage: { addListener: (callback: typeof listener) => { listener = callback; } },
      sendMessage: async (message: unknown) => {
        const sent = globalThis as { __sent?: unknown[] };
        sent.__sent = [...(sent.__sent ?? []), message];
        return mode === "fail" ? { success: false, error: "Nope" } : { success: true };
      },
    } } });
    return { send: (message: Record<string, unknown>) => listener(message) };
  }, sendMessage);
  for (const file of ["drawer-styles.js", "note-preview.js", "file-capture.js", "org-picker.js", "toast-collections.js", "page-ui.js"]) {
    await page.addScriptTag({ path: path.resolve("extension", file) });
  }
  return { bridge, toast: page.locator("#keepall-capture-ui .toast") };
}

test("a failure notice stays on screen", async ({ page }) => {
  const { bridge, toast } = await openToastPage(page);
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "Could not save", success: false }));
  await expect(toast).toContainText("Could not save");
  await page.clock.runFor(30_000);
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Dismiss notification" }).click();
  await page.clock.runFor(1000);
  await expect(toast).toHaveCount(0);
});

test("a failed action keeps its error on screen", async ({ page }) => {
  const { bridge, toast } = await openToastPage(page, "fail");
  await bridge.evaluate((value) => value.send({
    type: "toast-feedback", message: "Link saved to Keepall", success: true,
    actions: { id: "action", canUndo: false, canScreenshot: false },
  }));
  await expect(toast).toContainText("Link saved to Keepall");
  await toast.getByRole("button", { name: "Open in Keepall" }).click();
  await expect(toast).toContainText("Nope");
  await page.clock.runFor(30_000);
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Nope");
});

test("a hidden tab pauses the dismiss timer", async ({ page }) => {
  const { bridge, toast } = await openToastPage(page);
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "Link saved to Keepall", success: true }));
  await expect(toast).toBeVisible();
  const setHidden = (hidden: boolean) => page.evaluate((value) => {
    Object.defineProperty(document, "hidden", { value, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
  await setHidden(true);
  await page.clock.runFor(30_000);
  await expect(toast).toBeVisible();
  await setHidden(false);
  await page.clock.runFor(9000);
  await expect(toast).toHaveCount(0);
});

test("an access failure offers Open settings", async ({ page }) => {
  const { bridge, toast } = await openToastPage(page);
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "x", success: false, actions: { settings: "general" } }));
  await expect(toast.getByRole("button", { name: "Open in Keepall" })).toHaveCount(0);
  await toast.getByRole("button", { name: "Open settings" }).click();
  expect(await page.evaluate(() => (globalThis as { __sent?: unknown[] }).__sent)).toContainEqual({ type: "open-options", section: "general" });
  await page.clock.runFor(1000);
  await expect(toast).toHaveCount(0);
});

const savedWithActions = { canUndo: true, canScreenshot: false };

test("save notices are announced in a live region without button names", async ({ page }) => {
  const { bridge, toast } = await openToastPage(page);
  await bridge.evaluate((value, actions) => value.send({ type: "toast-feedback", message: "Link saved to Keepall", success: true, actions: { id: "a", ...actions } }), savedWithActions);
  await page.clock.runFor(100);
  await expect(page.locator("#keepall-capture-ui [role=status]")).toHaveText("Link saved to Keepall");
  await expect(toast).not.toHaveAttribute("role", /.*/);
});

test("a failure is announced in the alert region", async ({ page }) => {
  const { bridge } = await openToastPage(page);
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "Could not save", success: false }));
  await page.clock.runFor(100);
  await expect(page.locator("#keepall-capture-ui [role=alert]")).toHaveText("Could not save");
});

test("Undo updates the notice in place and keeps focus", async ({ page }) => {
  const { bridge, toast } = await openToastPage(page);
  await bridge.evaluate((value, actions) => value.send({ type: "toast-feedback", message: "Link saved to Keepall", success: true, actions: { id: "a", ...actions } }), savedWithActions);
  await toast.getByRole("button", { name: "Undo" }).focus();
  await page.keyboard.press("Enter");
  await expect(toast.locator(".toast-label")).toHaveText("Save undone");
  await expect(toast.locator(".toast-actions")).toHaveCount(0);
  await expect(toast.getByRole("button", { name: "Dismiss notification" })).toBeFocused();
  await page.clock.runFor(100);
  await expect(page.locator("#keepall-capture-ui [role=status]")).toHaveText("Save undone");
});

test("a new notice waits for a running action", async ({ page }) => {
  const { bridge, toast } = await openToastPage(page);
  await page.evaluate(() => {
    const runtime = (globalThis as unknown as { chrome: { runtime: { sendMessage: unknown } } }).chrome.runtime;
    runtime.sendMessage = () => new Promise((resolve) => { (globalThis as { __resolve?: unknown }).__resolve = resolve; });
  });
  await bridge.evaluate((value, actions) => value.send({ type: "toast-feedback", message: "Link saved to Keepall", success: true, actions: { id: "a", ...actions } }), savedWithActions);
  await toast.getByRole("button", { name: "Undo" }).click();
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "Text saved to Keepall", success: true }));
  await expect(toast.locator(".toast-label")).toHaveText("Undoing save…");
  await page.evaluate(() => (globalThis as unknown as { __resolve: (value: unknown) => void }).__resolve({ success: true }));
  await expect(toast.locator(".toast-label")).toHaveText("Text saved to Keepall");
});

test("focus returns to the page when a focused notice is dismissed", async ({ page }) => {
  const { bridge, toast } = await openToastPage(page);
  await page.locator("#page-action").focus();
  await bridge.evaluate((value) => value.send({ type: "toast-feedback", message: "Could not save", success: false }));
  await page.keyboard.press("Tab");
  await toast.getByRole("button", { name: "Dismiss notification" }).focus();
  await page.keyboard.press("Enter");
  await page.clock.runFor(1000);
  await expect(toast).toHaveCount(0);
  await expect(page.locator("#page-action")).toBeFocused();
});
