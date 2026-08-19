import Dexie, { type EntityTable } from "dexie";
import type { Item } from "@/domain/item";

export const KEEPALL_DB_NAME = "keepall";

export type KeepallDB = Dexie & {
  items: EntityTable<Item, "id">;
};

function createKeepallDb(): KeepallDB {
  const db = new Dexie(KEEPALL_DB_NAME) as KeepallDB;
  db.version(1).stores({
    items: "id, type, createdAt",
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
