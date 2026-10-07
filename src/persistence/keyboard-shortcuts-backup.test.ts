import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, test } from "vitest";
import { DEFAULT_SHORTCUTS } from "@/domain/keyboard-shortcuts";
import { buildKeepallBackup, parseKeepallBackup } from "@/domain/backup";
import { deleteKeepallDatabase } from "./db";
import { exportKeepallBackup, importKeepallBackupMerge, importKeepallBackupReplace } from "./backup";
import { exportKeepallArchive, importKeepallArchiveMerge, importKeepallArchiveReplace } from "./backup-archive";
import { createCollection } from "./collections";
import { getLibraryPreferences, pinCollection, putKeyboardShortcuts } from "./library-preferences";
import { readBackupSnapshot } from "./backup-snapshot";

const custom = { capture: "Ctrl+Shift+KeyJ", search: "KeyS", toggleLayout: "F8", preview: "Shift+KeyP" };

describe("shortcut backup preferences", () => {
  test.each(["JSON", "ZIP", "folder"] as const)("%s replacement restores shortcuts and merge keeps the device's current shortcuts", async format => {
    await putKeyboardShortcuts(custom);
    const snapshot = await readBackupSnapshot();
    const backup = format === "JSON" ? await exportKeepallBackup() : await exportKeepallArchive(123, undefined, format === "folder" ? snapshot : undefined);
    const readable = backup instanceof Blob ? new NodeBlob([new Uint8Array(await backup.arrayBuffer())]) as unknown as Blob : backup;
    await deleteKeepallDatabase();
    if (!(readable instanceof NodeBlob)) await importKeepallBackupReplace(readable);
    else await importKeepallArchiveReplace(readable as unknown as Blob);
    expect((await getLibraryPreferences()).keyboardShortcuts).toEqual(custom);
    const local = { ...DEFAULT_SHORTCUTS, capture: "Alt+KeyL" };
    await putKeyboardShortcuts(local);
    if (!(readable instanceof NodeBlob)) await importKeepallBackupMerge(readable);
    else await importKeepallArchiveMerge(readable as unknown as Blob);
    expect((await getLibraryPreferences()).keyboardShortcuts).toEqual(local);
  });
  test("pins preserve shortcuts and older replacements fall back to defaults", async () => {
    await putKeyboardShortcuts(custom);
    const collection = await createCollection({ name: "Reading" });
    await pinCollection(collection.id);
    expect((await getLibraryPreferences()).keyboardShortcuts).toEqual(custom);
    await importKeepallBackupReplace(buildKeepallBackup({ items: [], collections: [], tags: [] }));
    expect((await getLibraryPreferences()).keyboardShortcuts).toBeUndefined();
  });
  test("invalid or duplicate shortcuts reject a backup before replacement", async () => {
    const backup = buildKeepallBackup({ items: [], tags: [], collections: [] });
    const raw = { ...backup, preferences: { pinnedCollectionIds: [], keyboardShortcuts: { ...custom, search: custom.capture } } };
    expect(() => parseKeepallBackup(raw)).toThrow(/already assigned/);
  });
});
