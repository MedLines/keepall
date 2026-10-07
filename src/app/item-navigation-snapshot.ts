import type { Item } from "@/domain/item";
import type { Tag } from "@/domain/tag";
import type { Collection } from "@/domain/collection";
import type { DocumentItem } from "@/domain/document";
import { getDocumentPreview } from "@/persistence/document-preview";

const documentPreviews = new Map<string, { expiresAt: number; text?: string }>();
const previewKey = (item: DocumentItem) => `${item.assetId}:${item.updatedAt}`;

export function prepareDocumentNavigationPreview(item: DocumentItem): void {
  if (item.format === "pdf") return;
  const key = previewKey(item);
  if ((documentPreviews.get(key)?.expiresAt ?? 0) > Date.now()) return;
  const entry: { expiresAt: number; text?: string } = { expiresAt: Date.now() + 30_000 };
  documentPreviews.set(key, entry);
  while (documentPreviews.size > 32) documentPreviews.delete(documentPreviews.keys().next().value!);
  void getDocumentPreview(item.assetId).then(text => {
    if (text !== null) entry.text = text;
  }).catch(() => { if (documentPreviews.get(key) === entry) documentPreviews.delete(key); });
}

export type ItemNavigationSnapshot = {
  item: Item;
  tags: Tag[];
  collections: Collection[];
  animate: boolean;
  fromPreview?: boolean;
  previewImageAssetId?: string;
  documentPreview?: { text?: string; pdfImage?: string };
};

let handoff: { snapshot: ItemNavigationSnapshot; expiresAt: number } | null = null;

export function prepareItemNavigation(snapshot: ItemNavigationSnapshot): void {
  if (snapshot.fromPreview && snapshot.item.type === "image" && typeof document !== "undefined") {
    const assetId = document.querySelector(".library-quick-preview img[data-preview-image-asset]")?.getAttribute("data-preview-image-asset");
    if (assetId && snapshot.item.assetIds.includes(assetId)) snapshot = { ...snapshot, previewImageAssetId: assetId };
  }
  if (snapshot.item.type === "document" && typeof document !== "undefined") {
    const card = Array.from(document.querySelectorAll<HTMLElement>("[data-item-id]")).find(node => node.dataset.itemId === snapshot.item.id);
    const prepared = documentPreviews.get(previewKey(snapshot.item));
    const text = card?.querySelector("[data-document-preview]")?.getAttribute("data-document-preview")
      ?? (prepared && prepared.expiresAt > Date.now() ? prepared.text : undefined);
    const pdfImage = card?.querySelector<HTMLImageElement>("[data-pdf-preview] img")?.src;
    snapshot = { ...snapshot, documentPreview: { text, pdfImage } };
  }
  handoff = { snapshot, expiresAt: Date.now() + 30_000 };
}

export function readItemNavigation(itemId: string): ItemNavigationSnapshot | undefined {
  if (typeof window === "undefined" || !handoff || handoff.expiresAt <= Date.now() || handoff.snapshot.item.id !== itemId) return undefined;
  return handoff.snapshot;
}
