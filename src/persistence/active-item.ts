import type { Item } from "@/domain/item";
import { getDb } from "./db";

/** A delayed editor or preview result must not resurrect a deleted item. */
export async function putActiveItem(item: Item): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.items, async () => {
    const current = await db.items.get(item.id);
    if (!current || current.deletedAt !== undefined) throw new Error("Item not found");
    await db.items.put(item);
  });
}
