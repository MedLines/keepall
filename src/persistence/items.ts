import { resolveItemCollectionIds } from "./collections";
import { deleteUnreferencedDocuments } from "./documents";
import { normalizeItem, type Item } from "@/domain/item";
import { articleAssetIds } from "@/domain/article";
import {
  appendImageAsset,
  assertLocalImageBytes,
  applyImageEdit,
  buildImageFromAssetIds,
  ImageValidationError,
  removeImageAssetAt,
  replaceImageAssetAt,
  type ImageItem,
} from "@/domain/image";
import {
  applyLinkEdit,
  applyLinkPreviewAssetId,
  applyLinkPreviewResult,
  applyLinkPreviewRetry,
  buildLink,
  markLinkPreviewPending,
  normalizeLinkUrl,
  type CreateLinkInput,
  type LinkItem,
  type LinkPreviewRetry,
} from "@/domain/link";
import {
  applyNoteEdit,
  buildNote,
  noteImageAssetIds,
  replaceNoteImageAssetIds,
  type CreateNoteInput,
  type NoteItem,
} from "@/domain/note";
import { assignCollectionId } from "@/domain/collection";
import { assignTagId, removeTagId } from "@/domain/tag";
import { hashAssetBytes, sameContentHashMultiset } from "@/domain/asset";
import {
  ensureContentHash,
  findAssetByContentHash,
  getAsset,
  putAsset,
} from "./assets";
import { getDb } from "./db";
import { putActiveItem } from "./active-item";
import { imageThumbnail, putThumbnail } from "./thumbnails";
import { createTag, resolveItemTagIds } from "./tags";

export async function createNote(input: CreateNoteInput): Promise<NoteItem> {
  const note = buildNote(input);
  const db = getDb();
  await db.transaction("rw", db.items, db.assets, async () => {
    for (const assetId of noteImageAssetIds(note.content)) {
      if (!await db.assets.get(assetId)) throw new Error("Note image is missing");
    }
    await db.items.add(note);
  });
  return note;
}

export async function createLink(input: CreateLinkInput): Promise<LinkItem> {
  const link = buildLink(input);
  await getDb().items.add(link);
  return link;
}

export async function findLinkByNormalizedUrl(
  url: string,
): Promise<LinkItem | null> {
  const normalized = normalizeLinkUrl(url);
  if (!normalized) {
    return null;
  }

  const items = await getDb().items.where("type").equals("link").toArray();
  for (const raw of items) {
    const link = normalizeItem(raw);
    if (link.deletedAt !== undefined || link.type !== "link") {
      continue;
    }
    if (normalizeLinkUrl(link.url) === normalized) {
      return link;
    }
  }
  return null;
}

/** Create a link, or return the existing row with the same normalized URL. */
export async function createOrReuseLink(
  input: CreateLinkInput,
): Promise<{ link: LinkItem; created: boolean }> {
  const existing = await findLinkByNormalizedUrl(input.url);
  if (existing) {
    return { link: existing, created: false };
  }
  const link = await createLink(input);
  return { link, created: true };
}

async function mutateItem(id: string, edit: (current: Item) => Item): Promise<Item> {
  const db = getDb();
  return db.transaction("rw", db.items, async () => {
    const row = await db.items.get(id);
    if (!row || row.deletedAt !== undefined) throw new Error("Item not found");
    const current = normalizeItem(row);
    const next = { ...edit(current), updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.items.put(next);
    return next;
  });
}

export async function clearCollectionOnItem(itemId: string): Promise<Item> {
  return mutateItem(itemId, current => ({ ...current, collectionIds: [], updatedAt: Date.now() }));
}

export async function clearCollectionsOnItems(itemIds: string[]): Promise<string[]> {
  const ids = [...new Set(itemIds)];
  const db = getDb();
  return db.transaction("rw", db.items, async () => {
    const changedIds: string[] = [];
    const updatedAt = Date.now();
    for (const id of ids) {
      const row = await db.items.get(id);
      if (!row || row.deletedAt !== undefined) continue;
      const current = normalizeItem(row);
      if (current.collectionIds.length === 0) continue;
      await db.items.put({ ...current, collectionIds: [], updatedAt: Math.max(updatedAt, current.updatedAt + 1) });
      changedIds.push(id);
    }
    return changedIds;
  });
}

export async function setItemTagIds(
  itemId: string,
  tagIds: string[],
): Promise<Item> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of tagIds) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }

  return mutateItem(itemId, current => ({ ...current, tagIds: unique, updatedAt: Date.now() }));
}

/** Replace all tags on an item with the given names (create/reuse tag rows). */
export async function replaceItemTagsByNames(
  itemId: string,
  tagNames: string[],
): Promise<Item> {
  const ids: string[] = [];
  for (const name of tagNames) {
    const tag = await createTag({ name });
    ids.push(tag.id);
  }
  return setItemTagIds(itemId, ids);
}

export async function createImage(input: {
  assets: { bytes: Uint8Array; mimeType: string }[];
  sourceUrl?: string;
  caption?: string;
  captionFormat?: "plain" | "markdown";
  title?: string;
  sourceFileName?: string;
  collectionIds?: string[];
  collectionName?: string;
  tagNames?: readonly string[];
}): Promise<ImageItem> {
  if (input.assets.length === 0) {
    throw new ImageValidationError("Image asset is required");
  }

  // Finish hashing before the transaction so async crypto cannot auto-commit it.
  const preparedAssets: {
    mimeType: string;
    bytes: Uint8Array;
    contentHash: string;
    thumbnail: Blob | null;
  }[] = [];
  for (const payload of input.assets) {
    const mime = assertLocalImageBytes(payload.bytes, payload.mimeType);
    const contentHash = await hashAssetBytes(payload.bytes);
    preparedAssets.push({ mimeType: mime, bytes: payload.bytes, contentHash,
      thumbnail: await imageThumbnail(payload.bytes, mime) });
  }

  const db = getDb();
  return db.transaction("rw", [db.assets, db.items, db.thumbnails, db.collections, db.tags], async () => {
    const collectionIds = await resolveItemCollectionIds(input.collectionIds, input.collectionName);
    for (const id of collectionIds) if (!await db.collections.get(id)) throw new Error("The selected collection no longer exists.");
    const tagIds = await resolveItemTagIds([], input.tagNames);
    const assetIds: string[] = [];
    for (const payload of preparedAssets) {
      const asset = await putAsset(payload);
      await putThumbnail(asset.id, payload.thumbnail);
      assetIds.push(asset.id);
    }

    const image = buildImageFromAssetIds({
      assetIds,
      sourceUrl: input.sourceUrl,
      caption: input.caption,
      captionFormat: input.captionFormat,
      title: input.title,
      sourceFileName: input.sourceFileName,
    });
    image.collectionIds = collectionIds;
    image.tagIds = tagIds;
    await db.items.add(image);
    return image;
  });
}

/**
 * Find an image item that is the same capture:
 * - one file → a single-asset image with the same bytes
 * - several files → an image whose assets are the same set of bytes
 */
export async function findImageByAssetPayloads(
  payloads: { bytes: Uint8Array; mimeType: string }[],
): Promise<ImageItem | null> {
  if (payloads.length === 0) {
    return null;
  }

  const hashes: string[] = [];
  for (const payload of payloads) {
    assertLocalImageBytes(payload.bytes, payload.mimeType);
    hashes.push(await hashAssetBytes(payload.bytes));
  }

  if (hashes.length === 1) {
    const asset = await findAssetByContentHash(hashes[0]!);
    if (asset) {
      const rows = await getDb().items.where("type").equals("image").toArray();
      for (const raw of rows) {
        const image = normalizeItem(raw);
        if (
          image.deletedAt === undefined && image.type === "image" &&
          image.assetIds.length === 1 &&
          image.assetIds[0] === asset.id
        ) {
          return image;
        }
      }
    }
    return null;
  }

  const rows = await getDb().items.where("type").equals("image").toArray();
  for (const raw of rows) {
    const image = normalizeItem(raw);
    if (image.deletedAt !== undefined || image.type !== "image") {
      continue;
    }

    if (image.assetIds.length !== hashes.length) {
      continue;
    }
    const imageHashes: string[] = [];
    let missing = false;
    for (const assetId of image.assetIds) {
      const asset = await getAsset(assetId);
      if (!asset) {
        missing = true;
        break;
      }
      const hashed = await ensureContentHash(asset);
      imageHashes.push(hashed.contentHash);
    }
    if (missing) {
      continue;
    }
    if (sameContentHashMultiset(hashes, imageHashes)) {
      return image;
    }
  }

  return null;
}

export async function createOrReuseImage(input: {
  assets: { bytes: Uint8Array; mimeType: string }[];
  sourceUrl?: string;
  caption?: string;
  captionFormat?: "plain" | "markdown";
  title?: string;
  sourceFileName?: string;
}): Promise<{ image: ImageItem; created: boolean }> {
  const existing = await findImageByAssetPayloads(input.assets);
  if (existing) {
    return { image: existing, created: false };
  }
  const image = await createImage(input);
  return { image, created: true };
}

/** One-pass map: content hash → image item id (single-asset images only). */
export async function buildSingleAssetImageHashIndex(): Promise<Map<string, string>> {
  const assetIdToImageId = new Map<string, string>();
  const rows = await getDb().items.where("type").equals("image").toArray();
  for (const raw of rows) {
    const image = normalizeItem(raw);
    if (image.deletedAt === undefined && image.type === "image" && image.assetIds.length === 1) {
      assetIdToImageId.set(image.assetIds[0]!, image.id);
    }
  }

  const index = new Map<string, string>();
  for (const [assetId, imageId] of assetIdToImageId) {
    const asset = await getAsset(assetId);
    if (!asset) {
      continue;
    }
    const hashed = await ensureContentHash(asset);
    if (hashed.contentHash) {
      index.set(hashed.contentHash, imageId);
    }
  }
  return index;
}

export async function listItems(): Promise<Item[]> {
  const items = await getDb().items.orderBy("createdAt").toArray();
  return items.filter((item) => item.deletedAt === undefined).reverse().map((item) => normalizeItem(item));
}

export async function getItem(id: string): Promise<Item | null> {
  const row = await getDb().items.get(id);
  return row && row.deletedAt === undefined ? normalizeItem(row) : null;
}

/** Move an item to Trash without changing its content, organization or media. */
export async function deleteItem(id: string): Promise<void> {
  const now = Date.now();
  await getDb().items.where("id").equals(id)
    .filter((item) => item.deletedAt === undefined)
    .modify(item => { item.deletedAt = now; item.updatedAt = Math.max(now, item.updatedAt + 1); });
}

export async function listTrashedItems(): Promise<Item[]> {
  const items = await getDb().items.filter((item) => item.deletedAt !== undefined).toArray();
  return items.map((item) => normalizeItem(item))
    .sort((a, b) => b.deletedAt! - a.deletedAt! || a.id.localeCompare(b.id));
}

export async function restoreItem(id: string): Promise<void> {
  await restoreItems([id]);
}

export async function restoreItems(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const requestedIds = [...new Set(ids)];
  const db = getDb();
  return db.transaction("rw", db.items, async () => {
    const rows = await db.items.bulkGet(requestedIds);
    const items = rows.filter((item): item is Item => item !== undefined && item.deletedAt !== undefined);
    const now = items.reduce((timestamp, item) => Math.max(timestamp, item.updatedAt + 1), Date.now());
    for (const item of items) {
      delete item.deletedAt;
      item.updatedAt = now;
    }
    await db.items.bulkPut(items);
    return items.map((item) => item.id);
  });
}

export async function permanentlyDeleteItem(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.items, db.assets, db.thumbnails, db.videoAssets, db.documentAssets, db.collections], async () => {
    const existing = await db.items.get(id);
    if (!existing) return;
    if (existing.deletedAt === undefined) throw new Error("Move the item to Trash first");
    const item = normalizeItem(existing);
    const assetIds = itemAssetIds(item);
    await db.items.delete(id);
    await db.collections.filter((collection) => collection.pinnedItemIds?.includes(id) ?? false)
      .modify((collection) => { collection.pinnedItemIds = collection.pinnedItemIds.filter((pinnedId) => pinnedId !== id); });
    if (item.type === "video") {
      await db.videoAssets.delete(item.assetId);
      await db.thumbnails.delete(item.assetId);
    }
    if (item.type === "document") await deleteUnreferencedDocuments([item.assetId]);
    await deleteUnreferencedAssets(assetIds);
  });
}

/** Delete only the confirmed ids that are still in Trash, as one transaction. */
export async function emptyTrash(ids: string[]): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.items, db.assets, db.thumbnails, db.videoAssets, db.documentAssets, db.collections], async () => {
    const rows = await db.items.bulkGet([...new Set(ids)]);
    const items = rows.filter((item): item is Item => item !== undefined && item.deletedAt !== undefined);
    const deletedIds = new Set(items.map((item) => item.id));
    await db.items.bulkDelete([...deletedIds]);
    await db.collections.filter((collection) => collection.pinnedItemIds?.some((id) => deletedIds.has(id)) ?? false)
      .modify((collection) => { collection.pinnedItemIds = collection.pinnedItemIds.filter((id) => !deletedIds.has(id)); });
    const videoIds = items.filter((item) => item.type === "video").map((item) => item.assetId);
    await db.videoAssets.bulkDelete(videoIds);
    await db.thumbnails.bulkDelete(videoIds);
    await deleteUnreferencedDocuments(items.filter((item) => item.type === "document").map((item) => item.assetId));
    await deleteUnreferencedAssets(items.flatMap((item) => itemAssetIds(normalizeItem(item))));
  });
}

function itemAssetIds(item: Item): string[] {
  if (item.type === "image") return item.assetIds;
  if (item.type === "link") return [...(item.previewAssetId ? [item.previewAssetId] : []), ...articleAssetIds(item.article)];
  if (item.type === "note") return noteImageAssetIds(item.content);
  return [];
}

export async function deleteUnreferencedAssets(assetIds: string[]): Promise<void> {
  if (!assetIds.length) return;
  const db = getDb();
  const items = await db.items.toArray();
  const used = new Set(items.flatMap((item) => itemAssetIds(normalizeItem(item))));
  const unused = [...new Set(assetIds)].filter((assetId) => !used.has(assetId));
  await db.assets.bulkDelete(unused);
  await db.thumbnails.bulkDelete(unused);
}

async function deleteUnreferencedAsset(assetId: string): Promise<void> {
  await deleteUnreferencedAssets([assetId]);
}

export async function updateNote(
  id: string,
  input: { content: string; format?: "plain" | "markdown" },
): Promise<NoteItem> {
  return saveNoteWithImages(id, input, []);
}

export async function saveNoteWithImages(
  id: string,
  input: { content: string; format?: "plain" | "markdown" },
  uploads: { id: string; bytes: Uint8Array; mimeType: string }[],
): Promise<NoteItem> {
  // Web Crypto is asynchronous; finish hashing before entering Dexie's transaction.
  const prepared = await Promise.all(uploads.map(async (upload) => ({
    id: upload.id,
    bytes: upload.bytes,
    mimeType: assertLocalImageBytes(upload.bytes, upload.mimeType),
    contentHash: await hashAssetBytes(upload.bytes),
  })));
  const db = getDb();
  return db.transaction("rw", db.items, db.assets, db.thumbnails, async () => {
    const existing = await db.items.get(id);
    if (!existing || existing.deletedAt !== undefined || existing.type !== "note") throw new Error("Note not found");
    const previous = normalizeItem(existing);
    const wanted = new Set(noteImageAssetIds(input.content));
    const replacements = new Map<string, string>();
    for (const upload of prepared) {
      if (!wanted.has(upload.id)) continue;
      const asset = await putAsset(upload);
      replacements.set(upload.id, asset.id);
    }
    const content = replaceNoteImageAssetIds(input.content, replacements);
    for (const assetId of noteImageAssetIds(content)) {
      if (!await db.assets.get(assetId)) throw new Error("Note image is missing");
    }
    const next = { ...applyNoteEdit(previous, { ...input, content }), updatedAt: Math.max(Date.now(), previous.updatedAt + 1) };
    await putActiveItem(next);
    const nextAssetIds = new Set(noteImageAssetIds(next.content));
    await deleteUnreferencedAssets(noteImageAssetIds(previous.content)
      .filter((assetId) => !nextAssetIds.has(assetId)));
    return next;
  });
}

/** Read and apply only this operation's fields while holding the item write lock. */
async function mutateLink(
  id: string,
  edit: (current: LinkItem) => LinkItem,
  expectedUrl?: string,
): Promise<LinkItem> {
  const db = getDb();
  return db.transaction("rw", db.items, db.assets, db.thumbnails, async () => {
    const row = await db.items.get(id);
    if (!row || row.deletedAt !== undefined || row.type !== "link") throw new Error("Link not found");
    if (expectedUrl !== undefined && row.url !== expectedUrl) throw new LinkPreviewStaleError();
    const current = normalizeItem(row);
    const next = { ...edit(current), updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.items.put(next);
    if (current.previewAssetId && current.previewAssetId !== next.previewAssetId) {
      await deleteUnreferencedAsset(current.previewAssetId);
    }
    if (current.article !== next.article) await deleteUnreferencedAssets(articleAssetIds(current.article));
    return next;
  });
}

export class LinkPreviewStaleError extends Error {
  constructor() {
    super("The link changed while its preview was loading");
    this.name = "LinkPreviewStaleError";
  }
}

export async function updateLink(
  id: string,
  input: { url: string; title?: string; noteContent?: string; noteFormat?: "plain" | "markdown" },
): Promise<LinkItem> {
  return mutateLink(id, current => applyLinkEdit(current, input));
}

export async function updateImage(
  id: string,
  input: { title?: string; sourceUrl?: string; caption?: string; captionFormat?: "plain" | "markdown" },
): Promise<ImageItem> {
  const db = getDb();
  return db.transaction("rw", db.items, async () => {
    const row = await db.items.get(id);
    if (!row || row.deletedAt !== undefined || row.type !== "image") throw new Error("Image not found");
    const current = normalizeItem(row);
    const next = { ...applyImageEdit(current, input), updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.items.put(next);
    return next;
  });
}

export async function appendImageAssetToItem(
  id: string,
  input: { bytes: Uint8Array; mimeType: string },
): Promise<ImageItem> {
  return appendImageAssetsToItem(id, [input]);
}

export async function appendImageAssetsToItem(
  id: string,
  uploads: { bytes: Uint8Array; mimeType: string }[],
): Promise<ImageItem> {
  const prepared: {
    bytes: Uint8Array;
    mimeType: string;
    contentHash: string;
    thumbnail: Blob | null;
  }[] = [];
  for (const upload of uploads) {
    const mimeType = assertLocalImageBytes(upload.bytes, upload.mimeType);
    prepared.push({
      bytes: upload.bytes,
      mimeType,
      contentHash: await hashAssetBytes(upload.bytes),
      thumbnail: await imageThumbnail(upload.bytes, mimeType),
    });
  }

  const db = getDb();
  return db.transaction("rw", db.items, db.assets, db.thumbnails, async () => {
    const existing = await db.items.get(id);
    if (!existing || existing.deletedAt !== undefined || existing.type !== "image") {
      throw new Error("Image not found");
    }
    let next = normalizeItem(existing);
    if (next.type !== "image") throw new Error("Image not found");
    if (prepared.length === 0) return next;

    for (const upload of prepared) {
      const asset = await putAsset(upload);
      await putThumbnail(asset.id, upload.thumbnail);
      next = { ...appendImageAsset(next, asset.id), updatedAt: Math.max(Date.now(), next.updatedAt + 1) };
    }
    await putActiveItem(next);
    return next;
  });
}

export async function replaceImageAssetAtIndex(
  id: string,
  slideIndex: number,
  input: { bytes: Uint8Array; mimeType: string },
): Promise<ImageItem> {
  const db = getDb();
  const original = await db.items.get(id);
  if (!original || original.deletedAt !== undefined || original.type !== "image") throw new Error("Image not found");
  const expectedAssetId = normalizeItem(original).assetIds[slideIndex];
  if (!expectedAssetId) throw new Error("Image slide not found");
  const mimeType = assertLocalImageBytes(input.bytes, input.mimeType);
  const contentHash = await hashAssetBytes(input.bytes);
  const thumbnail = await imageThumbnail(input.bytes, mimeType);
  return db.transaction("rw", db.items, db.assets, db.thumbnails, async () => {
    const row = await db.items.get(id);
    if (!row || row.deletedAt !== undefined || row.type !== "image") throw new Error("Image not found");
    const current = normalizeItem(row);
    const previousAssetId = current.assetIds[slideIndex];
    if (!previousAssetId) throw new Error("Image slide not found");
    if (previousAssetId !== expectedAssetId) throw new Error("This image slide changed while its replacement was preparing");
    const asset = await putAsset({ mimeType, bytes: input.bytes, contentHash });
    await putThumbnail(asset.id, thumbnail);
    const next = { ...replaceImageAssetAt(current, slideIndex, asset.id), updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.items.put(next);
    await deleteUnreferencedAsset(previousAssetId);
    return next;
  });
}

export async function removeImageAssetAtIndex(
  id: string,
  slideIndex: number,
): Promise<ImageItem> {
  const db = getDb();
  return db.transaction("rw", db.items, db.assets, db.thumbnails, async () => {
    const existing = await db.items.get(id);
    if (!existing || existing.deletedAt !== undefined || existing.type !== "image") {
      throw new Error("Image not found");
    }

    const current = normalizeItem(existing);
    const removedAssetId = current.assetIds[slideIndex];
    if (!removedAssetId) {
      throw new Error("Image slide not found");
    }

    const next = { ...removeImageAssetAt(current, slideIndex), updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await putActiveItem(next);

    await deleteUnreferencedAsset(removedAssetId);

    return next;
  });
}

export async function setLinkPreviewPending(id: string, expectedUrl?: string): Promise<LinkItem> {
  return mutateLink(id, current => ({ ...markLinkPreviewPending(current), previewAssetId: null }), expectedUrl);
}

export async function saveLinkPreviewResult(
  id: string,
  result:
    | { status: "ready"; title: string; description: string; imageUrl: string }
    | { status: "failed"; retry?: LinkPreviewRetry },
  expectedUrl?: string,
): Promise<LinkItem> {
  return mutateLink(id, current => applyLinkPreviewResult(current, result), expectedUrl);
}

export async function setLinkPreviewRetry(
  id: string,
  previewRetry: LinkPreviewRetry | null,
  expectedUrl?: string,
): Promise<LinkItem> {
  return mutateLink(id, current => applyLinkPreviewRetry(current, previewRetry), expectedUrl);
}

export async function setLinkPreviewAssetId(
  id: string,
  previewAssetId: string | null,
  expectedUrl?: string,
): Promise<LinkItem> {
  return mutateLink(id, current => applyLinkPreviewAssetId(current, previewAssetId), expectedUrl);
}

/** Commit downloaded bytes and their reference together, only for the requested URL. */
export async function saveLinkPreviewImage(
  id: string,
  expectedUrl: string,
  input: { bytes: Uint8Array; mimeType: string },
): Promise<LinkItem> {
  const contentHash = await hashAssetBytes(input.bytes);
  const db = getDb();
  return db.transaction("rw", db.items, db.assets, db.thumbnails, async () => {
    const row = await db.items.get(id);
    if (!row || row.deletedAt !== undefined || row.type !== "link") throw new Error("Link not found");
    if (row.url !== expectedUrl) throw new LinkPreviewStaleError();
    const asset = await putAsset({ ...input, contentHash });
    return setLinkPreviewAssetId(id, asset.id, expectedUrl);
  });
}

export async function assignTagToItem(itemId: string, tagId: string): Promise<Item> {
  const db = getDb();
  return db.transaction("rw", db.items, db.tags, async () => {
    if (!await db.tags.get(tagId)) throw new Error("Tag not found");
    return mutateItem(itemId, current => ({ ...current, tagIds: assignTagId(current.tagIds, tagId), updatedAt: Date.now() }));
  });
}

export async function unassignTagFromItem(itemId: string, tagId: string): Promise<Item> {
  return mutateItem(itemId, current => ({ ...current, tagIds: removeTagId(current.tagIds, tagId), updatedAt: Date.now() }));
}

export async function assignCollectionToItem(itemId: string, collectionId: string): Promise<Item> {
  const db = getDb();
  return db.transaction("rw", db.items, db.collections, async () => {
    if (!await db.collections.get(collectionId)) throw new Error("Collection not found");
    return mutateItem(itemId, current => {
      const now = Date.now();
      return {
        ...current,
        collectionAddedAt: current.collectionIds.includes(collectionId) ? current.collectionAddedAt ?? current.createdAt : now,
        collectionIds: assignCollectionId(current.collectionIds, collectionId),
        updatedAt: now,
      };
    });
  });
}

export async function listNotes(): Promise<NoteItem[]> {
  const notes = await getDb()
    .items.where("type")
    .equals("note")
    .sortBy("createdAt");

  return notes.filter((note) => note.deletedAt === undefined).reverse().map((note) => normalizeItem(note as NoteItem));
}
