// Files an agent saves: what they are, how many items they become, and how they look before they're saved.
// Pure: the bytes live in persistence until the user applies the change.
import { classifyCaptureFile } from "./capture-file";
import { documentFormat, type DocumentFormat } from "./document";
import { SUPPORTED_FILES } from "./agent-file-limits";
import { AgentToolError } from "./agent-tools";
import { MAX_LOCAL_IMAGE_BYTES } from "./image";
import { MAX_LOCAL_VIDEO_BYTES } from "./video";

/** One file waiting to be saved. `fileId` names its bytes in persistence until then. */
export type AgentFile = { fileId: string; name: string; mimeType: string; kind: "image" | "video" | "document"; size: number; format?: DocumentFormat };

/** Assets of an item that isn't saved yet point at the waiting file instead: `pending:<fileId>`. */
export const PENDING_ASSET_PREFIX = "pending:";
export function pendingFileId(assetId: string): string | undefined {
  return assetId.startsWith(PENDING_ASSET_PREFIX) ? assetId.slice(PENDING_ASSET_PREFIX.length) : undefined;
}

export { MAX_CALL_BYTES, MAX_FILES_PER_CALL, SUPPORTED_FILES } from "./agent-file-limits";

/** Checks one file's name, type, and size the same way Add files does, and says what it will become. */
export function describeAgentFile(input: { name: string; type?: string; size: number }): Omit<AgentFile, "fileId"> {
  const name = input.name.trim().replace(/[\\/]/g, "_").slice(0, 255);
  if (!name) throw new AgentToolError("Each file needs a name, such as notes.md.");
  const { kind, mimeType } = classifyCaptureFile({ name, type: input.type ?? "" });
  if (kind === "unsupported") throw new AgentToolError(`Keepall can't save ${name}. It saves ${SUPPORTED_FILES}. Save a web page with save_link instead.`);
  if (kind === "document") {
    try {
      return { name, mimeType, kind, size: input.size, format: documentFormat(name, input.size) };
    } catch (error) {
      throw new AgentToolError(`${name}: ${error instanceof Error ? error.message : "this document can't be saved."}`);
    }
  }
  const limit = kind === "image" ? MAX_LOCAL_IMAGE_BYTES : MAX_LOCAL_VIDEO_BYTES;
  if (input.size > limit) throw new AgentToolError(`${name} is too large. ${kind === "image" ? "Images" : "Videos"} can be up to ${limit / 1024 / 1024} MB.`);
  if (input.size === 0) throw new AgentToolError(`${name} is empty.`);
  return { name, mimeType, kind, size: input.size };
}

/**
 * How a call's files become items: one item per file, or, when the agent asks for a gallery, one image item
 * holding every image. Galleries take images only, as in Add files.
 */
export function fileGroups(files: readonly AgentFile[], gallery: boolean): AgentFile[][] {
  if (!gallery || files.length < 2) return files.map((file) => [file]);
  if (files.some((file) => file.kind !== "image")) throw new AgentToolError("Only images can be saved together as a gallery. Save other files separately.");
  return [[...files]];
}
