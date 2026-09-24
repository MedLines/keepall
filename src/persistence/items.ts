import { normalizeItem, type Item } from "@/domain/item";
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
import { imageThumbnail, putThumbnail } from "./thumbnails";
import { createTag } from "./tags";

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
    if (link.type !== "link") {
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

export async function clearCollectionOnItem(itemId: string): Promise<Item> {
  const existing = await getDb().items.get(itemId);

  if (!existing) {
    throw new Error("Item not found");
  }

  const current = normalizeItem(existing);
  const next = {
    ...current,
    collectionIds: [] as string[],
    updatedAt: Date.now(),
  };
  await getDb().items.put(next);
  return next;
}

export async function setItemTagIds(
  itemId: string,
  tagIds: string[],
): Promise<Item> {
  const existing = await getDb().items.get(itemId);

  if (!existing) {
    throw new Error("Item not found");
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of tagIds) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }

  const current = normalizeItem(existing);
  const next = {
    ...current,
    tagIds: unique,
    updatedAt: Date.now(),
  };
  await getDb().items.put(next);
  return next;
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
  return db.transaction("rw", db.assets, db.items, db.thumbnails, async () => {
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
          image.type === "image" &&
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
    if (image.type !== "image") {
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
    if (image.type === "image" && image.assetIds.length === 1) {
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
  return items.reverse().map((item) => normalizeItem(item));
}

export async function getItem(id: string): Promise<Item | null> {
  const row = await getDb().items.get(id);
  return row ? normalizeItem(row) : null;
}

export async function deleteItem(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.items, db.assets, db.thumbnails, db.videoAssets, async () => {
    const existing = await db.items.get(id);
    if (!existing) return;
    const item = normalizeItem(existing);
    const assetIds = itemAssetIds(item);
    await db.items.delete(id);
    if (item.type === "video") {
      await db.videoAssets.delete(item.assetId);
      await db.thumbnails.delete(item.assetId);
    }
    await deleteUnreferencedAssets(assetIds);
  });
}

function itemAssetIds(item: Item): string[] {
  if (item.type === "image") return item.assetIds;
  if (item.type === "link") return item.previewAssetId ? [item.previewAssetId] : [];
  if (item.type === "note") return noteImageAssetIds(item.content);
  return [];
}

async function deleteUnreferencedAssets(assetIds: string[]): Promise<void> {
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
    if (!existing || existing.type !== "note") throw new Error("Note not found");
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
    const next = applyNoteEdit(previous, { ...input, content });
    await db.items.put(next);
    const nextAssetIds = new Set(noteImageAssetIds(next.content));
    await deleteUnreferencedAssets(noteImageAssetIds(previous.content)
      .filter((assetId) => !nextAssetIds.has(assetId)));
    return next;
  });
}

export async function updateLink(
  id: string,
  input: { url: string; title?: string; noteContent?: string; noteFormat?: "plain" | "markdown" },
): Promise<LinkItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "link") {
    throw new Error("Link not found");
  }

  const current = normalizeItem(existing);
  const next = applyLinkEdit(current, input);
  await getDb().items.put(next);
  if (current.previewAssetId && current.previewAssetId !== next.previewAssetId) {
    await deleteUnreferencedAsset(current.previewAssetId);
  }
  return next;
}

export async function updateImage(
  id: string,
  input: { title?: string; sourceUrl?: string; caption?: string; captionFormat?: "plain" | "markdown" },
): Promise<ImageItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "image") {
    throw new Error("Image not found");
  }

  const next = applyImageEdit(normalizeItem(existing), input);
  await getDb().items.put(next);
  return next;
}

export async function appendImageAssetToItem(
  id: string,
  input: { bytes: Uint8Array; mimeType: string },
): Promise<ImageItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "image") {
    throw new Error("Image not found");
  }

  const mime = assertLocalImageBytes(input.bytes, input.mimeType);
  const thumbnail = await imageThumbnail(input.bytes, mime);
  const asset = await putAsset({ mimeType: mime, bytes: input.bytes });
  await putThumbnail(asset.id, thumbnail);
  const current = normalizeItem(existing);
  const next = appendImageAsset(current, asset.id);
  await getDb().items.put(next);
  return next;
}

export async function replaceImageAssetAtIndex(
  id: string,
  slideIndex: number,
  input: { bytes: Uint8Array; mimeType: string },
): Promise<ImageItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "image") {
    throw new Error("Image not found");
  }

  const current = normalizeItem(existing);
  const previousAssetId = current.assetIds[slideIndex];
  if (!previousAssetId) {
    throw new Error("Image slide not found");
  }

  const mime = assertLocalImageBytes(input.bytes, input.mimeType);
  const thumbnail = await imageThumbnail(input.bytes, mime);
  const asset = await putAsset({ mimeType: mime, bytes: input.bytes });
  await putThumbnail(asset.id, thumbnail);
  const next = replaceImageAssetAt(current, slideIndex, asset.id);
  await getDb().items.put(next);
  await deleteUnreferencedAsset(previousAssetId);
  return next;
}

export async function removeImageAssetAtIndex(
  id: string,
  slideIndex: number,
): Promise<ImageItem> {
  const db = getDb();
  return db.transaction("rw", db.items, db.assets, db.thumbnails, async () => {
    const existing = await db.items.get(id);
    if (!existing || existing.type !== "image") {
      throw new Error("Image not found");
    }

    const current = normalizeItem(existing);
    const removedAssetId = current.assetIds[slideIndex];
    if (!removedAssetId) {
      throw new Error("Image slide not found");
    }

    const next = removeImageAssetAt(current, slideIndex);
    await db.items.put(next);

    await deleteUnreferencedAsset(removedAssetId);

    return next;
  });
}

export async function setLinkPreviewPending(id: string): Promise<LinkItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "link") {
    throw new Error("Link not found");
  }

  const current = normalizeItem(existing);
  const next = {
    ...markLinkPreviewPending(current),
    previewAssetId: null,
  };
  await getDb().items.put(next);
  if (current.previewAssetId) await deleteUnreferencedAsset(current.previewAssetId);
  return next;
}

export async function saveLinkPreviewResult(
  id: string,
  result:
    | { status: "ready"; title: string; description: string; imageUrl: string }
    | { status: "failed"; retry?: LinkPreviewRetry },
): Promise<LinkItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "link") {
    throw new Error("Link not found");
  }

  const current = normalizeItem(existing);
  const next = applyLinkPreviewResult(current, result);
  await getDb().items.put(next);
  if (current.previewAssetId && current.previewAssetId !== next.previewAssetId) {
    await deleteUnreferencedAsset(current.previewAssetId);
  }
  return next;
}

export async function setLinkPreviewRetry(
  id: string,
  previewRetry: LinkPreviewRetry | null,
): Promise<LinkItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "link") {
    throw new Error("Link not found");
  }

  const current = normalizeItem(existing);
  const next = applyLinkPreviewRetry(current, previewRetry);
  await getDb().items.put(next);
  return next;
}

export async function setLinkPreviewAssetId(
  id: string,
  previewAssetId: string | null,
): Promise<LinkItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "link") {
    throw new Error("Link not found");
  }

  const current = normalizeItem(existing);
  const next = applyLinkPreviewAssetId(current, previewAssetId);
  await getDb().items.put(next);
  if (current.previewAssetId && current.previewAssetId !== previewAssetId) {
    await deleteUnreferencedAsset(current.previewAssetId);
  }
  return next;
}

export async function assignTagToItem(
  itemId: string,
  tagId: string,
): Promise<Item> {
  const tag = await getDb().tags.get(tagId);

  if (!tag) {
    throw new Error("Tag not found");
  }

  const existing = await getDb().items.get(itemId);

  if (!existing) {
    throw new Error("Item not found");
  }

  const current = normalizeItem(existing);
  const next = {
    ...current,
    tagIds: assignTagId(current.tagIds, tagId),
    updatedAt: Date.now(),
  };

  await getDb().items.put(next);
  return next;
}

export async function unassignTagFromItem(
  itemId: string,
  tagId: string,
): Promise<Item> {
  const existing = await getDb().items.get(itemId);

  if (!existing) {
    throw new Error("Item not found");
  }

  const current = normalizeItem(existing);
  const next = {
    ...current,
    tagIds: removeTagId(current.tagIds, tagId),
    updatedAt: Date.now(),
  };

  await getDb().items.put(next);
  return next;
}

export async function assignCollectionToItem(
  itemId: string,
  collectionId: string,
): Promise<Item> {
  const collection = await getDb().collections.get(collectionId);

  if (!collection) {
    throw new Error("Collection not found");
  }

  const existing = await getDb().items.get(itemId);

  if (!existing) {
    throw new Error("Item not found");
  }

  const current = normalizeItem(existing);
  const next = {
    ...current,
    collectionIds: assignCollectionId(current.collectionIds, collectionId),
    updatedAt: Date.now(),
  };

  await getDb().items.put(next);
  return next;
}

export async function listNotes(): Promise<NoteItem[]> {
  const notes = await getDb()
    .items.where("type")
    .equals("note")
    .sortBy("createdAt");

  return notes.reverse().map((note) => normalizeItem(note as NoteItem));
}
