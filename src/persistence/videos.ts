import { assertLocalVideo, buildVideo, type VideoItem } from "@/domain/video";
import { getDb } from "./db";

export async function createVideo(file: File, poster: Blob | null = null, title?: string, notes?: { content: string; format: "plain" | "markdown" }): Promise<VideoItem> {
  assertLocalVideo(file);
  const db = getDb();
  const assetId = crypto.randomUUID();
  const item = buildVideo({ assetId, fileName: file.name, title, noteContent: notes?.content, noteFormat: notes?.format });
  await db.transaction("rw", db.items, db.videoAssets, db.thumbnails, async () => {
    await db.videoAssets.add({ id: assetId, mimeType: file.type, byteLength: file.size, blob: file, createdAt: Date.now() });
    if (poster) await db.thumbnails.add({ assetId, blob: poster });
    await db.items.add(item);
  });
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
  if (!current || current.type !== "video") throw new Error("Video not found");
  const next: VideoItem = {
    ...current, title: trimmed, noteContent: details.noteContent.trim(),
    noteFormat: details.noteFormat === "markdown" ? "markdown" : undefined,
    updatedAt: Date.now(),
  };
  await db.items.put(next);
  return next;
}
