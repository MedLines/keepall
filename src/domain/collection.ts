export type Collection = {
  id: string;
  name: string;
  createdAt: number;
  pinnedItemIds: string[];
};

export type CreateCollectionInput = {
  name: string;
};

export class CollectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionValidationError";
  }
}

export function normalizeCollectionName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function buildCollection(
  input: CreateCollectionInput,
  options?: { id?: string; now?: number },
): Collection {
  const name = normalizeCollectionName(input.name);

  if (!name) {
    throw new CollectionValidationError("Collection name is required");
  }

  const now = options?.now ?? Date.now();

  return {
    id: options?.id ?? crypto.randomUUID(),
    name,
    createdAt: now,
    pinnedItemIds: [],
  };
}

export function assignCollectionId(
  _collectionIds: string[],
  collectionId: string,
): string[] {
  return [collectionId];
}

/** Exclusive membership: keep first id only (migrate legacy multi-id rows). */
export function coerceExclusiveCollectionIds(
  collectionIds: string[],
): string[] {
  const first = collectionIds[0];
  return first ? [first] : [];
}

export function clearCollectionId(
  collectionIds: string[],
  collectionId: string,
): string[] {
  return collectionIds.filter((id) => id !== collectionId);
}

/** Dedupe pin ids and drop empty strings (coerce-on-read for older rows). */
export function coercePinnedItemIds(
  pinnedItemIds: string[] | undefined,
): string[] {
  if (!pinnedItemIds) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of pinnedItemIds) {
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

export function normalizeCollection(raw: Collection): Collection {
  return {
    ...raw,
    pinnedItemIds: coercePinnedItemIds(raw.pinnedItemIds),
  };
}

export function pinItemId(pinnedItemIds: string[], itemId: string): string[] {
  if (pinnedItemIds.includes(itemId)) {
    return pinnedItemIds;
  }
  return [...pinnedItemIds, itemId];
}

export function unpinItemId(pinnedItemIds: string[], itemId: string): string[] {
  return pinnedItemIds.filter((id) => id !== itemId);
}

export function isItemPinnedInCollection(
  collection: Pick<Collection, "pinnedItemIds">,
  itemId: string,
): boolean {
  return collection.pinnedItemIds.includes(itemId);
}
