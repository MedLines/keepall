import { classifyCaptureFile } from "@/domain/capture-file";
import { CollectionValidationError } from "@/domain/collection";
import { documentFormat, DocumentValidationError } from "@/domain/document";
import { assertLocalImageFile, ImageValidationError } from "@/domain/image";
import { assertLocalVideo, VideoValidationError } from "@/domain/video";
import { createTextDocument } from "./documents";
import { createImage } from "./items";
import { createVideo } from "./videos";

export type FileImportResult =
  | { fileName: string; status: "saved"; itemId: string }
  | { fileName: string; status: "failed"; error: string };

function importError(error: unknown): string {
  if (error instanceof DocumentValidationError || error instanceof ImageValidationError ||
    error instanceof VideoValidationError || error instanceof CollectionValidationError) return error.message;
  if (error instanceof Error && error.name === "QuotaExceededError") return "Browser storage is full. Free some space, then retry this file.";
  return "Couldn't save this file. Try again.";
}

/** Save separate items, or one atomic gallery when explicitly requested. */
export async function importFiles(files: readonly File[], options: {
  collectionName?: string;
  tagNames?: readonly string[];
  imageMode?: "gallery" | "separate";
  prepareVideo: (file: File) => Promise<Blob>;
  onProgress?: (done: number, result: FileImportResult) => void;
}): Promise<{ results: FileImportResult[]; collectionId?: string }> {
  if (options.imageMode === "gallery") return importGallery(files, options);
  const results: FileImportResult[] = [];
  let collectionId: string | undefined;
  for (const file of files) {
    let result: FileImportResult;
    try {
      const { kind, mimeType } = classifyCaptureFile(file);
      if (kind === "unsupported") throw new DocumentValidationError("Use an image, MP4 or WebM video, .txt, or .md file. PDF and HTML support is coming later.");
      const media = kind === "document" || file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
      if (kind === "document") documentFormat(file.name, file.size);
      if (kind === "image") assertLocalImageFile(media);
      if (kind === "video") assertLocalVideo(media);
      const poster = kind === "video" ? await options.prepareVideo(media) : null;
      const bytes = kind === "video" ? null : new Uint8Array(await file.arrayBuffer());
      const collectionIds = collectionId ? [collectionId] : [];
      const item = kind === "document"
        ? await createTextDocument({ fileName: file.name, bytes: bytes!, collectionIds, collectionName: options.collectionName, tagNames: options.tagNames })
        : kind === "image"
          ? await createImage({ assets: [{ bytes: bytes!, mimeType }], sourceFileName: file.name, collectionIds, collectionName: options.collectionName, tagNames: options.tagNames })
          : await createVideo(media, poster, undefined, undefined, collectionIds, { collectionName: options.collectionName, tagNames: options.tagNames });
      collectionId = item.collectionIds[0];
      result = { fileName: file.name, status: "saved", itemId: item.id };
    } catch (error) {
      result = { fileName: file.name, status: "failed", error: importError(error) };
    }
    results.push(result);
    options.onProgress?.(results.length, result);
  }
  return { results, ...(collectionId ? { collectionId } : {}) };
}

async function importGallery(files: readonly File[], options: { collectionName?: string; tagNames?: readonly string[]; onProgress?: (done: number, result: FileImportResult) => void }) {
  let results: FileImportResult[];
  let collectionId: string | undefined;
  try {
    const media = files.map((file) => {
      const { kind, mimeType } = classifyCaptureFile(file);
      if (kind !== "image") throw new ImageValidationError("Only images can be saved together. Import other files as separate items.");
      const image = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
      assertLocalImageFile(image);
      return image;
    });
    const assets = [];
    for (const image of media) assets.push({ bytes: new Uint8Array(await image.arrayBuffer()), mimeType: image.type });
    const item = await createImage({ assets, collectionName: options.collectionName, tagNames: options.tagNames });
    collectionId = item.collectionIds[0];
    results = files.map((file) => ({ fileName: file.name, status: "saved", itemId: item.id }));
  } catch (error) {
    results = files.map((file) => ({ fileName: file.name, status: "failed", error: importError(error) }));
  }
  results.forEach((result, index) => options.onProgress?.(index + 1, result));
  return { results, ...(collectionId ? { collectionId } : {}) };
}
