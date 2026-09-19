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
  return buildLibraryPreferences(saved?.pinnedCollectionIds);
}

export async function putLibraryPreferences(
  pinnedCollectionIds: string[],
): Promise<LibraryPreferences> {
  const db = getDb();
  const collectionIds = await db.collections.toCollection().primaryKeys();
  const preferences = buildLibraryPreferences(
    normalizePinnedCollectionIds(pinnedCollectionIds, collectionIds),
  );
  await db.preferences.put(preferences);
  return preferences;
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
