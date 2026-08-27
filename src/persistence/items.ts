import { normalizeItem, type Item } from "@/domain/item";
import {
  appendImageAsset,
  assertLocalImageBytes,
  applyImageEdit,
  buildImageFromAssetIds,
  ImageValidationError,
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
  type CreateNoteInput,
  type NoteItem,
} from "@/domain/note";
import { assignCollectionId } from "@/domain/collection";
import { assignTagId, removeTagId } from "@/domain/tag";
import { hashAssetBytes, sameContentHashMultiset } from "@/domain/asset";
import { deleteAsset, ensureContentHash, getAsset, putAsset } from "./assets";
import { getDb } from "./db";
import { createTag } from "./tags";

async function deleteLinkedPreviewAsset(link: LinkItem): Promise<void> {
  if (link.previewAssetId) {
    await deleteAsset(link.previewAssetId);
  }
}

export async function createNote(input: CreateNoteInput): Promise<NoteItem> {
  const note = buildNote(input);
  await getDb().items.add(note);
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
  title?: string;
}): Promise<ImageItem> {
  if (input.assets.length === 0) {
    throw new ImageValidationError("Image asset is required");
  }

  const assetIds: string[] = [];
  for (const payload of input.assets) {
    const mime = assertLocalImageBytes(payload.bytes, payload.mimeType);
    const asset = await putAsset({ mimeType: mime, bytes: payload.bytes });
    assetIds.push(asset.id);
  }

  const image = buildImageFromAssetIds({
    assetIds,
    sourceUrl: input.sourceUrl,
    caption: input.caption,
    title: input.title,
  });
  await getDb().items.add(image);
  return image;
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

  const rows = await getDb().items.where("type").equals("image").toArray();
  for (const raw of rows) {
    const image = normalizeItem(raw);
    if (image.type !== "image") {
      continue;
    }

    if (hashes.length === 1) {
      if (image.assetIds.length !== 1) {
        continue;
      }
      const asset = await getAsset(image.assetIds[0]!);
      if (!asset) {
        continue;
      }
      const hashed = await ensureContentHash(asset);
      if (hashed.contentHash === hashes[0]) {
        return image;
      }
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
  title?: string;
}): Promise<{ image: ImageItem; created: boolean }> {
  const existing = await findImageByAssetPayloads(input.assets);
  if (existing) {
    return { image: existing, created: false };
  }
  const image = await createImage(input);
  return { image, created: true };
}

export async function listItems(): Promise<Item[]> {
  const items = await getDb().items.orderBy("createdAt").toArray();
  return items.reverse().map((item) => normalizeItem(item));
}

export async function deleteItem(id: string): Promise<void> {
  const existing = await getDb().items.get(id);
  if (existing?.type === "link") {
    await deleteLinkedPreviewAsset(normalizeItem(existing));
  }
  if (existing?.type === "image") {
    const image = normalizeItem(existing);
    for (const assetId of image.assetIds) {
      await deleteAsset(assetId);
    }
  }
  await getDb().items.delete(id);
}

export async function updateNote(
  id: string,
  input: { content: string },
): Promise<NoteItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "note") {
    throw new Error("Note not found");
  }

  const next = applyNoteEdit(normalizeItem(existing), input);
  await getDb().items.put(next);
  return next;
}

export async function updateLink(
  id: string,
  input: { url: string; title?: string },
): Promise<LinkItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "link") {
    throw new Error("Link not found");
  }

  const current = normalizeItem(existing);
  const next = applyLinkEdit(current, input);
  if (current.previewAssetId && current.previewAssetId !== next.previewAssetId) {
    await deleteAsset(current.previewAssetId);
  }
  await getDb().items.put(next);
  return next;
}

export async function updateImage(
  id: string,
  input: { sourceUrl?: string; caption?: string },
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
  const asset = await putAsset({ mimeType: mime, bytes: input.bytes });
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
  const asset = await putAsset({ mimeType: mime, bytes: input.bytes });
  const next = replaceImageAssetAt(current, slideIndex, asset.id);
  await getDb().items.put(next);
  await deleteAsset(previousAssetId);
  return next;
}

export async function setLinkPreviewPending(id: string): Promise<LinkItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "link") {
    throw new Error("Link not found");
  }

  const current = normalizeItem(existing);
  await deleteLinkedPreviewAsset(current);
  const next = {
    ...markLinkPreviewPending(current),
    previewAssetId: null,
  };
  await getDb().items.put(next);
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
  if (current.previewAssetId && current.previewAssetId !== next.previewAssetId) {
    await deleteAsset(current.previewAssetId);
  }
  await getDb().items.put(next);
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
  if (current.previewAssetId && current.previewAssetId !== previewAssetId) {
    await deleteAsset(current.previewAssetId);
  }
  const next = applyLinkPreviewAssetId(current, previewAssetId);
  await getDb().items.put(next);
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
