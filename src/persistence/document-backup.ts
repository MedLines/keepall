import { isIncomingNewer, unionIds } from "@/domain/backup-merge";
import type { DocumentAsset, DocumentItem } from "@/domain/document";
import type { KeepallMergeSummary } from "./backup";
import { getDb } from "./db";
import { deleteUnreferencedDocuments } from "./documents";

async function restoreOriginal(source: DocumentAsset): Promise<string> {
  const db = getDb();
  const existing = await db.documentAssets.where("contentHash").equals(source.contentHash).first();
  if (existing) return existing.id;
  const original = { ...source, id: crypto.randomUUID() };
  await db.documentAssets.add(original);
  return original.id;
}

function recordMerge(local: DocumentItem | undefined, next: DocumentItem, summary: KeepallMergeSummary) {
  if (!local) summary.added += 1;
  else if (JSON.stringify(local) === JSON.stringify(next)) summary.unchanged += 1;
  else summary.updated += 1;
}

export async function mergeDocumentBackup(
  payload: { items: DocumentItem[]; assets: DocumentAsset[] },
  remapTags: (ids: string[]) => string[],
  remapCollections: (ids: string[]) => string[],
  itemIdMap: Map<string, string>,
  summary: KeepallMergeSummary,
  onItemProcessed?: () => void,
) {
  const db = getDb();
  const originals = new Map(payload.assets.map((asset) => [asset.id, asset]));
  // One transaction for all document originals and records; a failed save leaves no dangling references.
  await db.transaction("rw", db.items, db.documentAssets, async () => {
    const replacedOriginals = new Set<string>();
    for (const incoming of payload.items) {
      const source = originals.get(incoming.assetId);
      if (!source) throw new Error("Document original is missing from the archive.");
      const existing = await db.items.get(incoming.id);
      const local = existing?.type === "document" ? existing : undefined;
      const useIncoming = !local || isIncomingNewer(local.updatedAt, incoming.updatedAt);
      const assetId = useIncoming ? await restoreOriginal(source) : local!.assetId;
      const id = local?.id ?? (existing ? crypto.randomUUID() : incoming.id);
      const next: DocumentItem = {
        ...(useIncoming ? incoming : local!), id, assetId,
        tagIds: unionIds(local?.tagIds ?? [], remapTags(incoming.tagIds)),
        collectionIds: useIncoming ? remapCollections(incoming.collectionIds) : local!.collectionIds,
      };
      await db.items.put(next);
      if (local && local.assetId !== next.assetId) replacedOriginals.add(local.assetId);
      itemIdMap.set(incoming.id, id);
      recordMerge(local, next, summary);
      onItemProcessed?.();
    }
    await deleteUnreferencedDocuments([...replacedOriginals]);
  });
}
