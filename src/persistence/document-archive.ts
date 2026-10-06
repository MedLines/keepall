import { hashAssetBytes } from "@/domain/asset";
import { BackupValidationError } from "@/domain/backup";
import { decodeTextDocument, documentFormat, MAX_PDF_DOCUMENT_BYTES, type DocumentAsset, type DocumentItem } from "@/domain/document";
import { readPdfText } from "./pdf-document";

export type ArchiveDocument = Omit<DocumentAsset, "bytes"> & { path: string };

export function parseArchiveDocuments(raw: unknown, supported: boolean): ArchiveDocument[] {
  if (!supported) {
    if (raw !== undefined) throw new BackupValidationError("This archive version does not support documents.");
    return [];
  }
  if (!Array.isArray(raw)) throw new BackupValidationError("Archive documents must be an array.");
  const seen = new Set<string>();
  return raw.map((record) => {
    if (!record || typeof record !== "object" || typeof record.id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(record.id) || seen.has(record.id) || record.path !== `documents/${record.id}.bin` ||
        !Number.isSafeInteger(record.byteLength) || record.byteLength < 0 || record.byteLength > MAX_PDF_DOCUMENT_BYTES ||
        typeof record.contentHash !== "string" || !/^[0-9a-f]{64}$/.test(record.contentHash) ||
        typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt)) {
      throw new BackupValidationError("Archive has invalid document metadata.");
    }
    seen.add(record.id);
    return { id: record.id, path: record.path, byteLength: record.byteLength, contentHash: record.contentHash, createdAt: record.createdAt };
  });
}

export async function readArchiveDocuments(records: ArchiveDocument[], readBytes: (path: string, size: number) => Promise<Uint8Array>, items: readonly DocumentItem[]): Promise<DocumentAsset[]> {
  const pdfIds = new Set(items.filter(item => item.format === "pdf").map(item => item.assetId));
  const textIds = new Set(items.filter(item => item.format !== "pdf").map(item => item.assetId));
  const originals: DocumentAsset[] = [];
  for (const record of records) {
    const bytes = await readBytes(record.path, record.byteLength);
    if (bytes.byteLength !== record.byteLength || await hashAssetBytes(bytes) !== record.contentHash) {
      throw new BackupValidationError("Document original is damaged.");
    }
    let pdfText: string | undefined;
    try {
      if (pdfIds.has(record.id)) pdfText = await readPdfText(bytes);
      if (textIds.has(record.id) || !pdfIds.has(record.id)) {
        documentFormat("original.txt", bytes.byteLength);
        decodeTextDocument(bytes);
      }
    }
    catch (error) { throw new BackupValidationError(error instanceof Error ? error.message : "Document original is invalid."); }
    originals.push({ id: record.id, bytes, byteLength: record.byteLength, contentHash: record.contentHash, createdAt: record.createdAt, ...(pdfText !== undefined ? { pdfText } : {}) });
  }
  return originals;
}
