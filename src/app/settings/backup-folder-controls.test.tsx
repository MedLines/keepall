import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { BackupFolderControls } from "./backup-folder-controls";
import { BackupFolderError } from "@/persistence/backup-folder";
import type { BackupFolderHandle, BackupFolderSettings } from "@/persistence/backup-settings";

const mocks = vi.hoisted(() => ({
  supportsFolderBackups: vi.fn(), chooseBackupFolder: vi.fn(), connectBackupFolder: vi.fn(),
  saveFolderBackup: vi.fn(), disableBackupFolder: vi.fn(), observeBackupFolderSettings: vi.fn(),
}));
vi.mock("@/persistence/backup-settings", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/persistence/backup-settings")>(), ...mocks,
}));

let emit: (settings: BackupFolderSettings | undefined) => void;
let current: BackupFolderSettings | undefined;
const directory = {
  name: "Keepall Backups", kind: "directory",
  queryPermission: vi.fn().mockResolvedValue("granted"),
  requestPermission: vi.fn().mockResolvedValue("granted"),
} as unknown as BackupFolderHandle;

function settings(completed = true): BackupFolderSettings {
  return {
    id: "folder", libraryId: "library", connectionId: "connection", enabled: true, directory,
    completed: completed ? [{ libraryId: "library", snapshotId: "snapshot", fileName: "saved.keepall.zip", exportedAt: 123, completedAt: 456, byteLength: 100 }] : [],
    lastError: null, cleanupWarning: null,
  };
}

beforeEach(() => {
  current = undefined;
  for (const mock of Object.values(mocks)) mock.mockReset();
  directory.queryPermission = vi.fn().mockResolvedValue("granted");
  directory.requestPermission = vi.fn().mockResolvedValue("granted");
  mocks.supportsFolderBackups.mockReturnValue(true);
  mocks.chooseBackupFolder.mockResolvedValue(directory);
  mocks.observeBackupFolderSettings.mockImplementation((listener) => {
    emit = (next) => { current = next; listener(next); };
    queueMicrotask(() => emit(current));
    return () => {};
  });
  mocks.connectBackupFolder.mockImplementation(async () => emit(settings()));
  mocks.saveFolderBackup.mockResolvedValue(undefined);
  mocks.disableBackupFolder.mockImplementation(async () => emit({ ...settings(), enabled: false }));
});
afterEach(() => vi.restoreAllMocks());

test("starts off, explains folder access, and saves the first backup only after a click", async () => {
  render(<BackupFolderControls />);
  const choose = await screen.findByRole("button", { name: "Choose backup folder" });
  expect(screen.getByText(/read and write access/i)).toBeVisible();
  expect(screen.getByText(/future visits and app updates/i)).toBeVisible();
  expect(screen.getByText(/every 30 minutes while the app is open/i)).toBeVisible();
  expect(mocks.chooseBackupFolder).not.toHaveBeenCalled();
  fireEvent.click(choose);
  expect(await screen.findByText("Keepall Backups")).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "Back up now" })).toBeEnabled());
  expect(screen.getByText("Last verified backup")).toBeVisible();
  expect(mocks.connectBackupFolder).toHaveBeenCalledOnce();
});

test("canceling the picker leaves folder backups off without an error", async () => {
  mocks.chooseBackupFolder.mockResolvedValue(null);
  render(<BackupFolderControls />);
  fireEvent.click(await screen.findByRole("button", { name: "Choose backup folder" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Choose backup folder" })).toBeEnabled());
  expect(mocks.connectBackupFolder).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("reload remembers success and revoked access needs an explicit reconnect", async () => {
  current = settings();
  directory.queryPermission = vi.fn().mockResolvedValue("prompt");
  render(<BackupFolderControls />);
  const reconnect = await screen.findByRole("button", { name: "Reconnect folder" });
  expect(directory.requestPermission).not.toHaveBeenCalled();
  expect(screen.getByText("Last verified backup")).toBeVisible();
  fireEvent.click(reconnect);
  await waitFor(() => expect(directory.requestPermission).toHaveBeenCalledOnce());
  await waitFor(() => expect(mocks.connectBackupFolder).toHaveBeenCalledOnce());
});

test("an unsuccessful first backup shows failure and offers retry without a success date", async () => {
  mocks.connectBackupFolder.mockImplementation(async () => {
    emit({ ...settings(false), lastError: "Disk full. Try again." });
    throw new BackupFolderError("write-failed", "Disk full. Try again.");
  });
  render(<BackupFolderControls />);
  fireEvent.click(await screen.findByRole("button", { name: "Choose backup folder" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Disk full");
  expect(screen.getByText("No completed backup yet")).toBeVisible();
  expect(screen.getByRole("button", { name: "Back up now" })).toBeEnabled();
});

test("turning off during a pending backup cancels it and keeps existing files", async () => {
  current = settings();
  let finish!: () => void;
  let signal: AbortSignal | undefined;
  mocks.saveFolderBackup.mockImplementation((nextSignal) => {
    signal = nextSignal;
    return new Promise<void>((resolve) => { finish = resolve; });
  });
  render(<BackupFolderControls />);
  fireEvent.click(await screen.findByRole("button", { name: "Back up now" }));
  fireEvent.click(screen.getByRole("button", { name: "Turn off folder backups" }));
  expect(signal?.aborted).toBe(true);
  await waitFor(() => expect(mocks.disableBackupFolder).toHaveBeenCalledOnce());
  finish();
  expect(await screen.findByRole("button", { name: "Enable folder backups" })).toBeVisible();
  expect(screen.getByText("Last verified backup")).toBeVisible();
});

test("unsupported browsers explain the manual export fallback", async () => {
  mocks.supportsFolderBackups.mockReturnValue(false);
  render(<BackupFolderControls />);
  expect(await screen.findByText(/folder backups are not supported/i)).toBeVisible();
  expect(screen.getByText(/Export backup above/i)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Choose backup folder" })).not.toBeInTheDocument();
  expect(mocks.chooseBackupFolder).not.toHaveBeenCalled();
});
