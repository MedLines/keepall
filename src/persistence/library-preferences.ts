import { validateShortcuts, type KeyboardShortcuts } from "@/domain/keyboard-shortcuts";
import {
  buildLibraryPreferences,
  movePinnedCollection,
  normalizePinnedCollectionIds,
  pinCollectionId,
  unpinCollectionId,
  type LibraryPreferences,
} from "@/domain/library-preferences";
import { getDb } from "./db";

export async function getLibraryPreferences(): Promise<LibraryPreferences> {
  const saved = await getDb().preferences.get("library");
  return buildLibraryPreferences(saved?.pinnedCollectionIds, saved?.keyboardShortcuts);
}

export async function putLibraryPreferences(
  pinnedCollectionIds: string[],
): Promise<LibraryPreferences> {
  const db = getDb();
  return db.transaction("rw", db.collections, db.preferences, async () => {
    const collectionIds = await db.collections.toCollection().primaryKeys();
    const saved = await db.preferences.get("library");
    const preferences = buildLibraryPreferences(
      normalizePinnedCollectionIds(pinnedCollectionIds, collectionIds), saved?.keyboardShortcuts,
    );
    await db.preferences.put(preferences);
    return preferences;
  });
}

export async function pinCollection(
  collectionId: string,
): Promise<LibraryPreferences> {
  const db = getDb();
  if (!(await db.collections.get(collectionId))) {
    throw new Error("Collection not found");
  }
  const current = await getLibraryPreferences();
  return putLibraryPreferences(
    pinCollectionId(current.pinnedCollectionIds, collectionId),
  );
}

export async function unpinCollection(
  collectionId: string,
): Promise<LibraryPreferences> {
  const current = await getLibraryPreferences();
  return putLibraryPreferences(
    unpinCollectionId(current.pinnedCollectionIds, collectionId),
  );
}

export async function movePinnedCollectionBefore(
  sourceId: string,
  targetId: string,
): Promise<LibraryPreferences> {
  const current = await getLibraryPreferences();
  return putLibraryPreferences(
    movePinnedCollection(current.pinnedCollectionIds, sourceId, targetId),
  );
}

export async function putKeyboardShortcuts(keyboardShortcuts: KeyboardShortcuts): Promise<void> {
  const shortcuts = validateShortcuts(keyboardShortcuts);
  const db = getDb();
  await db.transaction("rw", db.preferences, async () => {
    const current = await db.preferences.get("library");
    await db.preferences.put({ ...buildLibraryPreferences(current?.pinnedCollectionIds), keyboardShortcuts: shortcuts });
  });
}
