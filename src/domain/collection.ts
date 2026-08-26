export type Collection = {
  id: string;
  name: string;
  createdAt: number;
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
