import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";

const workerSource = readFileSync("extension/worker.js", "utf8");
const ORIGIN = "https://www.keepall.app";
const PAGE = "https://studio.example/work";

type Listener = (message: object, sender: object, respond: (value: unknown) => void) => unknown;

function worker(offscreenResult: object) {
  const session: Record<string, unknown> = { "file-editor:1": { tabId: 1, editorId: "editor", origin: ORIGIN, sourceUrl: PAGE } };
  let listener: Listener | undefined;
  const chrome = {
    storage: { local: { setAccessLevel: vi.fn(async () => {}), get: vi.fn(async () => ({})) }, session: {
      get: vi.fn(async (key: string) => ({ [key]: session[key] })),
      set: vi.fn(async () => {}),
    }, onChanged: { addListener: vi.fn() } },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    runtime: { onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn((callback: Listener) => { listener = callback; }) },
      getURL: (path: string) => `chrome-extension://test/${path}`, getContexts: vi.fn(async () => [{}]), sendMessage: vi.fn(async () => offscreenResult) },
    contextMenus: { onClicked: { addListener: vi.fn() } }, permissions: { contains: vi.fn(async () => true) },
    tabs: { sendMessage: vi.fn(async () => undefined), query: vi.fn(async () => []), onUpdated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() } },
    scripting: { executeScript: vi.fn(async () => {}) },
    action: { onClicked: { addListener: vi.fn() } }, commands: { onCommand: { addListener: vi.fn() } },
  };
  const context = { chrome, crypto, URL, setTimeout, clearTimeout, btoa } as Record<string, unknown>;
  runInNewContext(workerSource, context);
  const api = context as unknown as { sendEditorOrganizations: (tabId: number, editorId: string, origin: string, url: string) => Promise<void> };
  return { chrome, api, listener: () => listener! };
}

test("an unreachable library tells the drawer to open Keepall and retry", async () => {
  const { api, chrome } = worker({ error: "Could not reach Keepall. Open your library, then try again." });
  await api.sendEditorOrganizations(1, "editor", ORIGIN, PAGE);
  expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, expect.objectContaining({
    type: "organization-error", message: expect.stringContaining("Could not reach Keepall, so collections and tags didn't load."),
  }));
});

test("another failure says the link can still be saved", async () => {
  const { api, chrome } = worker({ error: "Something else" });
  await api.sendEditorOrganizations(1, "editor", ORIGIN, PAGE);
  expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, expect.objectContaining({
    type: "organization-error", message: expect.stringContaining("You can save now"),
  }));
});

test("retrying for a different editor is refused", async () => {
  const { listener, chrome } = worker({ collections: [], tags: [] });
  const respond = vi.fn();
  listener()({ type: "retry-editor-organizations", editorId: "other" }, { tab: { id: 1 } }, respond);
  await vi.waitFor(() => expect(respond).toHaveBeenCalledWith({ success: false }));
  expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
});

test("retrying for the open editor loads the collections again", async () => {
  const { listener, chrome } = worker({ collections: [], tags: [] });
  const respond = vi.fn();
  listener()({ type: "retry-editor-organizations", editorId: "editor" }, { tab: { id: 1 } }, respond);
  await vi.waitFor(() => expect(respond).toHaveBeenCalledWith({ success: true }));
  expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, expect.objectContaining({ type: "organizations", editorId: "editor" }));
});
