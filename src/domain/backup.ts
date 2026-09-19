import { isHttpUrl } from "./classify";
import type { Collection } from "./collection";
import { coerceExclusiveCollectionIds } from "./collection";
import type { Item } from "./item";
import type { ImageItem } from "./image";
import { coerceImageFields } from "./image";
import type { LinkItem } from "./link";
import { coerceLinkPreviewFields } from "./link";
import type { NoteItem } from "./note";
import type { Tag } from "./tag";

export const KEEPALL_BACKUP_FORMAT = "keepall";
export const KEEPALL_BACKUP_VERSION = 1;

/** Asset row serialized for JSON backup (bytes as base64). */
export type BackupAssetRecord = {
  id: string;
  mimeType: string;
  byteLength: number;
  dataBase64: string;
  contentHash?: string;
  createdAt: number;
};

export type KeepallBackup = {
  format: typeof KEEPALL_BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  items: Item[];
  tags: Tag[];
  collections: Collection[];
  assets: BackupAssetRecord[];
};

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

export function buildKeepallBackup(input: {
  items: Item[];
  tags: Tag[];
  collections: Collection[];
  assets?: BackupAssetRecord[];
  exportedAt?: number;
}): KeepallBackup {
  return {
    format: KEEPALL_BACKUP_FORMAT,
    version: KEEPALL_BACKUP_VERSION,
    exportedAt: input.exportedAt ?? Date.now(),
    items: input.items,
    tags: input.tags,
    collections: input.collections,
    assets: input.assets ?? [],
  };
}

export function parseKeepallBackup(raw: unknown): KeepallBackup {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BackupValidationError("Backup must be a JSON object");
  }

  const candidate = raw as Record<string, unknown>;

  if (candidate.format !== KEEPALL_BACKUP_FORMAT) {
    throw new BackupValidationError('Backup format must be "keepall"');
  }

  if (candidate.version !== KEEPALL_BACKUP_VERSION) {
    throw new BackupValidationError(
      `Unsupported backup version (supported: ${KEEPALL_BACKUP_VERSION})`,
    );
  }

  if (
    typeof candidate.exportedAt !== "number" ||
    !Number.isFinite(candidate.exportedAt)
  ) {
    throw new BackupValidationError("Backup exportedAt must be a number");
  }

  if (!Array.isArray(candidate.items)) {
    throw new BackupValidationError("Backup items must be an array");
  }

  if (!Array.isArray(candidate.tags)) {
    throw new BackupValidationError("Backup tags must be an array");
  }

  if (!Array.isArray(candidate.collections)) {
    throw new BackupValidationError("Backup collections must be an array");
  }

  const rawAssets = candidate.assets;
  if (rawAssets !== undefined && !Array.isArray(rawAssets)) {
    throw new BackupValidationError("Backup assets must be an array when present");
  }

  const tags = candidate.tags.map((tag, index) => parseTag(tag, index));
  const collections = candidate.collections.map((collection, index) =>
    parseCollection(collection, index),
  );
  const assets = (rawAssets ?? []).map((asset, index) =>
    parseAsset(asset, index),
  );
  assertUniqueIds(
    tags.map((tag) => tag.id),
    "tag",
  );
  assertUniqueIds(
    collections.map((collection) => collection.id),
    "collection",
  );
  assertUniqueIds(
    assets.map((asset) => asset.id),
    "asset",
  );

  const tagIds = new Set(tags.map((tag) => tag.id));
  const collectionIds = new Set(collections.map((collection) => collection.id));
  const assetIds = new Set(assets.map((asset) => asset.id));
  const items = candidate.items.map((item, index) =>
    parseItem(item, index, tagIds, collectionIds, assetIds),
  );
  assertUniqueIds(
    items.map((item) => item.id),
    "item",
  );

  return {
    format: KEEPALL_BACKUP_FORMAT,
    version: KEEPALL_BACKUP_VERSION,
    exportedAt: candidate.exportedAt,
    items,
    tags,
    collections,
    assets,
  };
}

function assertUniqueIds(ids: string[], label: string) {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      throw new BackupValidationError(`Duplicate ${label} id: ${id}`);
    }
    seen.add(id);
  }
}

function parseTag(raw: unknown, index: number): Tag {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BackupValidationError(`Tag at index ${index} must be an object`);
  }

  const tag = raw as Record<string, unknown>;

  if (typeof tag.id !== "string" || !tag.id) {
    throw new BackupValidationError(`Tag at index ${index} needs a non-empty id`);
  }

  if (typeof tag.name !== "string" || !tag.name.trim()) {
    throw new BackupValidationError(
      `Tag at index ${index} needs a non-empty name`,
    );
  }

  if (typeof tag.createdAt !== "number" || !Number.isFinite(tag.createdAt)) {
    throw new BackupValidationError(
      `Tag at index ${index} needs a numeric createdAt`,
    );
  }

  return {
    id: tag.id,
    name: tag.name.trim().replace(/\s+/g, " "),
    createdAt: tag.createdAt,
  };
}

function parseCollection(raw: unknown, index: number): Collection {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BackupValidationError(
      `Collection at index ${index} must be an object`,
    );
  }

  const collection = raw as Record<string, unknown>;

  if (typeof collection.id !== "string" || !collection.id) {
    throw new BackupValidationError(
      `Collection at index ${index} needs a non-empty id`,
    );
  }

  if (typeof collection.name !== "string" || !collection.name.trim()) {
    throw new BackupValidationError(
      `Collection at index ${index} needs a non-empty name`,
    );
  }

  if (
    typeof collection.createdAt !== "number" ||
    !Number.isFinite(collection.createdAt)
  ) {
    throw new BackupValidationError(
      `Collection at index ${index} needs a numeric createdAt`,
    );
  }

  return {
    id: collection.id,
    name: collection.name.trim().replace(/\s+/g, " "),
    createdAt: collection.createdAt,
    pinnedItemIds: parseStringIdArray(
      collection.pinnedItemIds,
      "pinnedItemIds",
      index,
    ),
  };
}

function parseStringIdArray(
  value: unknown,
  label: string,
  index: number,
): string[] {
  // Missing field = same as Library normalize-on-read (pre-tags / pre-collections rows).
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new BackupValidationError(
      `Item at index ${index} needs ${label} as an array`,
    );
  }

  return value.map((entry, entryIndex) => {
    if (typeof entry !== "string" || !entry) {
      throw new BackupValidationError(
        `Item at index ${index} has an invalid ${label} entry at ${entryIndex}`,
      );
    }
    return entry;
  });
}

function parseAsset(raw: unknown, index: number): BackupAssetRecord {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BackupValidationError(`Asset at index ${index} must be an object`);
  }

  const asset = raw as Record<string, unknown>;

  if (typeof asset.id !== "string" || !asset.id) {
    throw new BackupValidationError(
      `Asset at index ${index} needs a non-empty id`,
    );
  }

  if (typeof asset.mimeType !== "string" || !asset.mimeType.trim()) {
    throw new BackupValidationError(
      `Asset at index ${index} needs a non-empty mimeType`,
    );
  }

  if (
    typeof asset.byteLength !== "number" ||
    !Number.isFinite(asset.byteLength) ||
    asset.byteLength < 0
  ) {
    throw new BackupValidationError(
      `Asset at index ${index} needs a non-negative byteLength`,
    );
  }

  if (typeof asset.dataBase64 !== "string" || !asset.dataBase64) {
    throw new BackupValidationError(
      `Asset at index ${index} needs dataBase64`,
    );
  }

  if (
    typeof asset.createdAt !== "number" ||
    !Number.isFinite(asset.createdAt)
  ) {
    throw new BackupValidationError(
      `Asset at index ${index} needs a numeric createdAt`,
    );
  }

  return {
    id: asset.id,
    mimeType: asset.mimeType.trim(),
    byteLength: asset.byteLength,
    dataBase64: asset.dataBase64,
    contentHash:
      typeof asset.contentHash === "string" ? asset.contentHash : undefined,
    createdAt: asset.createdAt,
  };
}

function parseItem(
  raw: unknown,
  index: number,
  tagIds: Set<string>,
  collectionIds: Set<string>,
  assetIds: Set<string>,
): Item {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BackupValidationError(`Item at index ${index} must be an object`);
  }

  const item = raw as Record<string, unknown>;

  if (typeof item.id !== "string" || !item.id) {
    throw new BackupValidationError(
      `Item at index ${index} needs a non-empty id`,
    );
  }

  if (
    typeof item.createdAt !== "number" ||
    !Number.isFinite(item.createdAt) ||
    typeof item.updatedAt !== "number" ||
    !Number.isFinite(item.updatedAt)
  ) {
    throw new BackupValidationError(
      `Item at index ${index} needs numeric createdAt and updatedAt`,
    );
  }

  if (typeof item.title !== "string") {
    throw new BackupValidationError(
      `Item at index ${index} needs a string title`,
    );
  }

  const itemTagIds = parseStringIdArray(item.tagIds, "tagIds", index);
  const itemCollectionIds = coerceExclusiveCollectionIds(
    parseStringIdArray(item.collectionIds, "collectionIds", index),
  );

  for (const tagId of itemTagIds) {
    if (!tagIds.has(tagId)) {
      throw new BackupValidationError(
        `Item at index ${index} references missing tag id: ${tagId}`,
      );
    }
  }

  for (const collectionId of itemCollectionIds) {
    if (!collectionIds.has(collectionId)) {
      throw new BackupValidationError(
        `Item at index ${index} references missing collection id: ${collectionId}`,
      );
    }
  }

  if (item.type === "note") {
    if (typeof item.content !== "string" || !item.content.trim()) {
      throw new BackupValidationError(
        `Note at index ${index} needs non-empty content`,
      );
    }

    const note: NoteItem = {
      id: item.id,
      type: "note",
      title: item.title,
      content: item.content,
      tagIds: itemTagIds,
      collectionIds: itemCollectionIds,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
    return note;
  }

  if (item.type === "link") {
    if (typeof item.url !== "string" || !isHttpUrl(item.url)) {
      throw new BackupValidationError(
        `Link at index ${index} needs an http or https URL`,
      );
    }

    const preview = coerceLinkPreviewFields(item as Partial<LinkItem>);
    const previewAssetId =
      preview.previewAssetId && assetIds.has(preview.previewAssetId)
        ? preview.previewAssetId
        : null;

    const link: LinkItem = {
      id: item.id,
      type: "link",
      title: item.title,
      url: item.url,
      ...preview,
      previewAssetId,
      tagIds: itemTagIds,
      collectionIds: itemCollectionIds,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
    return link;
  }

  if (item.type === "image") {
    const fields = coerceImageFields(item as Partial<ImageItem>);
    if (
      fields.assetIds.length === 0 ||
      fields.assetIds.some((id) => !assetIds.has(id))
    ) {
      throw new BackupValidationError(
        `Image at index ${index} needs known assetIds`,
      );
    }
    if (fields.sourceUrl && !isHttpUrl(fields.sourceUrl)) {
      throw new BackupValidationError(
        `Image at index ${index} sourceUrl must be http or https`,
      );
    }

    const image: ImageItem = {
      id: item.id,
      type: "image",
      title: item.title,
      assetIds: fields.assetIds,
      ...(fields.sourceFileName ? { sourceFileName: fields.sourceFileName } : {}),
      sourceUrl: fields.sourceUrl,
      caption: fields.caption,
      tagIds: itemTagIds,
      collectionIds: itemCollectionIds,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
    return image;
  }

  throw new BackupValidationError(
    `Item at index ${index} has an unsupported type`,
  );
}
