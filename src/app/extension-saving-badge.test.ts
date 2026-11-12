import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";

const workerSource = readFileSync("extension/worker.js", "utf8");
const ORIGIN = "https://www.keepall.app";
const TAB = { id: 1, url: "https://example.com/a", title: "A" };

type Api = {
  saveTab: (tab: object) => Promise<void>;
  saveSelection: (tab: object, info: object) => Promise<void>;
};

function worker() {
  const badges: Array<{ tabId: number; text: string }> = [];
  let resolveSent!: (value: { payload: { captureId: string } }) => void;
  const sent = new Promise<{ payload: { captureId: string } }>((resolve) => { resolveSent = resolve; });
  let finish!: (value: unknown) => void;
  const reply = new Promise((resolve) => { finish = resolve; });
  const chrome = {
    storage: {
      local: { setAccessLevel: vi.fn(async () => {}), get: vi.fn(async () => ({ origin: ORIGIN })), set: vi.fn(async () => {}), remove: vi.fn(async () => {}) },
      session: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
      onChanged: { addListener: vi.fn() },
    },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    runtime: {
      onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() },
      getURL: (path: string) => `chrome-extension://test/${path}`,
      getContexts: vi.fn(async () => [{}]),
      sendMessage: vi.fn((message: { payload: { captureId: string } }) => { resolveSent(message); return reply; }),
    },
    contextMenus: { onClicked: { addListener: vi.fn() } },
    permissions: { contains: vi.fn(async () => true) },
    tabs: {
      get: vi.fn(async () => TAB), query: vi.fn(async () => []), sendMessage: vi.fn(async () => undefined),
      onUpdated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() },
    },
    scripting: { executeScript: vi.fn(async () => [{ result: "Hello" }]) },
    action: {
      onClicked: { addListener: vi.fn() },
      setBadgeText: vi.fn(async (details: { tabId: number; text: string }) => { badges.push(details); }),
      setBadgeBackgroundColor: vi.fn(async () => {}), setTitle: vi.fn(async () => {}),
    },
    commands: { onCommand: { addListener: vi.fn() } },
  };
  const context = { chrome, crypto, URL, setTimeout, clearTimeout, btoa, fetch: vi.fn() } as Record<string, unknown>;
  runInNewContext(workerSource, context);
  return { api: context as unknown as Api, badges, sent, finish };
}

async function flush() {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

test("a page save shows a saving badge while Keepall is still working, then a check", async () => {
  const { api, badges, sent, finish } = worker();
  const done = api.saveTab(TAB);
  const message = await sent;
  expect(badges[0]).toEqual({ tabId: 1, text: "…" });
  finish({ captureId: message.payload.captureId, itemId: "x", outcome: "created" });
  await done;
  await flush();
  expect(badges.at(-1)).toEqual({ tabId: 1, text: "✓" });
});

test("a text save shows a saving badge while Keepall is still working, then a check", async () => {
  const { api, badges, sent, finish } = worker();
  const done = api.saveSelection(TAB, { menuItemId: "save-to-keepall", selectionText: "Hello", pageUrl: TAB.url });
  const message = await sent;
  expect(badges[0]).toEqual({ tabId: 1, text: "…" });
  finish({ captureId: message.payload.captureId, itemId: "x", outcome: "created" });
  await done;
  await flush();
  expect(badges.at(-1)).toEqual({ tabId: 1, text: "✓" });
});
