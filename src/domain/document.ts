export const MAX_TEXT_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_DOCUMENT_BYTES = 50 * 1024 * 1024;
export type DocumentFormat = "text" | "markdown" | "pdf";

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
  /** Disposable PDF text cache; backups preserve the original and rebuild this on restore. */
  pdfText?: string;
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
  if (!fileName.includes(".") || (extension !== "txt" && extension !== "md" && extension !== "pdf")) {
    throw new DocumentValidationError("Use a .txt, .md, or .pdf file.");
  }
  const limit = extension === "pdf" ? MAX_PDF_DOCUMENT_BYTES : MAX_TEXT_DOCUMENT_BYTES;
  if (!Number.isSafeInteger(size) || size < 0 || size > limit) {
    throw new DocumentValidationError(extension === "pdf" ? "PDF files must be 50 MiB or smaller." : "Text and Markdown files must be 10 MiB or smaller.");
  }
  return extension === "pdf" ? "pdf" : extension === "md" ? "markdown" : "text";
}

export function assertPdfBytes(bytes: Uint8Array): void {
  const header = new TextDecoder("ascii").decode(bytes.subarray(0, 8));
  const tail = new TextDecoder("ascii").decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  if (bytes.byteLength > MAX_PDF_DOCUMENT_BYTES || !/^%PDF-\d\.\d/.test(header) || !tail.includes("%%EOF")) {
    throw new DocumentValidationError("This file is not a complete PDF. Choose another file or export it again.");
  }
}

export function documentMimeType(format: DocumentFormat): string {
  return format === "pdf" ? "application/pdf" : format === "markdown" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
}

export function documentFormatLabel(format: DocumentFormat): string {
  return format === "pdf" ? "PDF document" : format === "markdown" ? "Markdown note" : "Text note";
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
