import Dexie, { type EntityTable } from "dexie";
import type { Collection } from "@/domain/collection";
import type { Item } from "@/domain/item";
import type { Tag } from "@/domain/tag";

export const KEEPALL_DB_NAME = "keepall";

export type KeepallDB = Dexie & {
  items: EntityTable<Item, "id">;
  tags: EntityTable<Tag, "id">;
  collections: EntityTable<Collection, "id">;
};

function createKeepallDb(): KeepallDB {
  const db = new Dexie(KEEPALL_DB_NAME) as KeepallDB;

  db.version(1).stores({
    items: "id, type, createdAt",
  });

  db.version(2).stores({
    items: "id, type, createdAt",
    tags: "id, name",
  });

  db.version(3).stores({
    items: "id, type, createdAt",
    tags: "id, name",
    collections: "id, name",
  });

  return db;
}

let db: KeepallDB | undefined;

export function getDb(): KeepallDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available");
  }

  db ??= createKeepallDb();
  return db;
}

export async function deleteKeepallDatabase(): Promise<void> {
  if (db) {
    db.close();
    db = undefined;
  }

  await Dexie.delete(KEEPALL_DB_NAME);
}
