import {
  assertLocalImageBytes,
  ImageValidationError,
} from "@/domain/image";
import {
  classifyImageFolderFile,
  imageTitleFromFileName,
  type ImageFolderImportSummary,
} from "@/domain/image-folder-import";
import { createCollection } from "./collections";
import { listAssets } from "./assets";
import { assignCollectionToItem, createOrReuseImage } from "./items";

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
  }) => void;
  /** Call every N successfully processed files so the library can refresh. */
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

async function importOneEntry(
  entry: ImageFolderImportEntry,
  summary: ImageFolderImportSummary,
  collectionId: string | null,
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
    const { image, created } = await createOrReuseImage({
      assets: [{ bytes: entry.bytes, mimeType: mime }],
      title: imageTitleFromFileName(entry.name),
    });
    if (created) {
      summary.added += 1;
    } else {
      summary.reused += 1;
    }
    if (collectionId) {
      await assignCollectionToItem(image.id, collectionId);
    }
  } catch (caught) {
    if (caught instanceof ImageValidationError) {
      summary.skippedInvalid += 1;
      return;
    }
    summary.skippedRead += 1;
  }
}

export async function importImageFolderEntries(
  entries: ImageFolderImportEntry[],
  options?: ImageFolderImportOptions,
): Promise<ImageFolderImportSummary> {
  const summary = emptySummary();
  const collectionName = options?.collectionName?.trim();
  let collectionId: string | null = null;
  const total = entries.length;
  const batchEvery = options?.batchEvery ?? 10;

  if (collectionName) {
    const collection = await createCollection({ name: collectionName });
    collectionId = collection.id;
  }

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    options?.onProgress?.({
      done: index,
      total,
      currentName: imageTitleFromFileName(entry.name),
    });
    await importOneEntry(entry, summary, collectionId);
    if (options?.onBatch && batchEvery > 0 && (index + 1) % batchEvery === 0) {
      options.onBatch();
    }
    await yieldToUi();
  }

  options?.onProgress?.({
    done: total,
    total,
    currentName: "",
  });

  return summary;
}

export async function importImageFolder(
  files: File[],
  options?: ImageFolderImportOptions,
): Promise<ImageFolderImportSummary> {
  const summary = emptySummary();
  const collectionName = options?.collectionName?.trim();
  let collectionId: string | null = null;
  const total = files.length;
  const batchEvery = options?.batchEvery ?? 10;

  if (collectionName) {
    const collection = await createCollection({ name: collectionName });
    collectionId = collection.id;
  }

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    const displayName = imageTitleFromFileName(file.name);
    options?.onProgress?.({ done: index, total, currentName: displayName });

    const gate = classifyImageFolderFile(file.name, file.size, file.type);
    if (gate.kind === "skip") {
      if (gate.reason === "oversize") {
        summary.skippedOversize += 1;
      } else if (gate.reason === "empty") {
        summary.skippedEmpty += 1;
      } else {
        summary.skippedInvalid += 1;
      }
      await yieldToUi();
      continue;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await importOneEntry(
        { name: file.name, bytes, mimeType: file.type },
        summary,
        collectionId,
      );
    } catch {
      summary.skippedRead += 1;
    }

    if (options?.onBatch && batchEvery > 0 && (index + 1) % batchEvery === 0) {
      options.onBatch();
    }
    await yieldToUi();
  }

  options?.onProgress?.({ done: total, total, currentName: "" });

  return summary;
}

/** Sum of stored asset bytes — for quota warnings before a large import. */
export async function totalStoredAssetBytes(): Promise<number> {
  const assets = await listAssets();
  return assets.reduce((total, asset) => total + asset.byteLength, 0);
}
