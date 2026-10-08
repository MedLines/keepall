import { classifyCaptureFile } from "./capture-file";
import { documentFormat } from "./document";
import { assertLocalImageFile } from "./image";
import { assertLocalVideo } from "./video";

export const MAX_TRANSFER_FILES = 50;
export const MAX_TRANSFER_BYTES = 200 * 1024 * 1024;
export const MAX_TRANSFER_CHUNK_BYTES = 256 * 1024;
export const TRANSFER_TTL_MS = 10 * 60 * 1000;
export type ExtensionFileManifest = {
  manifestId: string;
  itemIds: string[];
  files: { name: string; type: string; size: number }[];
  imageMode: "gallery" | "separate";
  organization: { collectionId?: string | null; collectionName?: string; tagIds?: string[]; tagNames?: string[] };
  metadata?: { title?: string; noteContent?: string; noteFormat?: "plain" | "markdown"; sourceUrl?: string };
};
export type EditorFileAction = { type: "editor-file-action"; editorId: string } & (
  { operation: "begin"; payload: ExtensionFileManifest } |
  { operation: "chunk"; payload: { sessionId: string; fileIndex: number; offset: number; data: string } } |
  { operation: "commit" | "status" | "cancel"; payload: { sessionId: string } } |
  { operation: "open-bulk-import"; payload?: Record<string, never> }
);
export type BulkImportReply = { success: true } | { success: false; error: string };
export type ExtensionFileReply = ({ success: true } & ExtensionTransferStatus) | { success: false; error: string };

export type ExtensionFileResult = { fileIndex: number; fileName: string } & (
  { status: "saved"; itemId: string } | { status: "failed"; error: string } | { status: "cancelled" }
);
export type ExtensionTransferStatus = {
  sessionId: string; stage: "receiving" | "saving" | "complete" | "cancelled";
  receivedBytes: number; totalBytes: number; results: ExtensionFileResult[];
  processing?: "reading" | "preparing-video" | "saving";
  fileIndex?: number;
};
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function captureRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid file action.");
  return value as Record<string, unknown>;
}
function organizationId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 100;
}
function knownKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error("Unknown file manifest field.");
}
function optionalString(value: unknown, limit: number) {
  if (value !== undefined && (typeof value !== "string" || value.length > limit)) throw new Error("Invalid file metadata.");
}
export function validateFileManifest(value: unknown): ExtensionFileManifest {
  const input = captureRecord(value);
  knownKeys(input, ["manifestId", "itemIds", "files", "imageMode", "organization", "metadata"]);
  if (!isUuid(input.manifestId) || !Array.isArray(input.itemIds) || input.itemIds.length > MAX_TRANSFER_FILES || !input.itemIds.every(isUuid) || new Set(input.itemIds).size !== input.itemIds.length) throw new Error("Invalid file IDs.");
  if (input.imageMode !== "gallery" && input.imageMode !== "separate") throw new Error("Choose a file layout.");
  if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > MAX_TRANSFER_FILES || input.itemIds.length !== (input.imageMode === "gallery" ? 1 : input.files.length)) throw new Error("Choose between 1 and 50 files with matching item IDs.");
  let total = 0;
  for (const entry of input.files) {
    const file = captureRecord(entry);
    knownKeys(file, ["name", "type", "size"]);
    if (typeof file.name !== "string" || !file.name.trim() || file.name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(file.name) || typeof file.type !== "string" || file.type.length > 128 || !Number.isSafeInteger(file.size) || (file.size as number) < 0) throw new Error("Invalid file description.");
    const description = file as ExtensionFileManifest["files"][number];
    const { kind, mimeType } = classifyCaptureFile(description);
    if (input.imageMode === "gallery" && kind !== "image") throw new Error("Only images can be saved as a gallery.");
    if (kind === "unsupported") throw new Error("Use an image, MP4, WebM, .txt, .md, or .pdf file.");
    if (kind === "document") documentFormat(description.name, description.size);
    if (kind === "image") assertLocalImageFile({ size: description.size, type: mimeType });
    if (kind === "video") assertLocalVideo({ size: description.size, type: mimeType });
    total += description.size;
  }
  if (total > MAX_TRANSFER_BYTES) throw new Error("Choose 200 MiB or less per transfer.");
  const org = captureRecord(input.organization);
  knownKeys(org, ["collectionId", "collectionName", "tagIds", "tagNames"]);
  if (org.collectionId !== undefined && org.collectionId !== null && !organizationId(org.collectionId)) throw new Error("Invalid collection ID.");
  optionalString(org.collectionName, 120);
  if (org.tagIds !== undefined && (!Array.isArray(org.tagIds) || org.tagIds.length > 100 || !org.tagIds.every(organizationId))) throw new Error("Invalid tag IDs.");
  if (org.tagNames !== undefined && (!Array.isArray(org.tagNames) || org.tagNames.length > 100 || !org.tagNames.every(name => typeof name === "string" && name.trim() && name.length <= 120))) throw new Error("Invalid tag names.");
  if (input.metadata !== undefined) {
    const meta = captureRecord(input.metadata);
    knownKeys(meta, ["title", "noteContent", "noteFormat", "sourceUrl"]);
    optionalString(meta.title, 500); optionalString(meta.noteContent, 10_000); optionalString(meta.sourceUrl, 8192);
    if (meta.noteFormat !== undefined && meta.noteFormat !== "plain" && meta.noteFormat !== "markdown") throw new Error("Invalid note format.");
    if (meta.sourceUrl && !/^https?:\/\//i.test(meta.sourceUrl as string)) throw new Error("Invalid source URL.");
  }
  // Detach the frozen manifest from the caller's mutable draft.
  return JSON.parse(JSON.stringify(input)) as ExtensionFileManifest;
}
