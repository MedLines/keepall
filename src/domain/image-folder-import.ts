import {
  isAllowedLocalImageMime,
  MAX_LOCAL_IMAGE_BYTES,
  normalizeImageMime,
} from "./image";

export type ImageFolderSkipReason = "oversize" | "invalid-mime" | "empty";

export type ImageFolderFileClassification =
  | { kind: "import"; mimeType: string }
  | { kind: "skip"; reason: ImageFolderSkipReason };

export type ImageFolderImportSummary = {
  added: number;
  reused: number;
  skippedOversize: number;
  skippedInvalid: number;
  skippedEmpty: number;
  skippedRead: number;
};

const EXTENSION_MIME: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Drop path segments; use the file name only. */
export function imageFolderBaseName(fileName: string): string {
  const normalized = fileName.replace(/\\/g, "/");
  const segment = normalized.split("/").pop();
  return segment?.trim() ?? fileName.trim();
}

/** Title for a new image item from a folder file name. */
export function imageTitleFromFileName(fileName: string): string {
  const base = imageFolderBaseName(fileName);
  const withoutExt = base.replace(/\.[^.]+$/i, "").trim();
  return withoutExt || base || "Image";
}

export function inferImageFolderMimeType(
  fileName: string,
  reportedMime: string,
): string {
  const normalized = normalizeImageMime(reportedMime);
  if (normalized && isAllowedLocalImageMime(normalized)) {
    return normalized;
  }
  const ext = imageFolderBaseName(fileName).match(/(\.[^.]+)$/i)?.[1]?.toLowerCase();
  if (ext && EXTENSION_MIME[ext]) {
    return EXTENSION_MIME[ext]!;
  }
  return normalized || reportedMime.trim().toLowerCase();
}

/** Size/mime gate before reading bytes. */
export function classifyImageFolderFile(
  fileName: string,
  byteLength: number,
  reportedMime: string,
): ImageFolderFileClassification {
  if (byteLength === 0) {
    return { kind: "skip", reason: "empty" };
  }
  if (byteLength > MAX_LOCAL_IMAGE_BYTES) {
    return { kind: "skip", reason: "oversize" };
  }
  const mimeType = inferImageFolderMimeType(fileName, reportedMime);
  if (!isAllowedLocalImageMime(mimeType)) {
    return { kind: "skip", reason: "invalid-mime" };
  }
  return { kind: "import", mimeType };
}

export function formatImageFolderImportStatus(
  summary: ImageFolderImportSummary,
): string {
  const parts = [
    `${summary.added} added`,
    summary.reused > 0 ? `${summary.reused} already in library` : null,
  ].filter(Boolean);
  const skipped =
    summary.skippedOversize +
    summary.skippedInvalid +
    summary.skippedEmpty +
    summary.skippedRead;
  if (skipped > 0) {
    parts.push(`${skipped} skipped`);
  }
  return `Images: ${parts.join(", ")}.`;
}

export function imageFolderImportSkippedDetail(
  summary: ImageFolderImportSummary,
): string | null {
  const bits: string[] = [];
  if (summary.skippedOversize > 0) {
    bits.push(`${summary.skippedOversize} over 3MB`);
  }
  if (summary.skippedInvalid > 0) {
    bits.push(`${summary.skippedInvalid} unsupported type`);
  }
  if (summary.skippedEmpty > 0) {
    bits.push(`${summary.skippedEmpty} empty`);
  }
  if (summary.skippedRead > 0) {
    bits.push(`${summary.skippedRead} unreadable`);
  }
  if (bits.length === 0) {
    return null;
  }
  return bits.join("; ");
}
