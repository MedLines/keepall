import {
  buildCollection,
  type Collection,
  type CreateCollectionInput,
} from "@/domain/collection";
import { getDb } from "./db";

export async function createCollection(
  input: CreateCollectionInput,
): Promise<Collection> {
  const collection = buildCollection(input);
  const existing = await getDb()
    .collections.where("name")
    .equals(collection.name)
    .first();

  if (existing) {
    return existing;
  }

  await getDb().collections.add(collection);
  return collection;
}

export async function listCollections(): Promise<Collection[]> {
  return getDb().collections.orderBy("name").toArray();
}
