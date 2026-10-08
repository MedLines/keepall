import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, test, vi } from "vitest";

const workerSource = readFileSync("extension/worker.js", "utf8");
const offscreenSource = readFileSync("extension/offscreen.js", "utf8");
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });
function worker() {
  let listener!: (message: object, sender: object, reply: (result: unknown) => void) => void;
  const session: Record<string, unknown> = {};
  const chrome = {
    storage: { local: { setAccessLevel: vi.fn(async () => {}), get: vi.fn(async () => ({})) }, session: {
      get: vi.fn(async (key: string | null) => key ? { [key]: session[key] } : { ...session }),
      set: vi.fn(async (values: object) => Object.assign(session, values)), remove: vi.fn(async () => {}),
    }, onChanged: { addListener: vi.fn() } },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    runtime: { onInstalled: { addListener: vi.fn() }, onMessage: { addListener: (fn: typeof listener) => { listener = fn; } }, getURL: (path: string) => `chrome-extension://test/${path}`,
      getContexts: vi.fn(async () => [{}]), sendMessage: vi.fn(async () => ({ success: true, stage: "receiving" })) },
    contextMenus: { onClicked: { addListener: vi.fn() } }, permissions: { contains: vi.fn(async () => true) },
    tabs: { onUpdated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() }, query: vi.fn(async () => [] as object[]), create: vi.fn(async () => {}), update: vi.fn(async () => {}), sendMessage: vi.fn(async () => {}) },
    windows: { update: vi.fn(async () => {}) }, scripting: { executeScript: vi.fn(async () => {}) },
    action: { onClicked: { addListener: vi.fn() } }, commands: { onCommand: { addListener: vi.fn() } },
  };
  const context = { chrome, crypto, URL, setTimeout, clearTimeout };
  runInNewContext(workerSource, context);
  const editorId = crypto.randomUUID();
  session["file-editor:1"] = { tabId: 1, editorId, origin: "https://www.keepall.app", sourceUrl: "https://example.com/page", createdAt: Date.now() };
  const request = (operation: string, payload: object = {}, overrides = {}, sender: object = { tab: { id: 1 }, frameId: 0 }) => new Promise<Record<string, unknown>>(resolve => listener({ type: "editor-file-action", editorId, operation, payload, ...overrides }, sender, result => resolve(result as Record<string, unknown>)));
  return { chrome, request, context, session, editorId };
}
test("file actions bind editor and sender tab, and always use registered origin/source", async () => {
  const { chrome, request } = worker();
  expect(await request("begin", {}, { editorId: crypto.randomUUID() })).toMatchObject({ success: false, error: expect.stringContaining("expired") });
  expect(await request("begin", {}, {}, { tab: { id: 2 }, frameId: 0 })).toMatchObject({ success: false });
  expect(await request("begin", {}, {}, { tab: { id: 1 }, frameId: 1 })).toMatchObject({ success: false });
  expect(await request("begin", { metadata: { sourceUrl: "https://evil.com" } })).toMatchObject({ success: false });
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  expect(await request("begin", {}, { origin: "https://evil.com" })).toMatchObject({ success: true });
  expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ origin: "https://www.keepall.app", payload: { metadata: { sourceUrl: "https://example.com/page" } } }));
});
test("oversized base64 is rejected before forwarding and editor storage contains metadata only", async () => {
  const { chrome, request, session } = worker();
  expect(await request("chunk", { sessionId: crypto.randomUUID(), fileIndex: 0, offset: 0, data: "a".repeat(350000) })).toMatchObject({ success: false });
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  await request("begin", { metadata: { noteContent: "secret note" }, files: [] });
  expect(JSON.stringify(session)).not.toContain("secret note");
});
test("bulk handoff preserves item detail tabs and contains only a nonce", async () => {
  const { chrome, request } = worker();
  chrome.tabs.query.mockResolvedValue([{ id: 5, windowId: 2, url: "https://www.keepall.app/items/keep" }]);
  expect(await request("open-bulk-import")).toEqual({ success: true });
  expect(chrome.tabs.update).not.toHaveBeenCalled();
  expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringMatching(/^https:\/\/www.keepall.app\/#keepall-bulk-import=[0-9a-f-]{36}$/) });
  chrome.tabs.query.mockResolvedValue([{ id: 7, windowId: 2, url: "https://www.keepall.app/" }]);
  await request("open-bulk-import");
  expect(chrome.tabs.update).toHaveBeenCalledWith(7, { active: true, url: expect.stringContaining("/#keepall-bulk-import=") });
});
function offscreen() {
  let message!: (event: object) => void;
  let listener!: (message: object, sender: object, reply: (result: unknown) => void) => void;
  const postMessage = vi.fn();
  const frame = { contentWindow: { postMessage }, remove: vi.fn(), src: "", hidden: false };
  const chrome = { runtime: { id: "test", onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } } };
  const decode = vi.fn(atob);
  runInNewContext(offscreenSource, { chrome, window: { addEventListener: (_type: string, fn: typeof message) => { message = fn; } }, document: { createElement: () => frame, body: { append: vi.fn() } }, crypto, atob: decode, Uint8Array, setTimeout, clearTimeout });
  const request = (operation: string, payload = {}, sender: object = { id: "test" }) => new Promise<Record<string, unknown>>(resolve => listener({ target: "offscreen", type: "file-action", origin: "https://www.keepall.app", tabId: 1, editorId: crypto.randomUUID(), operation, payload }, sender, result => resolve(result as Record<string, unknown>)));
  const incoming = (data: object) => message({ source: frame.contentWindow, origin: "https://www.keepall.app", data: { channel: "keepall-extension", ...data } });
  return { request, incoming, postMessage, decode };
}
test("older bridge rejects file actions immediately after ready and content scripts cannot impersonate the worker", async () => {
  const { request, incoming } = offscreen();
  expect(await request("begin", {}, { id: "test", tab: { id: 1 } })).toMatchObject({ success: false, error: expect.stringContaining("Untrusted") });
  const reply = request("begin"); incoming({ type: "ready" });
  await expect(reply).resolves.toMatchObject({ success: false, error: expect.stringContaining("matching app version") });
});
test("offscreen forwards one transferable chunk, with length validation before decode", async () => {
  const { request, incoming, postMessage, decode } = offscreen();
  const sessionId = crypto.randomUUID();
  const reply = request("chunk", { sessionId, fileIndex: 0, offset: 0, data: btoa("abc") });
  incoming({ type: "ready", capabilities: ["file-transfer-v1"] });
  await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
  const [message, origin, transfers] = postMessage.mock.calls[0];
  expect(origin).toBe("https://www.keepall.app");
  expect(transfers).toEqual([message.payload.bytes]); expect(new Uint8Array(message.payload.bytes)).toEqual(new Uint8Array([97, 98, 99]));
  expect(message.payload.data).toBeUndefined();
  incoming({ type: "file-result", requestId: message.requestId, success: true, receivedBytes: 3 });
  await expect(reply).resolves.toMatchObject({ success: true, receivedBytes: 3 });
  const decoded = decode.mock.calls.length;
  await expect(request("chunk", { data: "a".repeat(350000) })).resolves.toMatchObject({ success: false });
  expect(decode).toHaveBeenCalledTimes(decoded);
  for (const data of ["abc", "a===", "ab=c", "@@@@"]) await expect(request("chunk", { data })).resolves.toMatchObject({ success: false });
  expect(decode).toHaveBeenCalledTimes(decoded);
});
test("lost offscreen replies time out with recovery instructions", async () => {
  vi.useFakeTimers(); const { request, incoming } = offscreen();
  const reply = request("commit", { sessionId: crypto.randomUUID() });
  incoming({ type: "ready", capabilities: ["file-transfer-v1"] });
  await vi.advanceTimersByTimeAsync(15001);
  await expect(reply).resolves.toMatchObject({ success: false, error: expect.stringContaining("Check status") });
});
