import type { CaptureOrgDrafts } from "@/domain/capture-org";
import { createCollection } from "./collections";
import { assignCollectionToItem, assignTagToItem } from "./items";
import { createTag } from "./tags";

/** Second write after capture: tags (many) then one collection. Idempotent assigns. */
export async function applyItemOrg(
  itemId: string,
  org: CaptureOrgDrafts,
): Promise<void> {
  for (const name of org.tagNames) {
    const tag = await createTag({ name });
    await assignTagToItem(itemId, tag.id);
  }

  if (!org.collectionName) {
    return;
  }

  const collection = await createCollection({ name: org.collectionName });
  await assignCollectionToItem(itemId, collection.id);
}
