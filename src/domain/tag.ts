export type Tag = {
  id: string;
  name: string;
  createdAt: number;
};

export type CreateTagInput = {
  name: string;
};

export class TagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TagValidationError";
  }
}

export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function buildTag(
  input: CreateTagInput,
  options?: { id?: string; now?: number },
): Tag {
  const name = normalizeTagName(input.name);

  if (!name) {
    throw new TagValidationError("Tag name is required");
  }

  const now = options?.now ?? Date.now();

  return {
    id: options?.id ?? crypto.randomUUID(),
    name,
    createdAt: now,
  };
}

export function assignTagId(tagIds: string[], tagId: string): string[] {
  if (tagIds.includes(tagId)) {
    return tagIds;
  }

  return [...tagIds, tagId];
}

/** Drop one tag id from an item; the tag row in the library is unchanged. */
export function removeTagId(tagIds: string[], tagId: string): string[] {
  return tagIds.filter((id) => id !== tagId);
}
