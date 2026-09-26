import { normalizeItem, type Item } from "@/domain/item";
import { getDb } from "./db";
import { deleteItem } from "./items";

const receipts = new Map<string, { itemId: string; fingerprint: string; expiresAt: number; undone: boolean }>();

function fingerprint(item: Item): string {
  const common = [item.id, item.type, item.createdAt, item.title, item.collectionIds, item.tagIds];
  // Automatic preview updates must not invalidate a user's chance to undo.
  if (item.type === "link") return JSON.stringify([...common, item.url, item.noteContent ?? "", item.noteFormat ?? "plain"]);
  if (item.type === "image") return JSON.stringify([...common, item.assetIds, item.sourceUrl, item.caption, item.captionFormat ?? "plain", item.sourceFileName]);
  throw new Error("Unsupported capture type");
}

export function createCaptureUndo(item: Item): string {
  for (const [token, receipt] of receipts) {
    if (receipt.expiresAt <= Date.now()) receipts.delete(token);
  }
  const token = crypto.randomUUID();
  receipts.set(token, { itemId: item.id, fingerprint: fingerprint(item), expiresAt: Date.now() + 60_000, undone: false });
  return token;
}

export async function undoExtensionCapture(token: string): Promise<string> {
  const receipt = receipts.get(token);
  if (!receipt || receipt.expiresAt <= Date.now()) {
    receipts.delete(token);
    throw new Error("Undo has expired. You can remove this item in Keepall.");
  }
  if (receipt.undone) return receipt.itemId;
  const db = getDb();
  await db.transaction("rw", [db.items, db.assets, db.thumbnails, db.videoAssets, db.collections], async () => {
    const current = await db.items.get(receipt.itemId);
    if (!current) return;
    const pinned = await db.collections.filter((collection) => collection.pinnedItemIds?.includes(receipt.itemId)).count();
    if (fingerprint(normalizeItem(current)) !== receipt.fingerprint || pinned) {
      throw new Error("This item changed after saving. Open it in Keepall to remove it.");
    }
    await deleteItem(receipt.itemId);
  });
  receipt.undone = true;
  return receipt.itemId;
}
