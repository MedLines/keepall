import { normalizeCollectionName } from "./collection";
import { normalizeTagName } from "./tag";

export type CaptureOrgDrafts = {
  tagNames: string[];
  collectionName: string | null;
};

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
