import {
  buildTag,
  type CreateTagInput,
  type Tag,
} from "@/domain/tag";
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
