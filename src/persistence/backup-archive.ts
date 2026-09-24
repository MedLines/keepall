import { BlobReader, BlobWriter, TextReader, TextWriter, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";
import { BackupValidationError, parseKeepallBackup, type KeepallBackup } from "@/domain/backup";
import { assetToBlob, hashAssetBytes } from "@/domain/asset";
import { normalizeItem } from "@/domain/item";
import { MAX_LOCAL_IMAGE_BYTES } from "@/domain/image";
import { normalizePinnedCollectionIds } from "@/domain/library-preferences";
import { MAX_LOCAL_VIDEO_BYTES, type VideoItem } from "@/domain/video";
import { listAssets } from "./assets";
import { importKeepallBackupMerge, replaceValidatedBackup } from "./backup";
import { getDb, type Thumbnail, type VideoAsset } from "./db";
import { getLibraryPreferences } from "./library-preferences";

const ARCHIVE_VERSION = 6;
const UUID = "[0-9a-f-]{36}";
const assetPath = new RegExp(`^assets/(${UUID})\\.bin$`, "i");
const videoPath = new RegExp(`^videos/(${UUID})\\.bin$`, "i");
const thumbnailPath = new RegExp(`^thumbnails/(${UUID})\\.bin$`, "i");

type ArchiveAsset = Omit<KeepallBackup["assets"][number], "dataBase64"> & { path: string };
type ArchiveVideo = { id: string; mimeType: string; byteLength: number; createdAt: number; path: string };
type ArchiveThumbnail = { assetId: string; mimeType: string; byteLength: number; path: string };
type ArchiveManifest = Omit<KeepallBackup, "assets"> & { assets: ArchiveAsset[]; videos: ArchiveVideo[]; thumbnails: ArchiveThumbnail[] };

export async function exportKeepallArchive(exportedAt = Date.now()): Promise<Blob> {
  const db = getDb();
  const [rawItems, tags, collections, assets, videos, thumbnails, preferences] = await Promise.all([
    db.items.toArray(), db.tags.toArray(), db.collections.toArray(),
    listAssets(), db.videoAssets.toArray(), db.thumbnails.toArray(), getLibraryPreferences(),
  ]);
  const manifest: ArchiveManifest = {
    format: "keepall", version: ARCHIVE_VERSION, exportedAt,
    items: rawItems.map((item) => normalizeItem(item)), tags, collections,
    assets: assets.map(({ id, mimeType, byteLength, contentHash, createdAt }) => ({
      id, mimeType, byteLength, contentHash, createdAt, path: `assets/${id}.bin`,
    })),
    videos: videos.map(({ id, mimeType, byteLength, createdAt }) => ({
      id, mimeType, byteLength, createdAt, path: `videos/${id}.bin`,
    })),
    thumbnails: thumbnails.map(({ assetId, blob }) => ({
      assetId, mimeType: blob.type, byteLength: blob.size, path: `thumbnails/${assetId}.bin`,
    })),
    preferences: {
      pinnedCollectionIds: normalizePinnedCollectionIds(
        preferences.pinnedCollectionIds, collections.map((collection) => collection.id),
      ),
    },
  };
  const supportsBlobStream = typeof Blob.prototype.stream === "function";
  const writer = supportsBlobStream
    ? new ZipWriter(new BlobWriter("application/zip"), { level: 0 })
    : new ZipWriter(new Uint8ArrayWriter(), { level: 0 });
  try {
    await writer.add("manifest.json", new TextReader(JSON.stringify(manifest)));
    for (const asset of assets) {
      await writer.add(`assets/${asset.id}.bin`, new BlobReader(assetToBlob(asset)));
    }
    for (const video of videos) {
      await writer.add(`videos/${video.id}.bin`, new BlobReader(video.blob));
    }
    for (const thumbnail of thumbnails) {
      await writer.add(`thumbnails/${thumbnail.assetId}.bin`, new BlobReader(thumbnail.blob));
    }
    const archive = await writer.close();
    return archive instanceof Blob ? archive : new Blob([new Uint8Array(archive)], { type: "application/zip" });
  } catch (error) {
    await writer.close();
    throw error;
  }
}

async function readArchive(file: Blob): Promise<{
  backup: KeepallBackup;
  binaryAssets: Map<string, Uint8Array>;
  videoAssets: VideoAsset[];
  thumbnails: Thumbnail[];
}> {
  const reader = new ZipReader(new BlobReader(file));
  try {
    const entries = await reader.getEntries();
    const byName = new Map(entries.map((entry) => [entry.filename, entry]));
    const manifestEntry = byName.get("manifest.json");
    if (byName.size !== entries.length || !manifestEntry || manifestEntry.directory) {
      throw new BackupValidationError("Archive has missing or duplicate entries");
    }
    if (manifestEntry.uncompressedSize > 50 * 1024 * 1024) {
      throw new BackupValidationError("Archive manifest is too large");
    }
    const manifestText = await manifestEntry.getData(new TextWriter());
    let raw: unknown;
    try { raw = JSON.parse(manifestText); }
    catch { throw new BackupValidationError("Archive manifest is invalid JSON"); }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new BackupValidationError("Archive manifest must be an object");
    }
    const candidate = raw as Record<string, unknown>;
    if (candidate.format !== "keepall" || candidate.version !== ARCHIVE_VERSION ||
        !Array.isArray(candidate.assets) || !Array.isArray(candidate.videos) ||
        !Array.isArray(candidate.thumbnails) || !Array.isArray(candidate.items)) {
      throw new BackupValidationError("Unsupported archive format");
    }
    const assets = candidate.assets as Record<string, unknown>[];
    const videos = candidate.videos as Record<string, unknown>[];
    const thumbnailRecords = candidate.thumbnails as Record<string, unknown>[];
    const paths = new Set<string>();
    for (const record of assets) {
      if (!record || typeof record.id !== "string" || typeof record.path !== "string" ||
          !assetPath.test(record.path) || record.path !== `assets/${record.id}.bin` || paths.has(record.path) ||
          typeof record.byteLength !== "number" || !Number.isSafeInteger(record.byteLength) ||
          record.byteLength < 1 || record.byteLength > MAX_LOCAL_IMAGE_BYTES) {
        throw new BackupValidationError("Archive has an invalid asset path");
      }
      paths.add(record.path);
    }
    for (const record of videos) {
      if (!record || typeof record.id !== "string" || typeof record.path !== "string" ||
          !videoPath.test(record.path) || record.path !== `videos/${record.id}.bin` || paths.has(record.path) ||
          (record.mimeType !== "video/mp4" && record.mimeType !== "video/webm") ||
          typeof record.byteLength !== "number" || !Number.isSafeInteger(record.byteLength) ||
          record.byteLength < 1 || record.byteLength > MAX_LOCAL_VIDEO_BYTES ||
          typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt)) {
        throw new BackupValidationError("Archive has invalid video metadata");
      }
      paths.add(record.path);
    }
    const mediaIds = new Set([...assets.map((asset) => asset.id), ...videos.map((video) => video.id)]);
    if (mediaIds.size !== assets.length + videos.length) {
      throw new BackupValidationError("Archive has duplicate media ids");
    }
    for (const record of thumbnailRecords) {
      if (!record || typeof record.assetId !== "string" || !mediaIds.has(record.assetId) ||
          typeof record.path !== "string" || !thumbnailPath.test(record.path) ||
          record.path !== `thumbnails/${record.assetId}.bin` || paths.has(record.path) ||
          !["image/webp", "image/png", "image/jpeg"].includes(record.mimeType as string) ||
          typeof record.byteLength !== "number" || !Number.isSafeInteger(record.byteLength) ||
          record.byteLength < 1 || record.byteLength > 2 * 1024 * 1024) {
        throw new BackupValidationError("Archive has invalid thumbnail metadata");
      }
      paths.add(record.path);
    }
    if (entries.length !== paths.size + 1 || [...paths].some((path) => !byName.has(path))) {
      throw new BackupValidationError("Archive files do not match its manifest");
    }
    const videoItems = (candidate.items as Record<string, unknown>[]).filter((item) => item?.type === "video");
    const ids = new Set(videos.map((video) => video.id));
    const seen = new Set<string>();
    const referencedVideoIds = new Set<string>();
    for (const item of videoItems) {
      if (typeof item.id !== "string" || seen.has(item.id) || typeof item.assetId !== "string" ||
          !ids.has(item.assetId) || referencedVideoIds.has(item.assetId) ||
          typeof item.title !== "string" || !item.title.trim() ||
          typeof item.sourceFileName !== "string" || !item.sourceFileName.trim() ||
          (item.noteContent !== undefined && typeof item.noteContent !== "string") ||
          (item.noteFormat !== undefined && item.noteFormat !== "plain" && item.noteFormat !== "markdown") ||
          !Array.isArray(item.tagIds) || item.tagIds.some((id: unknown) => typeof id !== "string") ||
          new Set(item.tagIds).size !== item.tagIds.length ||
          !Array.isArray(item.collectionIds) || item.collectionIds.length > 1 ||
          item.collectionIds.some((id: unknown) => typeof id !== "string") ||
          typeof item.createdAt !== "number" || !Number.isFinite(item.createdAt) ||
          typeof item.updatedAt !== "number" || !Number.isFinite(item.updatedAt)) {
        throw new BackupValidationError("Archive has an invalid video item");
      }
      seen.add(item.id);
      referencedVideoIds.add(item.assetId);
    }
    if (seen.size !== videos.length) throw new BackupValidationError("Archive has an unreferenced video");
    const backup = parseKeepallBackup({
      ...candidate, version: 5,
      items: (candidate.items as Record<string, unknown>[]).filter((item) => item?.type !== "video"),
      assets: assets.map(({ id, mimeType, byteLength, contentHash, createdAt }) => ({
        id, mimeType, byteLength, contentHash, createdAt, dataBase64: "AA==",
      })),
    });
    const validTagIds = new Set(backup.tags.map((tag) => tag.id));
    const validCollectionIds = new Set(backup.collections.map((collection) => collection.id));
    if (videoItems.some((item) =>
      (item.tagIds as unknown[]).some((id) => !validTagIds.has(id as string)) ||
      (item.collectionIds as unknown[]).some((id) => !validCollectionIds.has(id as string)) ||
      backup.items.some((existing) => existing.id === item.id))) {
      throw new BackupValidationError("Archive video references missing organization or duplicate item id");
    }
    backup.items.push(...videoItems.map((item) => ({ ...item, noteContent: item.noteContent ?? "" })) as VideoItem[]);
    const binaryAssets = new Map<string, Uint8Array>();
    for (const record of assets) {
      const entry = byName.get(record.path as string);
      if (!entry || entry.directory || entry.uncompressedSize !== record.byteLength) throw new BackupValidationError(`Archive asset is missing or damaged: ${record.id}`);
      const bytes = await entry.getData(new Uint8ArrayWriter());
      if (bytes.byteLength !== record.byteLength ||
          (record.contentHash && await hashAssetBytes(bytes) !== record.contentHash)) {
        throw new BackupValidationError(`Archive asset is damaged: ${record.id}`);
      }
      binaryAssets.set(record.id as string, bytes);
    }
    const videoAssets: VideoAsset[] = [];
    for (const record of videos) {
      const entry = byName.get(record.path as string);
      if (!entry || entry.directory || entry.uncompressedSize !== record.byteLength) throw new BackupValidationError(`Archive video is missing or damaged: ${record.id}`);
      const blob = typeof Blob.prototype.stream === "function"
        ? await entry.getData(new BlobWriter(record.mimeType as string))
        : new Blob([new Uint8Array(await entry.getData(new Uint8ArrayWriter()))], { type: record.mimeType as string });
      if (blob.size !== record.byteLength) {
        throw new BackupValidationError(`Archive video is damaged: ${record.id}`);
      }
      videoAssets.push({
        id: record.id as string, mimeType: record.mimeType as string,
        byteLength: blob.size, blob,
        createdAt: record.createdAt as number,
      });
    }
    const thumbnails: Thumbnail[] = [];
    for (const record of thumbnailRecords) {
      const entry = byName.get(record.path as string);
      if (!entry || entry.directory || entry.uncompressedSize !== record.byteLength) throw new BackupValidationError("Archive thumbnail is missing or damaged");
      const bytes = await entry.getData(new Uint8ArrayWriter());
      if (bytes.byteLength !== record.byteLength) throw new BackupValidationError("Archive thumbnail is damaged");
      thumbnails.push({ assetId: record.assetId as string, blob: new Blob([new Uint8Array(bytes)], { type: record.mimeType as string }) });
    }
    return { backup, binaryAssets, videoAssets, thumbnails };
  } catch (error) {
    if (error instanceof BackupValidationError) throw error;
    throw new BackupValidationError("Could not read backup archive");
  } finally {
    await reader.close();
  }
}

export async function importKeepallArchiveReplace(file: Blob): Promise<KeepallBackup> {
  const { backup, binaryAssets, videoAssets, thumbnails } = await readArchive(file);
  return replaceValidatedBackup(backup, binaryAssets, videoAssets, thumbnails);
}

export async function importKeepallArchiveMerge(file: Blob) {
  const { backup, binaryAssets, videoAssets, thumbnails } = await readArchive(file);
  const videoItems = backup.items.filter((item): item is VideoItem => item.type === "video");
  return importKeepallBackupMerge(
    { ...backup, items: backup.items.filter((item) => item.type !== "video") },
    binaryAssets,
    { items: videoItems, assets: videoAssets, thumbnails },
  );
}
