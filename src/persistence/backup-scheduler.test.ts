import { afterEach, expect, test, vi } from "vitest";
import { startBackupScheduler } from "./backup-scheduler";

const mocks = vi.hoisted(() => ({ run: vi.fn(), observe: vi.fn() }));
vi.mock("./backup-settings", () => ({
  runScheduledFolderBackup: mocks.run,
  observeBackupFolderSettings: mocks.observe,
}));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

test("checks on startup, once a minute and on visible resume, then stops", async () => {
  vi.useFakeTimers();
  mocks.run.mockResolvedValue("unchanged");
  mocks.observe.mockReturnValue(() => {});
  const stop = startBackupScheduler();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.run).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.run).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.run).toHaveBeenCalledTimes(3);
  stop();
  await vi.advanceTimersByTimeAsync(60_000);
  window.dispatchEvent(new Event("focus"));
  expect(mocks.run).toHaveBeenCalledTimes(3);
});

test("hidden tabs wait for visibility and repeated events cannot overlap jobs", async () => {
  vi.useFakeTimers();
  mocks.run.mockReset();
  mocks.observe.mockReturnValue(() => {});
  const visible = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const stop = startBackupScheduler();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.run).not.toHaveBeenCalled();
  let finish!: () => void;
  mocks.run.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  visible.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.run).toHaveBeenCalledOnce();
  const signal = mocks.run.mock.calls[0][1] as AbortSignal;
  stop();
  expect(signal.aborted).toBe(true);
  finish();
});
