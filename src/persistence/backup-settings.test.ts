import { beforeEach, afterEach, expect, test, vi } from "vitest";
import Dexie from "dexie";
import { buildNote } from "@/domain/note";
import { exportKeepallBackup, importKeepallBackupReplace } from "./backup";
import { getDb, deleteKeepallDatabase } from "./db";
import {
  connectBackupFolder,
  disableBackupFolder,
  getBackupFolderSettings,
  observeBackupFolderStatus,
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
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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

test("upgrading version 9 preserves the existing folder configuration and library", async () => {
  const previous = new Dexie("keepall");
  previous.version(9).stores({
    items: "id, type, createdAt", tags: "id, name", collections: "id, name", assets: "id, contentHash",
    preferences: "id", thumbnails: "assetId", videoAssets: "id", backupSettings: "id",
  });
  const note = buildNote({ content: "Before scheduling" });
  const configuration = {
    id: "folder", libraryId, connectionId: "existing", enabled: true,
    directory: storedDirectory, completed: [], lastError: null, cleanupWarning: null,
  };
  await previous.table("items").put(note);
  await previous.table("backupSettings").put(configuration);
  previous.close();
  expect(await getDb().items.get(note.id)).toEqual(note);
  expect(await getBackupFolderSettings()).toEqual(configuration);
  expect(await getDb().backupState.get("library")).toBeUndefined();
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

test("backup coverage observes library edits and only clears them after a verified backup", async () => {
  restoreStoredHandle();
  await connectBackupFolder(handle());
  const changes = vi.fn();
  const errors = vi.fn();
  const stop = observeBackupFolderStatus(changes, errors);
  try {
    await vi.waitFor(() => expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ hasPendingChanges: false })));
    await getDb().items.add(buildNote({ content: "Not backed up yet" }));
    await vi.waitFor(() => expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ hasPendingChanges: true })));
    writeAutomaticBackup.mockRejectedValueOnce(new Error("Disk full"));
    await expect(saveFolderBackup()).rejects.toThrow("Disk full");
    await vi.waitFor(() => expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({
      hasPendingChanges: true, settings: expect.objectContaining({ lastError: expect.any(String) }),
    })));
    await saveFolderBackup();
    await vi.waitFor(() => expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ hasPendingChanges: false })));
    expect(errors).not.toHaveBeenCalled();
  } finally { stop(); }
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

function restoreStoredHandle(directory = handle()) {
  const table = getDb().backupSettings;
  const read = table.get.bind(table);
  vi.spyOn(table, "get").mockImplementation(((key: "folder") => read(key).then((stored) =>
    stored ? { ...stored, directory } : stored,
  )) as typeof table.get);
  return directory;
}

test("scheduled backups wait thirty minutes, then skip unchanged content without exporting", async () => {
  const { runScheduledFolderBackup, AUTOMATIC_BACKUP_INTERVAL_MS } = await import("./backup-settings");
  restoreStoredHandle();
  await getDb().items.add(buildNote({ content: "Original" }));
  await connectBackupFolder(handle());
  const initial = await getBackupFolderSettings();
  const due = initial!.lastAttemptAt! + AUTOMATIC_BACKUP_INTERVAL_MS;
  expect(await runScheduledFolderBackup(due)).toBe("unchanged");
  const note = buildNote({ content: "New" });
  await getDb().items.add(note);
  expect(await runScheduledFolderBackup(due - 1)).toBe("not-due");
  expect(await runScheduledFolderBackup(due)).toBe("saved");
  expect(writeAutomaticBackup).toHaveBeenCalledTimes(2);
  expect(await runScheduledFolderBackup(due)).toBe("unchanged");
});

test("edits during a backup stay pending for the next interval", async () => {
  const { runScheduledFolderBackup, AUTOMATIC_BACKUP_INTERVAL_MS } = await import("./backup-settings");
  restoreStoredHandle();
  await getDb().items.add(buildNote({ content: "Before" }));
  writeAutomaticBackup.mockImplementationOnce(async (_directory, blob, identity) => {
    await getDb().items.add(buildNote({ content: "During write" }));
    return { ...identity, fileName: "saved.keepall.zip", byteLength: blob.size, exportedAt: 1, completedAt: 2 };
  });
  await connectBackupFolder(handle());
  const saved = await getBackupFolderSettings();
  expect(saved?.lastBackupRevision).not.toBe((await getDb().backupState.get("library"))?.revision);
  expect(await runScheduledFolderBackup(saved!.lastAttemptAt! + AUTOMATIC_BACKUP_INTERVAL_MS)).toBe("saved");
});

test("failed scheduled writes preserve success and wait thirty minutes before retrying", async () => {
  const { runScheduledFolderBackup, AUTOMATIC_BACKUP_INTERVAL_MS } = await import("./backup-settings");
  restoreStoredHandle();
  await connectBackupFolder(handle());
  const before = await getBackupFolderSettings();
  await getDb().items.add(buildNote({ content: "New" }));
  const due = before!.lastAttemptAt! + AUTOMATIC_BACKUP_INTERVAL_MS;
  writeAutomaticBackup.mockRejectedValueOnce(new Error("Disk full"));
  expect(await runScheduledFolderBackup(due)).toBe("failed");
  expect((await getBackupFolderSettings())?.completed).toEqual(before?.completed);
  expect(await runScheduledFolderBackup(due + 60_000)).toBe("not-due");
  expect(await runScheduledFolderBackup(due + AUTOMATIC_BACKUP_INTERVAL_MS)).toBe("saved");
});

test("an unexpectedly empty library pauses writes and pruning until items are restored", async () => {
  const { runScheduledFolderBackup, AUTOMATIC_BACKUP_INTERVAL_MS } = await import("./backup-settings");
  restoreStoredHandle();
  const note = buildNote({ content: "Protect this" });
  await getDb().items.add(note);
  await connectBackupFolder(handle());
  const before = await getBackupFolderSettings();
  await getDb().items.clear();
  const due = before!.lastAttemptAt! + AUTOMATIC_BACKUP_INTERVAL_MS;
  expect(await runScheduledFolderBackup(due)).toBe("failed");
  expect(writeAutomaticBackup).toHaveBeenCalledOnce();
  expect(pruneAutomaticBackups).toHaveBeenCalledOnce();
  expect((await getBackupFolderSettings())?.lastError).toMatch(/empty/i);
  await expect(saveFolderBackup()).rejects.toThrow(/empty/i);
  await getDb().items.add(note);
  expect(await runScheduledFolderBackup(due + AUTOMATIC_BACKUP_INTERVAL_MS)).toBe("saved");
});

test("scheduled permission checks never prompt and competing tabs skip a held lock", async () => {
  const { runScheduledFolderBackup, AUTOMATIC_BACKUP_INTERVAL_MS } = await import("./backup-settings");
  const directory = restoreStoredHandle();
  await connectBackupFolder(handle());
  await getDb().items.add(buildNote({ content: "New" }));
  const settings = (await getBackupFolderSettings())!;
  const due = settings.lastAttemptAt! + AUTOMATIC_BACKUP_INTERVAL_MS;
  vi.mocked(directory.queryPermission).mockResolvedValue("prompt");
  expect(await runScheduledFolderBackup(due)).toBe("failed");
  expect(directory.requestPermission).not.toHaveBeenCalled();
  vi.stubGlobal("navigator", { locks: { request: vi.fn(async (_name, _options, action) => action(null)) } });
  expect(await runScheduledFolderBackup(due + AUTOMATIC_BACKUP_INTERVAL_MS)).toBe("busy");
  expect(writeAutomaticBackup).toHaveBeenCalledOnce();
});

test("turning off during archive generation prevents the later file write", async () => {
  const { runScheduledFolderBackup, AUTOMATIC_BACKUP_INTERVAL_MS } = await import("./backup-settings");
  const archive = await import("./backup-archive");
  restoreStoredHandle();
  await connectBackupFolder(handle());
  await getDb().items.add(buildNote({ content: "Pending" }));
  const settings = (await getBackupFolderSettings())!;
  let finish!: () => void;
  const exporting = vi.spyOn(archive, "exportKeepallArchive").mockImplementationOnce(() => new Promise((resolve) => {
    finish = () => resolve(new Blob(["archive"]));
  }));
  const pending = runScheduledFolderBackup(settings.lastAttemptAt! + AUTOMATIC_BACKUP_INTERVAL_MS);
  await vi.waitFor(() => expect(exporting).toHaveBeenCalledOnce());
  await disableBackupFolder();
  finish();
  expect(await pending).toBe("off");
  expect(writeAutomaticBackup).toHaveBeenCalledOnce();
  expect((await getBackupFolderSettings())?.enabled).toBe(false);
});
