import { normalizeCollectionName } from "./collection";
import type { Item } from "./item";
import { normalizeTagName } from "./tag";

export type CaptureOrgDrafts = {
  tagNames: string[];
  collectionName: string | null;
};

type CaptureOrganization = {
  id: string;
  name: string;
};

type CaptureOrganizationKind = "collection" | "tag";

/** Rank existing organizations for the compact capture picker. */
export function rankCaptureOrganizations<T extends CaptureOrganization>(
  entries: T[],
  items: Item[],
  kind: CaptureOrganizationKind,
): T[] {
  const usage = new Map<string, { count: number; lastUsedAt: number }>();

  for (const entry of entries) {
    usage.set(entry.id, { count: 0, lastUsedAt: 0 });
  }

  for (const item of items) {
    const ids = kind === "collection" ? item.collectionIds : item.tagIds;
    for (const id of new Set(ids)) {
      const current = usage.get(id);
      if (!current) {
        continue;
      }
      current.count += 1;
      current.lastUsedAt = Math.max(current.lastUsedAt, item.createdAt);
    }
  }

  return [...entries].sort((left, right) => {
    const leftUsage = usage.get(left.id)!;
    const rightUsage = usage.get(right.id)!;
    return (
      rightUsage.count - leftUsage.count ||
      rightUsage.lastUsedAt - leftUsage.lastUsedAt ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    );
  });
}

/** Collapse typed names: trim, drop blanks, keep the first of a duplicate. */
export function captureOrgDrafts(
  tagNames: string[],
  collectionName: string | null | undefined,
): CaptureOrgDrafts {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const raw of tagNames) {
    const name = normalizeTagName(raw);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    unique.push(name);
  }

  const collection = normalizeCollectionName(collectionName ?? "");

  return {
    tagNames: unique,
    collectionName: collection || null,
  };
}
