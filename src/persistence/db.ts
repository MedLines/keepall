import Dexie, { type EntityTable } from "dexie";
import type { DocumentAsset } from "@/domain/document";
import type { Asset } from "@/domain/asset";
import type { Collection } from "@/domain/collection";
import type { Item } from "@/domain/item";
import type { LibraryPreferences } from "@/domain/library-preferences";
import type { Tag } from "@/domain/tag";
import { trackBackupRevision, type BackupRevision } from "./backup-revision";
import type { BackupFolderSettings } from "./backup-settings";

export const KEEPALL_DB_NAME = "keepall";

export type Thumbnail = { assetId: string; blob: Blob };
export type PreviewLayout = { assetId: string; width: number; height: number };
export type VideoAsset = { id: string; mimeType: string; byteLength: number; blob: Blob; createdAt: number };

export type KeepallDB = Dexie & {
  items: EntityTable<Item, "id">;
  tags: EntityTable<Tag, "id">;
  collections: EntityTable<Collection, "id">;
  assets: EntityTable<Asset, "id">;
  thumbnails: EntityTable<Thumbnail, "assetId">;
  previewLayouts: EntityTable<PreviewLayout, "assetId">;
  videoAssets: EntityTable<VideoAsset, "id">;
  preferences: EntityTable<LibraryPreferences, "id">;
  documentAssets: EntityTable<DocumentAsset, "id">;
  backupState: EntityTable<BackupRevision, "id">;
  backupSettings: EntityTable<BackupFolderSettings, "id">;
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

  db.version(4).stores({
    items: "id, type, createdAt",
    tags: "id, name",
    collections: "id, name",
    assets: "id",
  });

  db.version(5).stores({
    items: "id, type, createdAt",
    tags: "id, name",
    collections: "id, name",
    assets: "id, contentHash",
  });

  db.version(6).stores({
    items: "id, type, createdAt",
    tags: "id, name",
    collections: "id, name",
    assets: "id, contentHash",
    preferences: "id",
  });

  db.version(7).stores({
    items: "id, type, createdAt",
    tags: "id, name",
    collections: "id, name",
    assets: "id, contentHash",
    preferences: "id",
    thumbnails: "assetId",
  });

  db.version(8).stores({
    items: "id, type, createdAt",
    tags: "id, name",
    collections: "id, name",
    assets: "id, contentHash",
    preferences: "id",
    thumbnails: "assetId",
    videoAssets: "id",
  });

  db.version(9).stores({ backupSettings: "id" });

  db.version(10).stores({ backupState: "id" });
  db.version(11).stores({ documentAssets: "id, contentHash" });
  db.version(12).stores({ previewLayouts: "assetId" });
  trackBackupRevision(db);

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
