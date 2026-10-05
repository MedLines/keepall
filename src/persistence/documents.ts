import { hashAssetBytes } from "@/domain/asset";
import { coerceExclusiveCollectionIds } from "@/domain/collection";
import { decodeTextDocument, documentFormat, type DocumentAsset, type DocumentItem } from "@/domain/document";
import { getDb } from "./db";

export async function createTextDocument(input: {
  fileName: string; bytes: Uint8Array; title?: string; noteContent?: string;
  tagIds?: string[]; collectionIds?: string[];
}): Promise<DocumentItem> {
  const format = documentFormat(input.fileName, input.bytes.byteLength);
  const bytes = new Uint8Array(input.bytes);
  decodeTextDocument(bytes);
  const contentHash = await hashAssetBytes(bytes);
  const now = Date.now();
  const db = getDb();
  return db.transaction("rw", [db.items, db.documentAssets, db.tags, db.collections], async () => {
    const tagIds = [...new Set(input.tagIds ?? [])];
    const collectionIds = coerceExclusiveCollectionIds(input.collectionIds ?? []);
    for (const id of tagIds) if (!await db.tags.get(id)) throw new Error("The selected tag no longer exists.");
    for (const id of collectionIds) if (!await db.collections.get(id)) throw new Error("The selected collection no longer exists.");
    let original = await db.documentAssets.where("contentHash").equals(contentHash).first();
    if (!original) {
      original = { id: crypto.randomUUID(), bytes, byteLength: bytes.byteLength, contentHash, createdAt: now };
      await db.documentAssets.add(original);
    }
    const item: DocumentItem = {
      id: crypto.randomUUID(), type: "document", format, assetId: original.id,
      sourceFileName: input.fileName, title: input.title?.trim() || input.fileName.replace(/\.(txt|md)$/i, "") || input.fileName,
      noteContent: input.noteContent?.trim() ?? "", tagIds, collectionIds, createdAt: now, updatedAt: now,
    };
    await db.items.add(item);
    return item;
  });
}

export async function getDocumentOriginal(itemId: string): Promise<DocumentAsset | undefined> {
  const db = getDb();
  const item = await db.items.get(itemId);
  return item?.type === "document" ? db.documentAssets.get(item.assetId) : undefined;
}

export async function updateDocument(id: string, input: { title: string; noteContent: string; noteFormat?: "plain" | "markdown" }): Promise<DocumentItem> {
  const db = getDb();
  return db.transaction("rw", db.items, async () => {
    const item = await db.items.get(id);
    if (item?.type !== "document" || item.deletedAt !== undefined) throw new Error("This document is no longer available.");
    const next: DocumentItem = { ...item, title: input.title.trim() || item.sourceFileName,
      noteContent: input.noteContent.trim(), noteFormat: input.noteFormat === "markdown" ? "markdown" : undefined, updatedAt: Date.now() };
    await db.items.put(next);
    return next;
  });
}

/** Run inside the caller's item/original transaction, counting active and trashed references. */
export async function deleteUnreferencedDocuments(assetIds: string[]) {
  if (assetIds.length === 0) return;
  const db = getDb();
  const documents = await db.items.where("type").equals("document").toArray();
  const used = new Set(documents.filter((item) => item.type === "document").map((item) => item.assetId));
  await db.documentAssets.bulkDelete([...new Set(assetIds)].filter((id) => !used.has(id)));
}
