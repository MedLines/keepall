import { hashAssetBytes } from "@/domain/asset";
import { BackupValidationError } from "@/domain/backup";
import { decodeTextDocument, MAX_TEXT_DOCUMENT_BYTES, type DocumentAsset } from "@/domain/document";

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
        !Number.isSafeInteger(record.byteLength) || record.byteLength < 0 || record.byteLength > MAX_TEXT_DOCUMENT_BYTES ||
        typeof record.contentHash !== "string" || !/^[0-9a-f]{64}$/.test(record.contentHash) ||
        typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt)) {
      throw new BackupValidationError("Archive has invalid document metadata.");
    }
    seen.add(record.id);
    return { id: record.id, path: record.path, byteLength: record.byteLength, contentHash: record.contentHash, createdAt: record.createdAt };
  });
}

export async function readArchiveDocuments(records: ArchiveDocument[], readBytes: (path: string, size: number) => Promise<Uint8Array>): Promise<DocumentAsset[]> {
  const originals: DocumentAsset[] = [];
  for (const record of records) {
    const bytes = await readBytes(record.path, record.byteLength);
    if (bytes.byteLength !== record.byteLength || await hashAssetBytes(bytes) !== record.contentHash) {
      throw new BackupValidationError("Document original is damaged.");
    }
    try { decodeTextDocument(bytes); }
    catch (error) { throw new BackupValidationError(error instanceof Error ? error.message : "Document original is invalid."); }
    originals.push({ id: record.id, bytes, byteLength: record.byteLength, contentHash: record.contentHash, createdAt: record.createdAt });
  }
  return originals;
}
