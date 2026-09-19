import {
  buildTag,
  removeTagId,
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

export async function listTags(): Promise<Tag[]> {
  return getDb().tags.orderBy("name").toArray();
}

/** Deletes the tag row and removes its id from every item in one transaction. */
export async function deleteTag(tagId: string): Promise<void> {
  const db = getDb();
  const existing = await db.tags.get(tagId);
  if (!existing) {
    throw new Error("Tag not found");
  }

  await db.transaction("rw", db.tags, db.items, async () => {
    const items = await db.items.toArray();
    const now = Date.now();
    for (const raw of items) {
      const item = normalizeItem(raw);
      if (!item.tagIds.includes(tagId)) {
        continue;
      }
      const next: Item = {
        ...item,
        tagIds: removeTagId(item.tagIds, tagId),
        updatedAt: now,
      };
      await db.items.put(next);
    }
    await db.tags.delete(tagId);
  });
}
