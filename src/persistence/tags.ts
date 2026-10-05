import {
  buildTag,
  type CreateTagInput,
  type Tag,
} from "@/domain/tag";
import { normalizeItem, type Item } from "@/domain/item";
import { getDb } from "./db";

export async function createTag(input: CreateTagInput): Promise<Tag> {
  const tag = buildTag(input);
  const existing = await getDb()
    .tags.where("name")
    .equals(tag.name)
    .first();

  if (existing) {
    return existing;
  }

  await getDb().tags.add(tag);
  return tag;
}

/** Resolve import tags inside the caller's item/asset transaction. */
export async function resolveItemTagIds(ids: string[] = [], names: readonly string[] = []): Promise<string[]> {
  const resolved = new Set(ids);
  for (const name of names) resolved.add((await createTag({ name })).id);
  return [...resolved];
}

export async function listTags(): Promise<Tag[]> {
  return getDb().tags.orderBy("name").toArray();
}

/** Deletes the tag row and removes its id from every item in one transaction. */
export async function deleteTag(tagId: string): Promise<void> {
  return deleteTags([tagId]);
}

export async function deleteTags(tagIds: string[]): Promise<void> {
  const ids = [...new Set(tagIds)];
  if (ids.length === 0) return;
  const removed = new Set(ids);
  const db = getDb();

  await db.transaction("rw", db.tags, db.items, async () => {
    const existing = await db.tags.bulkGet(ids);
    if (existing.some(tag => !tag)) throw new Error("Tag not found");
    const items = await db.items.toArray();
    const now = Date.now();
    for (const raw of items) {
      const item = normalizeItem(raw);
      if (!item.tagIds.some(id => removed.has(id))) {
        continue;
      }
      const next: Item = {
        ...item,
        tagIds: item.tagIds.filter(id => !removed.has(id)),
        updatedAt: now,
      };
      await db.items.put(next);
    }
    await db.tags.bulkDelete(ids);
  });
}
