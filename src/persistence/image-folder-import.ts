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

  for (const entry of entries) {
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
      continue;
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
        continue;
      }
      summary.skippedRead += 1;
    }
  }

  return summary;
}

export async function importImageFolder(
  files: File[],
  options?: ImageFolderImportOptions,
): Promise<ImageFolderImportSummary> {
  const entries: ImageFolderImportEntry[] = [];
  const summary = emptySummary();

  for (const file of files) {
    const gate = classifyImageFolderFile(file.name, file.size, file.type);
    if (gate.kind === "skip") {
      if (gate.reason === "oversize") {
        summary.skippedOversize += 1;
      } else if (gate.reason === "empty") {
        summary.skippedEmpty += 1;
      } else {
        summary.skippedInvalid += 1;
      }
      continue;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      entries.push({
        name: file.name,
        bytes,
        mimeType: file.type,
      });
    } catch {
      summary.skippedRead += 1;
    }
  }

  const imported = await importImageFolderEntries(entries, options);
  return {
    added: imported.added,
    reused: imported.reused,
    skippedOversize: summary.skippedOversize + imported.skippedOversize,
    skippedInvalid: summary.skippedInvalid + imported.skippedInvalid,
    skippedEmpty: summary.skippedEmpty + imported.skippedEmpty,
    skippedRead: summary.skippedRead + imported.skippedRead,
  };
}

/** Sum of stored asset bytes — for quota warnings before a large import. */
export async function totalStoredAssetBytes(): Promise<number> {
  const assets = await listAssets();
  return assets.reduce((total, asset) => total + asset.byteLength, 0);
}
