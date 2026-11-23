// Files agents save. In "suggest" the bytes wait in agentFiles until the user decides; applying saves them through
// the same functions as Add files, so thumbnails, PDF text, and duplicate detection behave the same.
import { describeAgentFile, fileGroups, MAX_CALL_BYTES, MAX_FILES_PER_CALL, type AgentFile } from "@/domain/agent-files";
import { looksLikeMarkdown, type ChangeRequest, type PlannedFileItem, type RecordChange } from "@/domain/agent-changes";
import { AgentToolError } from "@/domain/agent-tools";
import { normalizeCollectionName } from "@/domain/collection";
import { assertPdfBytes, decodeTextDocument } from "@/domain/document";
import { assertLocalImageBytes } from "@/domain/image";
import type { Item } from "@/domain/item";
import { normalizeTagName } from "@/domain/tag";
import { getDb } from "./db";
import { createDocument } from "./documents";
import { createImage } from "./items";
import { createVideo } from "./videos";

/** A waiting file's bytes, keyed by the file ID its request refers to. Device-local and outside backups. */
export type AgentFileRow = { id: string; requestId: string; name: string; mimeType: string; bytes: Uint8Array; createdAt: number };

type VideoPosterMaker = (file: File) => Promise<Blob>;
let makePoster: VideoPosterMaker | undefined;
/** The browser code that grabs a video's first frame, as Add files does. Without it, videos save without a poster. */
export function registerVideoPosterMaker(maker: VideoPosterMaker) {
  makePoster = maker;
}

function decodeBase64(data: string): Uint8Array {
  const fromBase64 = (Uint8Array as unknown as { fromBase64?: (text: string) => Uint8Array }).fromBase64;
  try {
    if (fromBase64) return fromBase64(data);
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new AgentToolError("A file's data isn't valid base64. Update @keepall/mcp, which sends files for you.");
  }
}

function optionalText(value: unknown, field: string, limit: number) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new AgentToolError(`${field} must be text.`);
  const text = value.trim();
  if (text.length > limit) throw new AgentToolError(`${field} is too long. Keep it under ${limit} characters.`);
  return text || undefined;
}

/** Checks the bytes the way the matching create function will, so a bad file fails now rather than at review. */
function checkBytes(file: Omit<AgentFile, "fileId">, bytes: Uint8Array) {
  try {
    if (file.kind === "image") assertLocalImageBytes(bytes, file.mimeType);
    else if (file.format === "pdf") assertPdfBytes(bytes);
    else if (file.kind === "document") decodeTextDocument(bytes);
  } catch (error) {
    throw new AgentToolError(`${file.name}: ${error instanceof Error ? error.message : "this file can't be saved."}`);
  }
}

export type ParsedFiles = { request: Extract<ChangeRequest, { kind: "save_file" }>; payloads: Array<{ fileId: string; bytes: Uint8Array }> };

/**
 * Reads save_file as @keepall/mcp sends it: files as { name, type, data } with base64 data, plus the same
 * optional title, note, format, collection, and tags as save_note. `gallery: true` keeps several images in one item.
 */
export function parseFileArgs(args: Record<string, unknown>, newId: () => string): ParsedFiles {
  const raw = args.files;
  if (!Array.isArray(raw) || !raw.length) throw new AgentToolError("Give at least one file. save_file takes a path or URL; @keepall/mcp reads it and sends the file.");
  if (raw.length > MAX_FILES_PER_CALL) throw new AgentToolError(`Save up to ${MAX_FILES_PER_CALL} files per call.`);
  const files: AgentFile[] = [];
  const payloads: ParsedFiles["payloads"] = [];
  let total = 0;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") throw new AgentToolError("Each file needs a name and data.");
    const { name, type, data } = entry as Record<string, unknown>;
    if (typeof name !== "string" || typeof data !== "string") throw new AgentToolError("Each file needs a name and data.");
    const bytes = decodeBase64(data);
    total += bytes.byteLength;
    if (total > MAX_CALL_BYTES) throw new AgentToolError("These files are too large together. Save them in separate calls.");
    const described = describeAgentFile({ name, type: typeof type === "string" ? type : "", size: bytes.byteLength });
    checkBytes(described, bytes);
    const fileId = newId();
    files.push({ ...described, fileId });
    payloads.push({ fileId, bytes });
  }
  const gallery = args.gallery === true;
  const groups = fileGroups(files, gallery);
  const tags = Array.isArray(args.tags) ? args.tags : typeof args.tags === "string" ? args.tags.split(",") : [];
  const format = optionalText(args.format, "format", 20)?.toLowerCase();
  if (format && !["markdown", "md", "plain", "text", "txt"].includes(format)) throw new AgentToolError('format must be "markdown" or "plain".');
  const collection = optionalText(args.collection, "collection", 120);
  return {
    request: {
      kind: "save_file", files, gallery, itemIds: groups.map(() => newId()),
      title: optionalText(args.title, "title", 500), note: optionalText(args.note ?? args.caption, "note", 20_000),
      format: format ? (["markdown", "md"].includes(format) ? "markdown" : "plain") : undefined,
      collection: collection && !["unsorted", "none", "no collection"].includes(collection.toLowerCase()) ? normalizeCollectionName(collection) : undefined,
      tags: tags.filter((tag): tag is string => typeof tag === "string").map(normalizeTagName).filter(Boolean),
    },
    payloads,
  };
}

/** Keeps the bytes of a request's files until the user decides. Call inside a transaction that includes agentFiles. */
export async function storePendingFiles(requestId: string, request: ParsedFiles["request"], payloads: ParsedFiles["payloads"]) {
  const now = Date.now();
  const byId = new Map(payloads.map((payload) => [payload.fileId, payload.bytes]));
  await getDb().agentFiles.bulkPut(request.files.map((file) => ({
    id: file.fileId, requestId, name: file.name, mimeType: file.mimeType, bytes: byId.get(file.fileId)!, createdAt: now,
  })));
}

/** A waiting file, for showing it in the review. */
export async function getPendingFile(fileId: string): Promise<AgentFileRow | undefined> {
  return getDb().agentFiles.get(fileId);
}

/** Forgets waiting files once they're saved or declined. */
export async function deletePendingFiles(fileIds: readonly string[]) {
  if (fileIds.length) await getDb().agentFiles.bulkDelete([...fileIds]);
}

function noteFormat(note: string | undefined, format: "plain" | "markdown" | undefined) {
  if (!note) return undefined;
  return format ?? (looksLikeMarkdown(note) ? "markdown" : "plain");
}

/**
 * Saves planned file items through Add files' create functions, with the IDs the agent was told and the collection
 * and tags the plan resolved (write the plan's records first, so new ones exist). Saving the same item twice
 * returns the saved one, so a retry is safe. Returns journal records for what it created.
 */
export async function saveFileItems(planned: readonly PlannedFileItem[], bytesFor: (fileId: string) => Promise<Uint8Array | undefined>): Promise<{ records: RecordChange[]; failed: Array<{ name: string; reason: string }> }> {
  const records: RecordChange[] = [];
  const failed: Array<{ name: string; reason: string }> = [];
  for (const entry of planned) {
    const { item, files } = entry;
    const names = files.map((file) => file.name).join(", ");
    try {
      // Saved before, then undone from the review: that copy is in Trash. Saving again replaces it.
      const earlier = await getDb().items.get(item.id);
      if (earlier?.deletedAt !== undefined) await getDb().items.delete(item.id);
      // Already saved, by an earlier attempt that finished: nothing more to do.
      else if (earlier) continue;
      const contents = await Promise.all(files.map(async (file) => {
        const bytes = await bytesFor(file.fileId);
        if (!bytes) throw new Error("The file is no longer waiting in this browser. Ask the agent to save it again.");
        return bytes;
      }));
      const organization = { collectionIds: item.collectionIds, tagIds: item.tagIds };
      const format = noteFormat(entry.note, entry.format);
      let saved: Item;
      if (item.type === "image") {
        saved = await createImage({
          id: item.id, assets: contents.map((bytes, index) => ({ bytes, mimeType: files[index].mimeType })), sourceFileName: files[0].name,
          caption: entry.note, captionFormat: format, title: entry.title, ...organization,
        });
      } else if (item.type === "document") {
        saved = await createDocument({ id: item.id, fileName: files[0].name, bytes: contents[0], title: entry.title, noteContent: entry.note, noteFormat: format, ...organization });
      } else {
        const file = new File([contents[0] as BlobPart], files[0].name, { type: files[0].mimeType });
        const poster = makePoster ? await makePoster(file).catch(() => null) : null;
        saved = await createVideo(file, poster, entry.title, entry.note ? { content: entry.note, format: format ?? "plain" } : undefined, item.collectionIds, { id: item.id, tagIds: item.tagIds });
      }
      records.push({ table: "items", id: saved.id, before: null, after: saved });
    } catch (error) {
      failed.push({ name: names, reason: error instanceof Error ? error.message : "Couldn't save this file." });
    }
  }
  return { records, failed };
}

/** Reads a waiting file's bytes. */
export async function pendingBytes(fileId: string): Promise<Uint8Array | undefined> {
  const row = await getDb().agentFiles.get(fileId);
  return row ? new Uint8Array(row.bytes) : undefined;
}

/** Every waiting file a request refers to. */
export function requestFileIds(request: ChangeRequest): string[] {
  return request.kind === "save_file" ? request.files.map((file) => file.fileId) : [];
}
