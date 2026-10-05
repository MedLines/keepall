import { liveQuery } from "dexie";
import { getDb } from "./db";
import { exportKeepallArchive } from "./backup-archive";
import { BackupFolderError, pruneAutomaticBackups, writeAutomaticBackup, type CompletedAutomaticBackup } from "./backup-folder";

export type BackupFolderHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
};

export type BackupFolderSettings = {
  id: "folder";
  libraryId: string;
  connectionId: string;
  enabled: boolean;
  directory: BackupFolderHandle;
  completed: CompletedAutomaticBackup[];
  lastError: string | null;
  cleanupWarning: string | null;
};

type PickerWindow = Window & {
  showDirectoryPicker?: (options: { id: string; mode: "readwrite" }) => Promise<BackupFolderHandle>;
};

export function supportsFolderBackups(): boolean {
  return typeof window !== "undefined" && window.isSecureContext &&
    typeof (window as PickerWindow).showDirectoryPicker === "function" &&
    typeof navigator.locks?.request === "function";
}

/** Invoke directly from the click handler, before awaiting database or export work. */
export async function chooseBackupFolder(): Promise<BackupFolderHandle | null> {
  const pickerWindow = window as PickerWindow;
  if (!supportsFolderBackups() || !pickerWindow.showDirectoryPicker) {
    throw new BackupFolderError("write-failed", "Folder backups are not supported in this browser. Use Export backup instead.");
  }
  try {
    return await pickerWindow.showDirectoryPicker({ id: "keepall-backups", mode: "readwrite" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

export function getBackupFolderSettings() {
  return getDb().backupSettings.get("folder");
}

export function observeBackupFolderSettings(
  onChange: (settings: BackupFolderSettings | undefined) => void,
  onError: (error: unknown) => void,
): () => void {
  const subscription = liveQuery(getBackupFolderSettings).subscribe({ next: onChange, error: onError });
  return () => subscription.unsubscribe();
}

export function backupFailureMessage(error: unknown): string {
  return error instanceof BackupFolderError ? error.message :
    "Couldn't save the backup. Check folder access and disk space, then try again.";
}

async function updateConnection(settings: BackupFolderSettings, changes: Partial<BackupFolderSettings>) {
  const db = getDb();
  return db.transaction("rw", db.backupSettings, async () => {
    const current = await db.backupSettings.get("folder");
    // A disabled or replaced connection must not be revived by a late job.
    if (!current || current.connectionId !== settings.connectionId || !current.enabled) return null;
    const next = { ...current, ...changes };
    await db.backupSettings.put(next);
    return next;
  });
}

async function withBackupLock<T>(job: () => Promise<T>): Promise<T> {
  return navigator.locks.request("keepall:folder-backup", { ifAvailable: true }, async (lock) => {
    if (!lock) throw new BackupFolderError("write-failed", "Another Keepall tab is saving a backup. Try again shortly.");
    return job();
  });
}

async function saveConnectedBackup(settings: BackupFolderSettings, signal?: AbortSignal) {
  try {
    signal?.throwIfAborted();
    if (await settings.directory.queryPermission({ mode: "readwrite" }) !== "granted") {
      throw new BackupFolderError("permission-required", "Reconnect the backup folder to allow writing.");
    }
    const identity = { libraryId: settings.libraryId, snapshotId: crypto.randomUUID() };
    const archive = await exportKeepallArchive(Date.now(), identity);
    const completed = await writeAutomaticBackup(settings.directory, archive, identity, signal);
    signal?.throwIfAborted();
    // Persist the new success before pruning, so a crash cannot lose its receipt.
    const saved = await updateConnection(settings, {
      completed: [...settings.completed, completed], lastError: null, cleanupWarning: null,
    });
    if (!saved || signal?.aborted) return;
    const cleaned = await pruneAutomaticBackups(settings.directory, settings.libraryId, saved.completed);
    await updateConnection(settings, {
      completed: cleaned.backups,
      cleanupWarning: cleaned.cleanupError ? "Backup saved, but older backups couldn't be removed. Try Back up now again later." : null,
    });
  } catch (error) {
    if (!signal?.aborted) await updateConnection(settings, { lastError: backupFailureMessage(error) });
    throw error;
  }
}

export function connectBackupFolder(directory: BackupFolderHandle, signal?: AbortSignal) {
  return withBackupLock(async () => {
    signal?.throwIfAborted();
    if (await directory.queryPermission({ mode: "readwrite" }) !== "granted") {
      throw new BackupFolderError("permission-required", "Reconnect the backup folder to allow writing.");
    }
    const previous = await getBackupFolderSettings();
    const sameFolder = previous ? await directory.isSameEntry(previous.directory).catch(() => false) : false;
    const settings: BackupFolderSettings = {
      id: "folder", libraryId: previous?.libraryId ?? crypto.randomUUID(), connectionId: crypto.randomUUID(),
      enabled: true, directory, completed: sameFolder ? previous!.completed : [],
      lastError: null, cleanupWarning: null,
    };
    signal?.throwIfAborted();
    await getDb().backupSettings.put(settings);
    await saveConnectedBackup(settings, signal);
  });
}

export function saveFolderBackup(signal?: AbortSignal) {
  return withBackupLock(async () => {
    const settings = await getBackupFolderSettings();
    if (!settings?.enabled) throw new BackupFolderError("write-failed", "Choose or enable a backup folder first.");
    await saveConnectedBackup(settings, signal);
  });
}

export async function disableBackupFolder() {
  const db = getDb();
  await db.transaction("rw", db.backupSettings, async () => {
    const settings = await db.backupSettings.get("folder");
    if (settings) await db.backupSettings.put({
      ...settings, enabled: false, connectionId: crypto.randomUUID(), lastError: null, cleanupWarning: null,
    });
  });
}
