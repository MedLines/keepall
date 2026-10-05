import { beforeEach, afterEach, expect, test, vi } from "vitest";
import Dexie from "dexie";
import { buildNote } from "@/domain/note";
import { exportKeepallBackup, importKeepallBackupReplace } from "./backup";
import { getDb, deleteKeepallDatabase } from "./db";
import {
  connectBackupFolder,
  disableBackupFolder,
  getBackupFolderSettings,
  saveFolderBackup,
  type BackupFolderHandle,
} from "./backup-settings";

const { writeAutomaticBackup, pruneAutomaticBackups } = vi.hoisted(() => ({
  writeAutomaticBackup: vi.fn(), pruneAutomaticBackups: vi.fn(),
}));
vi.mock("./backup-folder", async (importOriginal) => ({
  ...await importOriginal<typeof import("./backup-folder")>(),
  writeAutomaticBackup, pruneAutomaticBackups,
}));

const libraryId = "11111111-1111-4111-8111-111111111111";
const storedDirectory = { kind: "directory", name: "Keepall Backups" } as BackupFolderHandle;

function handle(name = "Keepall Backups") {
  // Keep methods off enumerable fields so fake IndexedDB can clone this fixture.
  const directory = Object.assign(Object.create({
    queryPermission: vi.fn().mockResolvedValue("granted"),
    requestPermission: vi.fn().mockResolvedValue("granted"),
    isSameEntry: vi.fn().mockResolvedValue(true),
  }), { kind: "directory", name }) as BackupFolderHandle;
  return directory;
}

beforeEach(() => {
  vi.stubGlobal("navigator", {
    locks: { request: vi.fn(async (_name, _options, action) => action({ name: "keepall:folder-backup" })) },
  });
  writeAutomaticBackup.mockReset();
  pruneAutomaticBackups.mockReset();
  writeAutomaticBackup.mockImplementation(async (_directory, blob, identity) => ({
    ...identity, fileName: `${identity.snapshotId}.keepall.zip`, byteLength: blob.size,
    exportedAt: 123, completedAt: 456,
  }));
  pruneAutomaticBackups.mockImplementation(async (_directory, _libraryId, completed) => ({ backups: completed, cleanupError: null }));
});
afterEach(() => vi.unstubAllGlobals());

test("folder access is off until the user connects a folder", async () => {
  expect(await getBackupFolderSettings()).toBeUndefined();
});

test("upgrading an existing version 8 library preserves its items and adds no active folder", async () => {
  const previous = new Dexie("keepall");
  previous.version(8).stores({
    items: "id, type, createdAt", tags: "id, name", collections: "id, name", assets: "id, contentHash",
    preferences: "id", thumbnails: "assetId", videoAssets: "id",
  });
  const note = buildNote({ content: "Before folder backups" });
  await previous.table("items").put(note);
  previous.close();
  expect(await getDb().items.get(note.id)).toEqual(note);
  expect(await getBackupFolderSettings()).toBeUndefined();
});

test("a folder without write permission is not connected and no hidden request is made", async () => {
  const directory = handle();
  vi.mocked(directory.queryPermission).mockResolvedValue("prompt");
  await expect(connectBackupFolder(directory)).rejects.toMatchObject({ code: "permission-required" });
  expect(await getBackupFolderSettings()).toBeUndefined();
  expect(directory.requestPermission).not.toHaveBeenCalled();
  expect(writeAutomaticBackup).not.toHaveBeenCalled();
});

test("remembered folder settings and completion history are excluded from backups and fresh restores", async () => {
  await getDb().backupSettings.put({
    id: "folder", libraryId, connectionId: "connected", enabled: true,
    directory: storedDirectory, completed: [], lastError: null, cleanupWarning: null,
  });
  const note = buildNote({ content: "My library" });
  await getDb().items.put(note);
  const backup = await exportKeepallBackup();
  expect(JSON.stringify(backup)).not.toContain("Keepall Backups");
  expect(JSON.stringify(backup)).not.toContain("connectionId");
  await deleteKeepallDatabase();
  await importKeepallBackupReplace(backup);
  expect(await getBackupFolderSettings()).toBeUndefined();
  expect(await getDb().items.get(note.id)).toEqual(note);
});

test("connecting saves one verified backup and remembers the folder across reads", async () => {
  const directory = handle();
  await connectBackupFolder(directory);
  const settings = await getBackupFolderSettings();
  expect(settings).toMatchObject({ enabled: true, directory: { name: "Keepall Backups" }, lastError: null });
  expect(settings?.completed).toHaveLength(1);
  expect(writeAutomaticBackup).toHaveBeenCalledOnce();
  expect((await getBackupFolderSettings())?.completed).toEqual(settings?.completed);
});

test("a failed first backup keeps the connection pending and never claims success", async () => {
  writeAutomaticBackup.mockRejectedValue(new Error("Disk full"));
  await expect(connectBackupFolder(handle())).rejects.toThrow();
  expect(await getBackupFolderSettings()).toMatchObject({ enabled: true, completed: [], lastError: expect.any(String) });
  expect(pruneAutomaticBackups).not.toHaveBeenCalled();
});

test("turning off during a write cannot be undone by the late backup result", async () => {
  let finish!: () => void;
  writeAutomaticBackup.mockImplementationOnce((_directory, blob, identity) => new Promise((resolve) => {
    finish = () => resolve({ ...identity, fileName: "late.keepall.zip", byteLength: blob.size, exportedAt: 123, completedAt: 456 });
  }));
  const saving = connectBackupFolder(handle());
  await vi.waitFor(() => expect(writeAutomaticBackup).toHaveBeenCalledOnce());
  await disableBackupFolder();
  finish();
  await saving;
  expect(await getBackupFolderSettings()).toMatchObject({ enabled: false, completed: [] });
  expect(pruneAutomaticBackups).not.toHaveBeenCalled();
});

test("turning off preserves completion history and prevents another backup", async () => {
  await connectBackupFolder(handle());
  const completed = (await getBackupFolderSettings())?.completed;
  await disableBackupFolder();
  expect(await getBackupFolderSettings()).toMatchObject({ enabled: false, completed });
  await expect(saveFolderBackup()).rejects.toThrow();
  expect(writeAutomaticBackup).toHaveBeenCalledOnce();
});

test("a cleanup warning leaves the new backup recorded as successful", async () => {
  pruneAutomaticBackups.mockImplementation(async (_directory, _libraryId, completed) => ({
    backups: completed, cleanupError: new Error("Permission lost during cleanup"),
  }));
  await connectBackupFolder(handle());
  expect(await getBackupFolderSettings()).toMatchObject({ lastError: null, cleanupWarning: expect.any(String) });
  expect((await getBackupFolderSettings())?.completed).toHaveLength(1);
});

test("another tab's active job prevents a competing write", async () => {
  vi.stubGlobal("navigator", { locks: { request: vi.fn(async (_name, _options, action) => action(null)) } });
  await expect(connectBackupFolder(handle())).rejects.toThrow(/another Keepall tab/i);
  expect(writeAutomaticBackup).not.toHaveBeenCalled();
  expect(await getBackupFolderSettings()).toBeUndefined();
});

test("changing the destination starts its own history and cannot prune the previous folder's files", async () => {
  await connectBackupFolder(handle());
  const previous = await getBackupFolderSettings();
  const next = handle("Different backup folder");
  vi.mocked(next.isSameEntry).mockResolvedValue(false);
  await connectBackupFolder(next);
  const settings = await getBackupFolderSettings();
  expect(settings?.directory.name).toBe("Different backup folder");
  expect(settings?.libraryId).toBe(previous?.libraryId);
  expect(settings?.completed).toHaveLength(1);
  expect(pruneAutomaticBackups.mock.calls.at(-1)?.[2]).toHaveLength(1);
  expect(settings?.completed[0].snapshotId).not.toBe(previous?.completed[0].snapshotId);
});
