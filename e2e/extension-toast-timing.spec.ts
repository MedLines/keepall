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
