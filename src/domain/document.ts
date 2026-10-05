export const MAX_TEXT_DOCUMENT_BYTES = 10 * 1024 * 1024;
export type DocumentFormat = "text" | "markdown";

export type DocumentItem = {
  id: string;
  type: "document";
  format: DocumentFormat;
  title: string;
  sourceFileName: string;
  assetId: string;
  noteContent: string;
  noteFormat?: "markdown";
  tagIds: string[];
  collectionIds: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type DocumentAsset = {
  id: string;
  bytes: Uint8Array;
  byteLength: number;
  contentHash: string;
  createdAt: number;
};

export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentValidationError";
  }
}

export function documentFormat(fileName: string, size: number): DocumentFormat {
  if (!fileName.trim() || /[\/\\\u0000-\u001f\u007f]/.test(fileName)) {
    throw new DocumentValidationError("Use a valid document filename.");
  }
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (!fileName.includes(".") || (extension !== "txt" && extension !== "md")) {
    throw new DocumentValidationError("Use a .txt or .md file.");
  }
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_TEXT_DOCUMENT_BYTES) {
    throw new DocumentValidationError("Text and Markdown files must be 10 MiB or smaller.");
  }
  return extension === "md" ? "markdown" : "text";
}

/** Decoding changes only displayed text; the stored original retains its BOM and line endings. */
export function decodeTextDocument(bytes: Uint8Array): string {
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new DocumentValidationError("Use a UTF-8 text file. This file has an unsupported encoding."); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new DocumentValidationError("This file contains binary data instead of text.");
  }
  return text;
}
