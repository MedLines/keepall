import {
  formatSkippedBookmarksLog,
  parseBookmarksHtml,
  shouldApplyHtmlCollection,
  type BookmarksHtmlCollectionPolicy,
  type SkippedBookmarkRow,
  BookmarksHtmlParseError,
} from "@/domain/bookmarks-html";
import { itemIsUnsorted } from "@/domain/item";
import { normalizeLinkUrl } from "@/domain/link";
import { createCollection } from "./collections";
import {
  assignCollectionToItem,
  assignTagToItem,
  createOrReuseLink,
} from "./items";
import { createTag } from "./tags";

export type BookmarksHtmlImportSummary = {
  added: number;
  merged: number;
  skipped: number;
  skippedRows: SkippedBookmarkRow[];
};

export { BookmarksHtmlParseError, formatSkippedBookmarksLog };

export async function importBookmarksHtmlMerge(
  html: string,
  options: { collectionPolicy: BookmarksHtmlCollectionPolicy },
): Promise<BookmarksHtmlImportSummary> {
  const rows = parseBookmarksHtml(html);
  const summary: BookmarksHtmlImportSummary = {
    added: 0,
    merged: 0,
    skipped: 0,
    skippedRows: [],
  };

  for (const row of rows) {
    const normalized = normalizeLinkUrl(row.url);
    if (!normalized) {
      summary.skipped += 1;
      summary.skippedRows.push({
        url: row.url,
        title: row.title,
        reason: "Invalid or unsupported URL",
      });
      continue;
    }

    let linkResult: Awaited<ReturnType<typeof createOrReuseLink>>;
    try {
      linkResult = await createOrReuseLink({
        url: row.url,
        title: row.title,
      });
    } catch {
      summary.skipped += 1;
      summary.skippedRows.push({
        url: row.url,
        title: row.title,
        reason: "Could not save link",
      });
      continue;
    }

    const { link, created } = linkResult;
    if (created) {
      summary.added += 1;
    } else {
      summary.merged += 1;
    }

    for (const tagName of row.tagNames) {
      const tag = await createTag({ name: tagName });
      await assignTagToItem(link.id, tag.id);
    }

    const hasFolder = Boolean(row.leafCollectionName?.trim());
    if (
      shouldApplyHtmlCollection(options.collectionPolicy, {
        created,
        itemIsUnsorted: itemIsUnsorted(link),
        hasFolder,
      })
    ) {
      const collection = await createCollection({
        name: row.leafCollectionName!,
      });
      await assignCollectionToItem(link.id, collection.id);
    }
  }

  return summary;
}
