import { linkNeedsPreviewRetry, type LinkItem } from "@/domain/link";
import { listItems } from "@/persistence/items";
import { enrichLinkPreview } from "./enrich-link-preview";

let wakeInFlight: Promise<void> | null = null;

/**
 * Scan IndexedDB for links that should get another enrich pass, then run
 * enrich without holding a Dexie transaction across fetch.
 */
export async function wakeLinkPreviewRetries(): Promise<void> {
  if (wakeInFlight) {
    return wakeInFlight;
  }

  wakeInFlight = (async () => {
    const items = await listItems();
    const now = Date.now();
    const links = items.filter(
      (item): item is LinkItem =>
        item.type === "link" && linkNeedsPreviewRetry(item, now),
    );

    for (const link of links) {
      await enrichLinkPreview(link.id, link.url);
    }
  })().finally(() => {
    wakeInFlight = null;
  });

  return wakeInFlight;
}
