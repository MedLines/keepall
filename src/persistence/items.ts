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
  buildLink,
  markLinkPreviewPending,
  type CreateLinkInput,
  type LinkItem,
} from "@/domain/link";
import {
  applyNoteEdit,
  buildNote,
  type CreateNoteInput,
  type NoteItem,
} from "@/domain/note";
import { assignCollectionId } from "@/domain/collection";
import { assignTagId } from "@/domain/tag";
import { deleteAsset, putAsset } from "./assets";
import { getDb } from "./db";

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
    | { status: "failed" },
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
