import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, test, vi } from "vitest";

const workerSource = readFileSync("extension/worker.js", "utf8");
afterEach(() => { vi.useRealTimers(); });

type WorkerApi = {
  showFeedback: (tabId: number, message: string, success: boolean, source?: string) => Promise<void>;
  screenshotAfterSave: (tabId: number, savedMessage: string, actions: object | undefined) => Promise<{ message: string; success: boolean }>;
};

function worker() {
  // Fake timers must be installed before the context copies setTimeout.
  vi.useFakeTimers();
  const chrome = {
    storage: { local: { setAccessLevel: vi.fn(async () => {}), get: vi.fn(async () => ({})) }, session: {
      get: vi.fn(async () => ({})), set: vi.fn(async () => {}),
    }, onChanged: { addListener: vi.fn() } },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    runtime: { onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() }, getURL: (path: string) => `chrome-extension://test/${path}` },
    contextMenus: { onClicked: { addListener: vi.fn() } },
    tabs: { sendMessage: vi.fn(async () => {}), onUpdated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() } },
    scripting: { executeScript: vi.fn(async () => {}) },
    action: {
      onClicked: { addListener: vi.fn() },
      setBadgeBackgroundColor: vi.fn(async () => {}),
      setBadgeText: vi.fn(async (_details: { tabId?: number; text: string }) => {}),
      setTitle: vi.fn(async () => {}),
    },
    commands: { onCommand: { addListener: vi.fn() } },
  };
  const context = { chrome, crypto, URL, setTimeout, clearTimeout, btoa } as Record<string, unknown>;
  runInNewContext(workerSource, context);
  return { chrome, api: context as unknown as WorkerApi, context };
}

const clears = (chrome: ReturnType<typeof worker>["chrome"]) =>
  chrome.action.setBadgeText.mock.calls.filter(([arg]) => arg.text === "");

test("a newer save keeps its badge for a full 5 seconds", async () => {
  const { api, chrome } = worker();
  await api.showFeedback(1, "First", true, "badge");
  await vi.advanceTimersByTimeAsync(1000);
  await api.showFeedback(1, "Second", true, "badge");
  await vi.advanceTimersByTimeAsync(4500);
  expect(clears(chrome)).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(600);
  expect(clears(chrome)).toHaveLength(1);
});

test("a failure keeps its badge for 15 seconds", async () => {
  const { api, chrome } = worker();
  await api.showFeedback(1, "Could not save", false, "badge");
  await vi.advanceTimersByTimeAsync(14_000);
  expect(clears(chrome)).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1500);
  expect(clears(chrome)).toHaveLength(1);
});

test("a failed screenshot after a save is reported as a failure", async () => {
  const { api, context } = worker();
  expect(await api.screenshotAfterSave(1, "Link saved to Keepall", { canScreenshot: false })).toEqual({
    message: "Link saved to Keepall. Screenshot failed: Update Keepall to save screenshots.", success: false,
  });
  context.saveScreenshot = vi.fn(async () => ({ success: true, count: 1, limit: 8 }));
  expect(await api.screenshotAfterSave(1, "Link saved to Keepall", { canScreenshot: true })).toEqual({ message: "Page and screenshot saved", success: true });
});
