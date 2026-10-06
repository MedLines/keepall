import { hashAssetBytes } from "@/domain/asset";
import { resolveItemCollectionIds } from "./collections";
import { decodeTextDocument, documentFormat, DocumentValidationError, type DocumentAsset, type DocumentItem } from "@/domain/document";
import { getDb } from "./db";
import { resolveItemTagIds } from "./tags";
import { readPdfText } from "./pdf-document";

export async function getDocumentRevision(): Promise<string> {
  return (await getDb().backupState.get("documents"))?.revision ?? "initial";
}

export async function createDocument(input: {
  fileName: string; bytes: Uint8Array; title?: string; noteContent?: string;
  tagIds?: string[]; collectionIds?: string[]; collectionName?: string; tagNames?: readonly string[];
}): Promise<DocumentItem> {
  const format = documentFormat(input.fileName, input.bytes.byteLength);
  const bytes = new Uint8Array(input.bytes);
  const pdfText = format === "pdf" ? await readPdfText(bytes) : undefined;
  if (format !== "pdf") decodeTextDocument(bytes);
  const contentHash = await hashAssetBytes(bytes);
  const now = Date.now();
  const db = getDb();
  return db.transaction("rw", [db.items, db.documentAssets, db.tags, db.collections], async () => {
    const tagIds = await resolveItemTagIds(input.tagIds, input.tagNames);
    const collectionIds = await resolveItemCollectionIds(input.collectionIds, input.collectionName);
    for (const id of tagIds) if (!await db.tags.get(id)) throw new Error("The selected tag no longer exists.");
    for (const id of collectionIds) if (!await db.collections.get(id)) throw new Error("The selected collection no longer exists.");
    let original = await db.documentAssets.where("contentHash").equals(contentHash).first();
    if (!original) {
      original = { id: crypto.randomUUID(), bytes, byteLength: bytes.byteLength, contentHash, createdAt: now, ...(pdfText !== undefined ? { pdfText } : {}) };
      await db.documentAssets.add(original);
    }
    const item: DocumentItem = {
      id: crypto.randomUUID(), type: "document", format, assetId: original.id,
      sourceFileName: input.fileName, title: input.title?.trim() || input.fileName.replace(/\.(txt|md|pdf)$/i, "") || input.fileName,
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

export async function updateDocument(id: string, input: { title: string; noteContent: string; noteFormat?: "plain" | "markdown"; content?: string; expectedAssetId?: string }): Promise<DocumentItem> {
  const db = getDb();
  let replacement: { bytes: Uint8Array; contentHash: string } | undefined;
  let expectedAssetId = input.expectedAssetId;
  if (input.content !== undefined) {
    const snapshot = await db.items.get(id);
    if (snapshot?.type !== "document" || snapshot.deletedAt !== undefined) throw new DocumentValidationError("This document is no longer available.");
    if (snapshot.format === "pdf") throw new DocumentValidationError("The PDF file stays unchanged. Edit its title or personal note instead.");
    expectedAssetId ??= snapshot.assetId;
    const original = await db.documentAssets.get(snapshot.assetId);
    if (!original) throw new DocumentValidationError("The saved file is missing. Restore it from a backup before editing.");
    if (decodeTextDocument(original.bytes) !== input.content) {
      const bytes = new TextEncoder().encode(input.content);
      documentFormat(snapshot.sourceFileName, bytes.byteLength);
      decodeTextDocument(bytes);
      replacement = { bytes, contentHash: await hashAssetBytes(bytes) };
    }
  }
  return db.transaction("rw", [db.items, db.documentAssets], async () => {
    const item = await db.items.get(id);
    if (item?.type !== "document" || item.deletedAt !== undefined) throw new Error("This document is no longer available.");
    if (expectedAssetId && item.assetId !== expectedAssetId) throw new DocumentValidationError("This file changed while you were editing. Reopen it before saving.");
    const next: DocumentItem = { ...item, title: input.title.trim() || item.sourceFileName,
      noteContent: input.noteContent.trim(), noteFormat: input.noteFormat === "markdown" ? "markdown" : undefined, updatedAt: Date.now() };
    if (replacement) {
      let asset = await db.documentAssets.where("contentHash").equals(replacement.contentHash).first();
      if (!asset) {
        asset = { id: crypto.randomUUID(), ...replacement, byteLength: replacement.bytes.byteLength, createdAt: Date.now() };
        await db.documentAssets.add(asset);
      }
      next.assetId = asset.id;
    }
    await db.items.put(next);
    if (next.assetId !== item.assetId) await deleteUnreferencedDocuments([item.assetId]);
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
