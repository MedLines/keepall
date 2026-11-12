import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, test, vi } from "vitest";

const workerSource = readFileSync("extension/worker.js", "utf8");
const offscreenSource = readFileSync("extension/offscreen.js", "utf8");
afterEach(() => { vi.useRealTimers(); });

const ORIGIN = "https://www.keepall.app";
const PAGE = "https://studio.example/work";

type WorkerApi = {
  captureFeedbackActions: (tabId: number, origin: string, result: object, pageUrl?: string) => Promise<Record<string, unknown>>;
  saveScreenshot: (tabId: number, record: object) => Promise<Record<string, unknown>>;
  encodeScreenshot: (dataUrl: string) => Promise<object>;
};

function worker() {
  const session: Record<string, unknown> = {};
  const calls: string[] = [];
  const chrome = {
    storage: { local: { setAccessLevel: vi.fn(async () => {}), get: vi.fn(async () => ({})) }, session: {
      get: vi.fn(async (key: string) => ({ [key]: session[key] })),
      set: vi.fn(async (values: object) => Object.assign(session, values)),
    }, onChanged: { addListener: vi.fn() } },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    runtime: { onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() }, getURL: (path: string) => `chrome-extension://test/${path}`,
      getContexts: vi.fn(async () => [{}]), sendMessage: vi.fn(async (message: { payload: { captureId: string } }) => ({ captureId: message.payload.captureId, itemId: "item", count: 2, limit: 8 })) },
    contextMenus: { onClicked: { addListener: vi.fn() } }, permissions: { contains: vi.fn(async () => true) },
    tabs: {
      get: vi.fn(async () => ({ id: 1, windowId: 4, url: `${PAGE}#section`, active: true })),
      captureVisibleTab: vi.fn(async () => { calls.push("capture"); return "data:image/png;base64,AAAA"; }),
      sendMessage: vi.fn(async (_tabId: number, message: { type: string }) => { calls.push(message.type); return message.type === "screenshot-hide" ? { hidden: true } : undefined; }),
      query: vi.fn(async () => []),
      onUpdated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() },
    },
    scripting: { executeScript: vi.fn(async () => {}) },
    action: { onClicked: { addListener: vi.fn() } }, commands: { getAll: vi.fn(async () => []), onCommand: { addListener: vi.fn() } },
  };
  const context = { chrome, crypto, URL, setTimeout, clearTimeout, btoa } as Record<string, unknown>;
  runInNewContext(workerSource, context);
  const api = context as unknown as WorkerApi;
  context.encodeScreenshot = vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/webp", width: 1600, height: 1000 }));
  const record = { id: "action", origin: ORIGIN, itemId: "item", pageUrl: PAGE };
  return { chrome, api, calls, session, record };
}

test("only a page saved from this tab, on an app that supports it, offers a screenshot", async () => {
  const { api, session } = worker();
  const supported = { itemId: "item", outcome: "created", capabilities: ["file-transfer-v1", "link-screenshot-v1"] };
  expect(await api.captureFeedbackActions(1, ORIGIN, supported, PAGE)).toMatchObject({ canScreenshot: true });
  expect(session["save-feedback:1"]).toMatchObject({ pageUrl: PAGE });
  expect(await api.captureFeedbackActions(1, ORIGIN, supported)).toMatchObject({ canScreenshot: false });
  expect(session["save-feedback:1"]).not.toHaveProperty("pageUrl");
  expect(await api.captureFeedbackActions(1, ORIGIN, { ...supported, capabilities: ["file-transfer-v1"] }, PAGE)).toMatchObject({ canScreenshot: false });
});

test("captures with Keepall's page UI hidden and sends the image to the saved link", async () => {
  const { api, chrome, calls, record } = worker();
  expect(await api.saveScreenshot(1, record)).toEqual({ success: true, count: 2, limit: 8 });
  expect(calls).toEqual(["screenshot-hide", "capture", "screenshot-show"]);
  expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(4, { format: "png" });
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
    target: "offscreen", type: "capture-screenshot", origin: ORIGIN,
    payload: expect.objectContaining({ itemId: "item", url: PAGE, mimeType: "image/webp", width: 1600, height: 1000, data: btoa("\u0001\u0002\u0003") }),
  }));
});

test("restores the page UI and reports a friendly error when Chrome refuses the capture", async () => {
  const { api, chrome, calls, record } = worker();
  chrome.tabs.captureVisibleTab.mockImplementationOnce(async () => { calls.push("capture"); throw new Error("Cannot access contents of the page"); });
  await expect(api.saveScreenshot(1, record)).rejects.toThrow("Can't capture this page.");
  expect(calls).toEqual(["screenshot-hide", "capture", "screenshot-show"]);
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
});

test("waits out Chrome's capture quota instead of failing", async () => {
  const { api, chrome, calls, record } = worker();
  chrome.tabs.captureVisibleTab.mockImplementationOnce(async () => {
    calls.push("capture");
    throw new Error("This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota.");
  });
  expect(await api.saveScreenshot(1, record)).toMatchObject({ success: true });
  expect(calls).toEqual(["screenshot-hide", "capture", "capture", "screenshot-show"]);
});

test("refuses when the tab moved to another page, is in the background, or the save was not a page", async () => {
  const { api, chrome, record } = worker();
  chrome.tabs.get.mockResolvedValueOnce({ id: 1, windowId: 4, url: "https://studio.example/about", active: true });
  await expect(api.saveScreenshot(1, record)).rejects.toThrow(/page changed/);
  chrome.tabs.get.mockResolvedValueOnce({ id: 1, windowId: 4, url: PAGE, active: false });
  await expect(api.saveScreenshot(1, record)).rejects.toThrow(/Switch back/);
  await expect(api.saveScreenshot(1, { ...record, pageUrl: undefined })).rejects.toThrow(/saved pages only/);
  expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
});

test("surfaces the app's limit message and rejects mismatched confirmations", async () => {
  const { api, chrome, record } = worker();
  chrome.runtime.sendMessage.mockResolvedValueOnce({ error: "A link can have up to 8 screenshots" } as never);
  await expect(api.saveScreenshot(1, record)).rejects.toThrow("A link can have up to 8 screenshots");
  chrome.runtime.sendMessage.mockResolvedValueOnce({ captureId: "other", itemId: "item", count: 1 } as never);
  await expect(api.saveScreenshot(1, record)).rejects.toThrow(/did not confirm/);
});

function offscreen() {
  let message!: (event: object) => void;
  let listener!: (message: object, sender: object, reply: (result: unknown) => void) => void;
  const postMessage = vi.fn();
  const frame = { contentWindow: { postMessage }, remove: vi.fn(), src: "", hidden: false };
  const chrome = { runtime: { id: "test", onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } } };
  runInNewContext(offscreenSource, { chrome, window: { addEventListener: (_type: string, fn: typeof message) => { message = fn; } }, document: { createElement: () => frame, body: { append: vi.fn() } }, crypto, atob, Uint8Array, setTimeout, clearTimeout });
  const send = (type: string, payload: object) => new Promise<Record<string, unknown>>(resolve => listener({ target: "offscreen", type, origin: ORIGIN, payload }, { id: "test" }, result => resolve(result as Record<string, unknown>)));
  const incoming = (data: object) => message({ source: frame.contentWindow, origin: ORIGIN, data: { channel: "keepall-extension", ...data } });
  return { send, incoming, postMessage };
}

test("offscreen reports app capabilities with link saves", async () => {
  const { send, incoming, postMessage } = offscreen();
  const reply = send("capture", { captureId: "c1", url: PAGE, title: "Work" });
  incoming({ type: "ready", capabilities: ["file-transfer-v1", "link-screenshot-v1"] });
  await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
  incoming({ type: "result", captureId: "c1", itemId: "item", outcome: "created" });
  await expect(reply).resolves.toMatchObject({ itemId: "item", capabilities: ["file-transfer-v1", "link-screenshot-v1"] });
});

test("offscreen forwards decoded screenshot bytes only to an app that supports them", async () => {
  const older = offscreen();
  const refused = older.send("capture-screenshot", { captureId: "s0", itemId: "item", url: PAGE, mimeType: "image/webp", width: 2, height: 2, data: btoa("abc") });
  older.incoming({ type: "ready", capabilities: ["file-transfer-v1"] });
  await expect(refused).resolves.toMatchObject({ error: expect.stringContaining("matching app version") });
  expect(older.postMessage).not.toHaveBeenCalled();

  const { send, incoming, postMessage } = offscreen();
  const reply = send("capture-screenshot", { captureId: "s1", itemId: "item", url: PAGE, mimeType: "image/webp", width: 1600, height: 1000, data: btoa("abc") });
  incoming({ type: "ready", capabilities: ["link-screenshot-v1"] });
  await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
  const [posted] = postMessage.mock.calls[0];
  expect(posted).toMatchObject({ type: "capture-screenshot", payload: { captureId: "s1", itemId: "item", url: PAGE, width: 1600, height: 1000 } });
  expect(Array.from(posted.payload.bytes as Uint8Array)).toEqual([97, 98, 99]);
  incoming({ type: "result", captureId: "s1", itemId: "item", count: 1, limit: 8 });
  await expect(reply).resolves.toEqual({ type: "result", channel: "keepall-extension", captureId: "s1", itemId: "item", count: 1, limit: 8 });
});
