import { ArticleValidationError, articleAssetIds, mapArticleImages, parseCapturedArticle, parseSavedArticle } from "@/domain/article";
import { buildAsset, hashAssetBytes } from "@/domain/asset";
import { base64ToBytes } from "@/domain/backup-encoding";
import { assertLocalImageBytes } from "@/domain/image";
import type { LinkItem } from "@/domain/link";
import { normalizeItem } from "@/domain/item";
import { getDb } from "./db";
import { deleteUnreferencedAssets } from "./items";

/** Capture completes against the latest row, preserving concurrent notes and organization. */
export async function saveLinkArticle(id: string, expectedUrl: string, raw: unknown): Promise<LinkItem> {
  const { images = [], ...article } = parseCapturedArticle(raw);
  const prepared = await Promise.all(images.map(async image => {
    const bytes = base64ToBytes(image.dataBase64);
    assertLocalImageBytes(bytes, image.mimeType);
    return { sourceUrl: image.sourceUrl, asset: buildAsset({ bytes, mimeType: image.mimeType, contentHash: await hashAssetBytes(bytes) }) };
  }));
  const db = getDb();
  return db.transaction("rw", db.items, db.assets, db.thumbnails, async () => {
    const item = await db.items.get(id);
    if (item?.type !== "link" || item.deletedAt !== undefined) throw new ArticleValidationError("This link is no longer available.");
    if (item.url !== expectedUrl) throw new ArticleValidationError("The link changed while its article was saving. Reopen it and try again.");
    const assets = new Map<string, string>();
    for (const { sourceUrl, asset } of prepared) {
      const existing = await db.assets.where("contentHash").equals(asset.contentHash).first();
      if (!existing) await db.assets.put(asset);
      assets.set(sourceUrl, existing?.id ?? asset.id);
    }
    const stored = parseSavedArticle({ ...article, content: mapArticleImages(article.content, image => ({ ...image, assetId: image.src ? assets.get(image.src) : undefined })) });
    const next = { ...normalizeItem(item), article: stored, updatedAt: Math.max(Date.now(), item.updatedAt + 1) };
    await db.items.put(next);
    await deleteUnreferencedAssets(articleAssetIds(item.article));
    return next;
  });
}
