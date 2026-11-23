// What files agents can save, by extension, with the size limits Add files uses. No imports, so @keepall/mcp can
// check a file before sending it. The browser checks again with the app's own rules (see agent-files.ts).
const MIB = 1024 * 1024;

export type AgentFileType = { kind: "image" | "video" | "document"; mime: string; maxBytes: number };

export const AGENT_FILE_TYPES: Record<string, AgentFileType> = {
  png: { kind: "image", mime: "image/png", maxBytes: 20 * MIB },
  jpg: { kind: "image", mime: "image/jpeg", maxBytes: 20 * MIB },
  jpeg: { kind: "image", mime: "image/jpeg", maxBytes: 20 * MIB },
  gif: { kind: "image", mime: "image/gif", maxBytes: 20 * MIB },
  webp: { kind: "image", mime: "image/webp", maxBytes: 20 * MIB },
  avif: { kind: "image", mime: "image/avif", maxBytes: 20 * MIB },
  mp4: { kind: "video", mime: "video/mp4", maxBytes: 100 * MIB },
  webm: { kind: "video", mime: "video/webm", maxBytes: 100 * MIB },
  pdf: { kind: "document", mime: "application/pdf", maxBytes: 50 * MIB },
  md: { kind: "document", mime: "text/markdown", maxBytes: 10 * MIB },
  txt: { kind: "document", mime: "text/plain", maxBytes: 10 * MIB },
};

export const MAX_FILES_PER_CALL = 20;
/** One call's files together; the relay carries up to about 160 MB of request. */
export const MAX_CALL_BYTES = 110 * MIB;
export const SUPPORTED_FILES = "images (PNG, JPEG, GIF, WebP, AVIF) up to 20 MB, MP4 or WebM videos up to 100 MB, PDFs up to 50 MB, and .md or .txt files up to 10 MB";

/** The extension a file of this media type gets when it has none, for files downloaded without one. */
export function extensionForMime(mime: string): string | undefined {
  const type = mime.split(";")[0].trim().toLowerCase();
  if (type === "text/x-markdown") return "md";
  return Object.entries(AGENT_FILE_TYPES).find(([extension, entry]) => entry.mime === type && extension !== "jpeg")?.[0];
}

/** A quick check before sending: a supported type within its size limit. Returns what's wrong, in words, or null. */
export function agentFileProblem(name: string, size: number): string | null {
  const extension = name.includes(".") ? name.split(".").at(-1)!.toLowerCase() : "";
  const type = AGENT_FILE_TYPES[extension];
  if (!type) return `Keepall can't save ${name}. It saves ${SUPPORTED_FILES}. Save a web page with save_link instead.`;
  if (size === 0) return `${name} is empty.`;
  if (size > type.maxBytes) return `${name} is too large. Keepall saves ${SUPPORTED_FILES}.`;
  return null;
}
