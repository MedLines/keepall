import { classifyCaptureFile, type FileImportStage } from "@/domain/capture-file";
import { CollectionValidationError } from "@/domain/collection";
import { documentFormat, DocumentValidationError } from "@/domain/document";
import { assertLocalImageFile, ImageValidationError } from "@/domain/image";
import { assertLocalVideo, VideoValidationError } from "@/domain/video";
import { createDocument } from "./documents";
import { createImage } from "./items";
import { createVideo } from "./videos";
import { abortable } from "@/lib/abortable";

export type FileImportResult =
  | { fileName: string; status: "saved"; itemId: string }
  | { fileName: string; status: "failed"; error: string }
  | { fileName: string; status: "cancelled" };

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
  onStage?: (stage: FileImportStage, fileName: string) => void;
  signal?: AbortSignal;
}): Promise<{ results: FileImportResult[]; collectionId?: string; cancelled?: boolean }> {
  if (options.imageMode === "gallery") return importGallery(files, options);
  const results: FileImportResult[] = [];
  let collectionId: string | undefined;
  for (const file of files) {
    if (options.signal?.aborted) break;
    let result: FileImportResult;
    try {
      const { kind, mimeType } = classifyCaptureFile(file);
      if (kind === "unsupported") throw new DocumentValidationError("Use an image, MP4 or WebM video, .txt, .md, or .pdf file. HTML support is coming later.");
      const media = kind === "document" || file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
      if (kind === "document") documentFormat(file.name, file.size);
      if (kind === "image") assertLocalImageFile(media);
      if (kind === "video") assertLocalVideo(media);
      options.onStage?.(kind === "video" ? "preparing-video" : "reading", file.name);
      const poster = kind === "video" ? await abortable(options.prepareVideo(media), options.signal) : null;
      const bytes = kind === "video" ? null : new Uint8Array(await abortable(file.arrayBuffer(), options.signal));
      options.signal?.throwIfAborted();
      const collectionIds = collectionId ? [collectionId] : [];
      options.onStage?.("saving", file.name);
      const item = kind === "document"
        ? await createDocument({ fileName: file.name, bytes: bytes!, collectionIds, collectionName: options.collectionName, tagNames: options.tagNames, signal: options.signal })
        : kind === "image"
          ? await createImage({ assets: [{ bytes: bytes!, mimeType }], sourceFileName: file.name, collectionIds, collectionName: options.collectionName, tagNames: options.tagNames, signal: options.signal })
          : await createVideo(media, poster, undefined, undefined, collectionIds, { collectionName: options.collectionName, tagNames: options.tagNames, signal: options.signal });
      collectionId = item.collectionIds[0];
      result = { fileName: file.name, status: "saved", itemId: item.id };
    } catch (error) {
      if (options.signal?.aborted) break;
      result = { fileName: file.name, status: "failed", error: importError(error) };
    }
    results.push(result);
    options.onProgress?.(results.length, result);
  }
  return { results, ...(collectionId ? { collectionId } : {}), ...(options.signal?.aborted && results.length < files.length ? { cancelled: true } : {}) };
}

async function importGallery(files: readonly File[], options: { collectionName?: string; tagNames?: readonly string[]; onProgress?: (done: number, result: FileImportResult) => void; signal?: AbortSignal }) {
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
    for (const image of media) assets.push({ bytes: new Uint8Array(await abortable(image.arrayBuffer(), options.signal)), mimeType: image.type });
    const item = await createImage({ assets, collectionName: options.collectionName, tagNames: options.tagNames, signal: options.signal });
    collectionId = item.collectionIds[0];
    results = files.map((file) => ({ fileName: file.name, status: "saved", itemId: item.id }));
  } catch (error) {
    if (options.signal?.aborted) return { results: files.map((file): FileImportResult => ({ fileName: file.name, status: "cancelled" })), cancelled: true };
    results = files.map((file) => ({ fileName: file.name, status: "failed", error: importError(error) }));
  }
  results.forEach((result, index) => options.onProgress?.(index + 1, result));
  return { results, ...(collectionId ? { collectionId } : {}) };
}
