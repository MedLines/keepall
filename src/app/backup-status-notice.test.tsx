import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { BackupFolderSettings } from "@/persistence/backup-settings";
import { BackupStatusNotice } from "./backup-status-notice";

const mocks = vi.hoisted(() => ({ observe: vi.fn(), supported: vi.fn(), stop: vi.fn() }));
vi.mock("@/persistence/backup-settings", () => ({ observeBackupFolderSettings: mocks.observe, supportsFolderBackups: mocks.supported }));
let publish: (settings: BackupFolderSettings | undefined) => void;
const permission = vi.fn();
function settings(changes: Partial<BackupFolderSettings> = {}): BackupFolderSettings {
  return { id: "folder", libraryId: "library", connectionId: "connection", enabled: true,
    directory: { queryPermission: permission } as unknown as BackupFolderSettings["directory"], completed: [], lastError: null, cleanupWarning: null, ...changes };
}
async function update(value: BackupFolderSettings | undefined) {
  await act(async () => { publish(value); });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.supported.mockReturnValue(true);
  permission.mockResolvedValue("granted");
  mocks.observe.mockImplementation((callback) => { publish = callback; return mocks.stop; });
});

test("stays quiet for absent, healthy and disabled backups", async () => {
  render(<BackupStatusNotice />);
  await update(undefined);
  await update(settings());
  await update(settings({ enabled: false, lastError: "Failed" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("does not observe unsupported browsers", () => {
  mocks.supported.mockReturnValue(false);
  render(<BackupStatusNotice />);
  expect(mocks.observe).not.toHaveBeenCalled();
});

test("failed backups offer a recovery path and suggest export", async () => {
  render(<BackupStatusNotice />);
  await update(settings({ lastError: "raw error" }));
  expect(screen.getByRole("status")).toHaveTextContent("Folder backup failed");
  expect(screen.getByRole("link", { name: "Review backups" })).toHaveAttribute("href", "/settings#backup-heading");
  expect(screen.getByRole("status")).toHaveTextContent("export a backup");
});

test("dismissal survives repeated failures, resets on recovery and changed connection", async () => {
  render(<BackupStatusNotice />);
  const failed = settings({ lastError: "Failed" });
  await update(failed);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  await update(failed);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await update(settings());
  await update(failed);
  expect(screen.getByRole("status")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  await update(settings({ ...failed, connectionId: "replacement" }));
  expect(screen.getByRole("status")).toBeInTheDocument();
});

test("checks lost permission on focus, then removes listeners and observer on unmount", async () => {
  const { unmount } = render(<BackupStatusNotice />);
  await update(settings());
  permission.mockResolvedValue("prompt");
  fireEvent.focus(window);
  await waitFor(() => expect(screen.getByRole("link", { name: "Reconnect folder" })).toBeInTheDocument());
  const calls = permission.mock.calls.length;
  unmount();
  expect(mocks.stop).toHaveBeenCalledOnce();
  fireEvent.focus(window);
  expect(permission).toHaveBeenCalledTimes(calls);
});

test("permission query failure offers reconnect, without requesting permission", async () => {
  permission.mockRejectedValue(new Error("Lost access"));
  render(<BackupStatusNotice />);
  await update(settings());
  expect(screen.getByRole("status")).toHaveTextContent("Folder backups paused");
});
