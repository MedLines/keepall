import { hashAssetBytes } from "@/domain/asset";
import {
  assertLocalImageBytes,
  ImageValidationError,
  type ImageItem,
} from "@/domain/image";
import {
  classifyImageFolderFile,
  imageFolderBaseName,
  imageTitleFromFileName,
  type ImageFolderImportSummary,
} from "@/domain/image-folder-import";
import { normalizeItem } from "@/domain/item";
import { createCollection } from "./collections";
import { listAssets } from "./assets";
import { getDb } from "./db";
import {
  assignCollectionToItem,
  buildSingleAssetImageHashIndex,
  createOrReuseImage,
} from "./items";

export type ImageFolderImportEntry = {
  name: string;
  bytes: Uint8Array;
  mimeType: string;
};

export type ImageFolderImportOptions = {
  collectionName?: string;
  onProgress?: (progress: {
    done: number;
    total: number;
    currentName: string;
    added: number;
    reused: number;
  }) => void;
  /** Call when new items were added so the library can refresh. */
  onBatch?: () => void;
  batchEvery?: number;
};

function emptySummary(): ImageFolderImportSummary {
  return {
    added: 0,
    reused: 0,
    skippedOversize: 0,
    skippedInvalid: 0,
    skippedEmpty: 0,
    skippedRead: 0,
  };
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function shouldReportProgress(index: number, total: number): boolean {
  return index === 0 || index === total || (index + 1) % 4 === 0;
}

function reportProgress(
  options: ImageFolderImportOptions | undefined,
  summary: ImageFolderImportSummary,
  done: number,
  total: number,
  currentName: string,
): void {
  options?.onProgress?.({
    done,
    total,
    currentName,
    added: summary.added,
    reused: summary.reused,
  });
}

type ImportBatchContext = {
  collectionId: string | null;
  hashIndex: Map<string, string>;
};

async function loadImageById(id: string): Promise<ImageItem | null> {
  const row = await getDb().items.get(id);
  if (!row) {
    return null;
  }
  const item = normalizeItem(row);
  return item.type === "image" ? item : null;
}

async function importOneEntry(
  entry: ImageFolderImportEntry,
  summary: ImageFolderImportSummary,
  ctx: ImportBatchContext,
): Promise<void> {
  const gate = classifyImageFolderFile(
    entry.name,
    entry.bytes.byteLength,
    entry.mimeType,
  );
  if (gate.kind === "skip") {
    if (gate.reason === "oversize") {
      summary.skippedOversize += 1;
    } else if (gate.reason === "empty") {
      summary.skippedEmpty += 1;
    } else {
      summary.skippedInvalid += 1;
    }
    return;
  }

  try {
    const mime = assertLocalImageBytes(entry.bytes, gate.mimeType);
    const contentHash = await hashAssetBytes(entry.bytes);
    const cachedId = ctx.hashIndex.get(contentHash);
    let image: ImageItem;
    let created: boolean;

    if (cachedId) {
      const cached = await loadImageById(cachedId);
      if (cached) {
        image = cached;
        created = false;
      } else {
        ctx.hashIndex.delete(contentHash);
        const result = await createOrReuseImage({
          assets: [{ bytes: entry.bytes, mimeType: mime }],
          sourceFileName: imageFolderBaseName(entry.name),
        });
        image = result.image;
        created = result.created;
        ctx.hashIndex.set(contentHash, image.id);
      }
    } else {
      const result = await createOrReuseImage({
        assets: [{ bytes: entry.bytes, mimeType: mime }],
        sourceFileName: imageFolderBaseName(entry.name),
      });
      image = result.image;
      created = result.created;
      ctx.hashIndex.set(contentHash, image.id);
    }

    if (created) {
      summary.added += 1;
    } else {
      summary.reused += 1;
    }
    if (ctx.collectionId && !image.collectionIds.includes(ctx.collectionId)) {
      await assignCollectionToItem(image.id, ctx.collectionId);
    }
  } catch (caught) {
    if (caught instanceof ImageValidationError) {
      summary.skippedInvalid += 1;
      return;
    }
    summary.skippedRead += 1;
  }
}

async function runImportLoop(
  total: number,
  processIndex: (index: number) => Promise<void>,
  options: ImageFolderImportOptions | undefined,
  summary: ImageFolderImportSummary,
): Promise<void> {
  const batchEvery = options?.batchEvery ?? 10;
  let lastRefreshAdded = 0;

  for (let index = 0; index < total; index += 1) {
    await processIndex(index);
    if (
      options?.onBatch &&
      batchEvery > 0 &&
      (index + 1) % batchEvery === 0 &&
      summary.added > lastRefreshAdded
    ) {
      lastRefreshAdded = summary.added;
      options.onBatch();
    }
    if ((index + 1) % 8 === 0) {
      await yieldToUi();
    }
  }

  reportProgress(options, summary, total, total, "");
}

export async function importImageFolderEntries(
  entries: ImageFolderImportEntry[],
  options?: ImageFolderImportOptions,
): Promise<ImageFolderImportSummary> {
  const summary = emptySummary();
  const collectionName = options?.collectionName?.trim();
  let collectionId: string | null = null;

  if (collectionName) {
    const collection = await createCollection({ name: collectionName });
    collectionId = collection.id;
  }

  const ctx: ImportBatchContext = {
    collectionId,
    hashIndex: await buildSingleAssetImageHashIndex(),
  };

  await runImportLoop(
    entries.length,
    async (index) => {
      const entry = entries[index]!;
      await importOneEntry(entry, summary, ctx);
      if (shouldReportProgress(index, entries.length)) {
        reportProgress(
          options,
          summary,
          index + 1,
          entries.length,
          imageTitleFromFileName(entry.name),
        );
      }
    },
    options,
    summary,
  );

  return summary;
}

export async function importImageFolder(
  files: File[],
  options?: ImageFolderImportOptions,
): Promise<ImageFolderImportSummary> {
  const summary = emptySummary();
  const collectionName = options?.collectionName?.trim();
  let collectionId: string | null = null;

  if (collectionName) {
    const collection = await createCollection({ name: collectionName });
    collectionId = collection.id;
  }

  const ctx: ImportBatchContext = {
    collectionId,
    hashIndex: await buildSingleAssetImageHashIndex(),
  };

  await runImportLoop(
    files.length,
    async (index) => {
      const file = files[index]!;
      const gate = classifyImageFolderFile(file.name, file.size, file.type);
      if (gate.kind === "skip") {
        if (gate.reason === "oversize") {
          summary.skippedOversize += 1;
        } else if (gate.reason === "empty") {
          summary.skippedEmpty += 1;
        } else {
          summary.skippedInvalid += 1;
        }
        return;
      }

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        await importOneEntry(
          { name: file.name, bytes, mimeType: file.type },
          summary,
          ctx,
        );
      } catch {
        summary.skippedRead += 1;
      }

      if (shouldReportProgress(index, files.length)) {
        reportProgress(
          options,
          summary,
          index + 1,
          files.length,
          imageTitleFromFileName(file.name),
        );
      }
    },
    options,
    summary,
  );

  return summary;
}

/** Sum of stored asset bytes — for quota warnings before a large import. */
export async function totalStoredAssetBytes(): Promise<number> {
  const assets = await listAssets();
  return assets.reduce((total, asset) => total + asset.byteLength, 0);
}
