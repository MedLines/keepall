import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, test, vi } from "vitest";

const workerSource = readFileSync("extension/worker.js", "utf8");
const offscreenSource = readFileSync("extension/offscreen.js", "utf8");
afterEach(() => { vi.useRealTimers(); });

const ORIGIN = "https://www.keepall.app";

type Listener = (message: object, sender: object, reply: (result: unknown) => void) => unknown;
type WorkerApi = {
  requireLibraryAccess: (origin: string) => Promise<void>;
  saveImage: (tab: object, srcUrl: string, context?: object) => Promise<void>;
};

function worker({ request = true, contains = true } = {}) {
  const listeners: Listener[] = [];
  const chrome = {
    storage: { local: { setAccessLevel: vi.fn(async () => {}), get: vi.fn(async () => ({})) }, session: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) }, onChanged: { addListener: vi.fn() } },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    runtime: { onInstalled: { addListener: vi.fn() }, onMessage: { addListener: (fn: Listener) => { listeners.push(fn); } }, getURL: (path: string) => `chrome-extension://test/${path}`, getContexts: vi.fn(async () => [{}]), sendMessage: vi.fn() },
    contextMenus: { onClicked: { addListener: vi.fn() } },
    permissions: { contains: vi.fn(async () => contains), request: vi.fn(async () => request) },
    tabs: { create: vi.fn(async () => ({})), sendMessage: vi.fn(async () => undefined), query: vi.fn(async () => []), onUpdated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() } },
    scripting: { executeScript: vi.fn(async () => {}) },
    action: { onClicked: { addListener: vi.fn() }, setBadgeText: vi.fn(async () => {}), setBadgeBackgroundColor: vi.fn(async () => {}), setTitle: vi.fn(async () => {}) },
    commands: { onCommand: { addListener: vi.fn() } },
  };
  const context = { chrome, crypto, URL, setTimeout, clearTimeout, btoa } as Record<string, unknown>;
  runInNewContext(workerSource, context);
  const send = (message: object, sender: object) => new Promise<unknown>((resolve) => {
    const handled = listeners.some((listener) => listener(message, sender, resolve) === true);
    if (!handled) resolve(undefined);
  });
  return { chrome, api: context as unknown as WorkerApi, send };
}

test("offscreen tells the person how to recover when the bridge never loads", async () => {
  vi.useFakeTimers();
  let listener!: Listener;
  const frame = { contentWindow: { postMessage: vi.fn() }, remove: vi.fn(), src: "", hidden: false };
  const chrome = { runtime: { id: "test", onMessage: { addListener: (fn: Listener) => { listener = fn; } } } };
  runInNewContext(offscreenSource, { chrome, window: { addEventListener: vi.fn() }, document: { createElement: () => frame, body: { append: vi.fn() } }, crypto, atob, Uint8Array, setTimeout, clearTimeout });
  const reply = new Promise<Record<string, unknown>>((resolve) => {
    listener({ target: "offscreen", type: "capture", origin: ORIGIN, payload: { captureId: "c1", url: "https://example.com", title: "x" } }, { id: "test" }, (result) => resolve(result as Record<string, unknown>));
  });
  await vi.advanceTimersByTimeAsync(15_000);
  await expect(reply).resolves.toMatchObject({ error: expect.stringContaining("Could not reach Keepall") });
});

test("missing library access points to settings", async () => {
  const { api } = worker({ contains: false });
  await expect(api.requireLibraryAccess(ORIGIN)).rejects.toThrow("lost access to your library");
});

test("open-options opens the requested settings tab only for page senders", async () => {
  const { chrome, send } = worker();
  await expect(send({ type: "open-options", section: "general" }, {})).resolves.toBeUndefined();
  await expect(send({ type: "open-options", section: "elsewhere" }, { tab: { id: 1 } })).resolves.toBeUndefined();
  expect(chrome.tabs.create).not.toHaveBeenCalled();
  await expect(send({ type: "open-options", section: "general" }, { tab: { id: 1 } })).resolves.toEqual({ success: true });
  expect(chrome.tabs.create).toHaveBeenCalledWith({ url: "chrome-extension://test/options.html#general" });
});

test("a denied image host is named and the notice offers the images settings", async () => {
  const { chrome, api } = worker({ request: false });
  await api.saveImage({ id: 1, url: "https://studio.example/work" }, "https://cdn.example/pic.png");
  expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, expect.objectContaining({
    type: "toast-feedback",
    success: false,
    message: expect.stringContaining("cdn.example"),
    actions: { settings: "images" },
  }));
});
