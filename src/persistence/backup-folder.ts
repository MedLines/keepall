import { automaticBackupFileName, type AutomaticBackupIdentity } from "@/domain/automatic-backup";
import { readAutomaticBackupMetadata, validateKeepallArchive } from "./backup-archive";

type BackupFile = {
  getFile(): Promise<Blob>;
  createWritable(): Promise<Pick<FileSystemWritableFileStream, "write" | "close" | "abort">>;
};

export type BackupDirectory = {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<BackupFile>;
  removeEntry(name: string): Promise<void>;
};

export type CompletedAutomaticBackup = AutomaticBackupIdentity & {
  fileName: string;
  exportedAt: number;
  completedAt: number;
  byteLength: number;
};

type BackupFolderErrorCode = "permission-required" | "file-exists" | "write-failed" | "verification-failed";

export class BackupFolderError extends Error {
  constructor(public readonly code: BackupFolderErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "BackupFolderError";
  }
}

function folderError(code: BackupFolderErrorCode, message: string, cause: unknown) {
  if (cause instanceof DOMException && cause.name === "NotAllowedError") {
    return new BackupFolderError("permission-required", "Reconnect the backup folder to allow writing.", cause);
  }
  return new BackupFolderError(code, message, cause);
}

async function requirePermission(directory: BackupDirectory) {
  if (await directory.queryPermission({ mode: "readwrite" }) !== "granted") {
    throw new BackupFolderError("permission-required", "Reconnect the backup folder to allow writing.");
  }
}

async function requireNewFile(directory: BackupDirectory, name: string) {
  try {
    await directory.getFileHandle(name);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return;
    throw error;
  }
  throw new BackupFolderError("file-exists", "A backup with this name already exists. Try again with a new snapshot.");
}

async function writeFile(directory: BackupDirectory, name: string, data: Blob | string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const handle = await directory.getFileHandle(name, { create: true });
  const stream = await handle.createWritable();
  try {
    signal?.throwIfAborted();
    await stream.write(data);
    signal?.throwIfAborted();
    await stream.close();
  } catch (error) {
    // Aborting can itself fail after the browser has closed or lost the stream.
    await stream.abort().catch(() => {});
    throw error;
  }
  return handle;
}

async function verifyBytes(expected: Blob, saved: Blob, signal?: AbortSignal) {
  if (saved.size !== expected.size) throw new Error("Backup size changed while saving");
  // Compare bounded chunks rather than allocate another full copy of a large library.
  const chunkSize = 1024 * 1024;
  for (let offset = 0; offset < expected.size; offset += chunkSize) {
    signal?.throwIfAborted();
    const [left, right] = await Promise.all([
      expected.slice(offset, offset + chunkSize).arrayBuffer(),
      saved.slice(offset, offset + chunkSize).arrayBuffer(),
    ]);
    const bytes = new Uint8Array(left);
    const savedBytes = new Uint8Array(right);
    if (bytes.length !== savedBytes.length || bytes.some((byte, index) => byte !== savedBytes[index])) {
      throw new Error("Backup bytes changed while saving");
    }
  }
}

function matchesRecord(value: unknown, expected: CompletedAutomaticBackup): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.format === "keepall-automatic-backup" && record.version === 1 &&
    record.libraryId === expected.libraryId && record.snapshotId === expected.snapshotId &&
    record.fileName === expected.fileName && record.exportedAt === expected.exportedAt &&
    record.completedAt === expected.completedAt && record.byteLength === expected.byteLength;
}

export async function writeAutomaticBackup(
  directory: BackupDirectory,
  archive: Blob,
  identity: AutomaticBackupIdentity,
  signal?: AbortSignal,
): Promise<CompletedAutomaticBackup> {
  signal?.throwIfAborted();
  await requirePermission(directory);
  let exportedAt: number;
  try {
    const metadata = await readAutomaticBackupMetadata(archive);
    if (metadata.automaticBackup?.libraryId !== identity.libraryId || metadata.automaticBackup.snapshotId !== identity.snapshotId) {
      throw new Error("Backup identity does not match the selected library");
    }
    exportedAt = metadata.exportedAt;
  } catch (error) {
    throw new BackupFolderError("verification-failed", "The backup archive could not be verified. Existing backups were kept.", error);
  }
  const fileName = automaticBackupFileName(identity, exportedAt);
  const markerName = `${fileName}.complete.json`;
  await requireNewFile(directory, fileName);
  await requireNewFile(directory, markerName);
  let handle: BackupFile;
  try {
    handle = await writeFile(directory, fileName, archive, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw folderError("write-failed", "Could not save the backup. Check folder access and available disk space.", error);
  }
  try {
    const saved = await handle.getFile();
    await verifyBytes(archive, saved, signal);
    await validateKeepallArchive(saved);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw folderError("verification-failed", "The saved backup could not be verified. Existing backups were kept.", error);
  }
  const completed: CompletedAutomaticBackup = { ...identity, fileName, exportedAt, completedAt: Date.now(), byteLength: archive.size };
  try {
    const marker = await writeFile(directory, markerName, JSON.stringify({ format: "keepall-automatic-backup", version: 1, ...completed }), signal);
    if (!matchesRecord(JSON.parse(await (await marker.getFile()).text()), completed)) {
      throw new Error("Backup completion record could not be verified");
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw folderError("write-failed", "The backup completion record could not be saved. Existing backups were kept.", error);
  }
  return completed;
}

async function verifyCompletedBackup(directory: BackupDirectory, completed: CompletedAutomaticBackup) {
  if (completed.fileName !== automaticBackupFileName(completed, completed.exportedAt)) {
    throw new Error("Backup filename does not match its identity");
  }
  const marker = await (await directory.getFileHandle(`${completed.fileName}.complete.json`)).getFile();
  if (marker.size > 4096 || !matchesRecord(JSON.parse(await marker.text()), completed)) {
    throw new Error("Backup completion record is missing or changed");
  }
  const archive = await (await directory.getFileHandle(completed.fileName)).getFile();
  if (archive.size !== completed.byteLength) throw new Error("Completed backup size has changed");
  const metadata = await readAutomaticBackupMetadata(archive);
  if (metadata.exportedAt !== completed.exportedAt || metadata.automaticBackup?.libraryId !== completed.libraryId ||
      metadata.automaticBackup.snapshotId !== completed.snapshotId) {
    throw new Error("Completed backup identity has changed");
  }
}

/** Call only after a new verified backup; the caller serializes jobs across tabs. */
export async function pruneAutomaticBackups(
  directory: BackupDirectory,
  libraryId: string,
  completed: CompletedAutomaticBackup[],
): Promise<{ backups: CompletedAutomaticBackup[]; cleanupError: Error | null }> {
  const removed = new Set<string>();
  try {
    await requirePermission(directory);
    const ownBackups = completed.filter((backup) => backup.libraryId === libraryId)
      .sort((a, b) => b.exportedAt - a.exportedAt || b.completedAt - a.completedAt);
    if (new Set(ownBackups.map((backup) => backup.fileName)).size !== ownBackups.length) {
      throw new Error("Backup history contains duplicate filenames");
    }
    if (ownBackups.length <= 3) return { backups: completed, cleanupError: null };
    // Verify every retained and removable record before deleting any archive.
    for (const backup of ownBackups) await verifyCompletedBackup(directory, backup);
    for (const backup of ownBackups.slice(3)) {
      await directory.removeEntry(backup.fileName);
      removed.add(backup.fileName);
      await directory.removeEntry(`${backup.fileName}.complete.json`);
    }
    return { backups: completed.filter((backup) => !removed.has(backup.fileName)), cleanupError: null };
  } catch (error) {
    return {
      backups: completed.filter((backup) => !removed.has(backup.fileName)),
      cleanupError: error instanceof Error ? error : new Error("Could not clean up older backups"),
    };
  }
}
