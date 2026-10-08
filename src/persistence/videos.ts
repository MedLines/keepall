import { hashAssetBytes } from "@/domain/asset";
import { abortable } from "@/lib/abortable";
import { assertLocalVideo, buildVideo, type VideoItem } from "@/domain/video";
import { resolveItemCollectionIds } from "./collections";
import { getDb } from "./db";
import { resolveItemTagIds } from "./tags";
import { putActiveItem } from "./active-item";
import { cancellableWrite } from "./cancellable-write";

export async function createVideo(file: File, poster: Blob | null = null, title?: string, notes?: { content: string; format: "plain" | "markdown" }, collectionIds: string[] = [], organization?: { id?: string; tagIds?: string[]; collectionName?: string; tagNames?: readonly string[]; signal?: AbortSignal }): Promise<VideoItem> {
  assertLocalVideo(file);
  const db = getDb();
  const assetId = crypto.randomUUID();
  const item = buildVideo({ assetId, fileName: file.name, title, noteContent: notes?.content, noteFormat: notes?.format }, { id: organization?.id });
  const contentHash = organization?.id ? await abortable(file.arrayBuffer().then(buffer => hashAssetBytes(new Uint8Array(buffer))), organization.signal) : undefined;
  const replay = await cancellableWrite(db, [db.items, db.videoAssets, db.thumbnails, db.collections, db.tags], organization?.signal, async () => {
    if (organization?.id) {
      const existing = await db.items.get(organization.id);
      if (existing) {
        if (existing.type !== "video" || existing.deletedAt !== undefined || existing.sourceFileName !== file.name) throw new Error("This file ID belongs to another item or an item in Trash.");
        const asset = await db.videoAssets.get(existing.assetId);
        if (!asset) throw new Error("The saved video original is missing.");
        return { item: existing, blob: asset.blob };
      }
    }
    item.collectionIds = await resolveItemCollectionIds(collectionIds, organization?.collectionName);
    item.tagIds = await resolveItemTagIds(organization?.tagIds, organization?.tagNames);
    for (const id of item.tagIds) if (!await db.tags.get(id)) throw new Error("The selected tag no longer exists.");
    for (const id of item.collectionIds) if (!await db.collections.get(id)) throw new Error("The selected collection no longer exists.");
    await db.videoAssets.add({ id: assetId, mimeType: file.type, byteLength: file.size, blob: file, createdAt: Date.now() });
    if (poster) await db.thumbnails.add({ assetId, blob: poster });
    await db.items.add(item);
  });
  if (replay) {
    const existingHash = await abortable(replay.blob.arrayBuffer().then(buffer => hashAssetBytes(new Uint8Array(buffer))), organization?.signal);
    if (existingHash !== contentHash) throw new Error("This file ID belongs to different video content.");
    return replay.item;
  }
  return item;
}

export async function getVideoBlob(assetId: string): Promise<Blob | null> {
  return (await getDb().videoAssets.get(assetId))?.blob ?? null;
}

export async function updateVideoDetails(id: string, details: { title: string; noteContent: string; noteFormat: "plain" | "markdown" }): Promise<VideoItem> {
  const trimmed = details.title.trim();
  if (!trimmed) throw new Error("Video title is required");
  const db = getDb();
  const current = await db.items.get(id);
  if (!current || current.deletedAt !== undefined || current.type !== "video") throw new Error("Video not found");
  const next: VideoItem = {
    ...current, title: trimmed, noteContent: details.noteContent.trim(),
    noteFormat: details.noteFormat === "markdown" ? "markdown" : undefined,
    updatedAt: Date.now(),
  };
  await putActiveItem(next);
  return next;
}
