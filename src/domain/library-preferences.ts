export const LIBRARY_PREFERENCES_ID = "library" as const;

export type LibraryPreferences = {
  id: typeof LIBRARY_PREFERENCES_ID;
  pinnedCollectionIds: string[];
};

export function normalizePinnedCollectionIds(
  ids: string[] | undefined,
  validCollectionIds?: Iterable<string>,
): string[] {
  const valid = validCollectionIds
    ? new Set(validCollectionIds)
    : null;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of ids ?? []) {
    if (!id || seen.has(id) || (valid && !valid.has(id))) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }

  return result;
}

export function buildLibraryPreferences(
  pinnedCollectionIds: string[] = [],
): LibraryPreferences {
  return {
    id: LIBRARY_PREFERENCES_ID,
    pinnedCollectionIds: normalizePinnedCollectionIds(pinnedCollectionIds),
  };
}

export function pinCollectionId(ids: string[], collectionId: string): string[] {
  return ids.includes(collectionId) ? ids : [...ids, collectionId];
}

export function unpinCollectionId(
  ids: string[],
  collectionId: string,
): string[] {
  return ids.filter((id) => id !== collectionId);
}

export function movePinnedCollection(
  ids: string[],
  sourceId: string,
  targetId: string,
): string[] {
  if (sourceId === targetId) {
    return ids;
  }
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return ids;
  }

  const next = ids.filter((id) => id !== sourceId);
  next.splice(next.indexOf(targetId), 0, sourceId);
  return next;
}

export function orderCollectionsByPins<T extends { id: string }>(
  collections: T[],
  pinnedCollectionIds: string[],
): T[] {
  const positions = new Map(
    normalizePinnedCollectionIds(
      pinnedCollectionIds,
      collections.map((collection) => collection.id),
    ).map((id, index) => [id, index]),
  );

  return collections
    .map((collection, inputIndex) => ({ collection, inputIndex }))
    .sort((left, right) => {
      const leftPin = positions.get(left.collection.id);
      const rightPin = positions.get(right.collection.id);
      if (leftPin !== undefined || rightPin !== undefined) {
        if (leftPin === undefined) return 1;
        if (rightPin === undefined) return -1;
        return leftPin - rightPin;
      }
      return left.inputIndex - right.inputIndex;
    })
    .map(({ collection }) => collection);
}
