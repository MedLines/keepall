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
  collectionIds: string[],
  collectionId: string,
): string[] {
  if (collectionIds.includes(collectionId)) {
    return collectionIds;
  }

  return [...collectionIds, collectionId];
}
