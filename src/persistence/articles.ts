import { ArticleValidationError, parseSavedArticle } from "@/domain/article";
import type { LinkItem } from "@/domain/link";
import { normalizeItem } from "@/domain/item";
import { getDb } from "./db";

/** Capture completes against the latest row, preserving concurrent notes and organization. */
export async function saveLinkArticle(id: string, expectedUrl: string, raw: unknown): Promise<LinkItem> {
  const article = parseSavedArticle(raw);
  const db = getDb();
  return db.transaction("rw", db.items, async () => {
    const item = await db.items.get(id);
    if (item?.type !== "link" || item.deletedAt !== undefined) throw new ArticleValidationError("This link is no longer available.");
    if (item.url !== expectedUrl) throw new ArticleValidationError("The link changed while its article was saving. Reopen it and try again.");
    const next = { ...normalizeItem(item), article, updatedAt: Date.now() };
    await db.items.put(next);
    return next;
  });
}
