/** One bookmark row extracted from a Netscape HTML export. */
export type ParsedBookmarkRow = {
  url: string;
  title: string;
  tagNames: string[];
  /** Innermost folder name, or null when unfiled in the export. */
  leafCollectionName: string | null;
};

export type BookmarksHtmlCollectionPolicy = "keep" | "apply" | "unsorted-only";

export class BookmarksHtmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookmarksHtmlParseError";
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "").trim());
}

function parseTagsAttribute(attrs: string): string[] {
  const match = attrs.match(/\bTAGS="([^"]*)"/i);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseHref(attrs: string): string | null {
  const match = attrs.match(/\bHREF="([^"]*)"/i);
  return match?.[1]?.trim() ?? null;
}

function skipDlWrapper(html: string, start: number): number {
  const match = html.slice(start).match(/^[\s\n\r]*<DL[^>]*>[\s\n\r]*(?:<p>)?/i);
  return match ? start + match[0].length : start;
}

function skipAfterInnerDl(html: string, start: number): number {
  const match = html
    .slice(start)
    .match(/^[\s\n\r]*(?:<p>)?[\s\n\r]*<\/DL>[\s\n\r]*(?:<p>)?/i);
  return match ? start + match[0].length : start;
}

function findNextDtOrDlClose(
  html: string,
  start: number,
): { kind: "dt"; index: number } | { kind: "dl_close"; index: number } | null {
  const slice = html.slice(start);
  const dlClose = slice.search(/<\/DL>/i);
  const dt = slice.search(/<DT[\s>]/i);
  if (dt === -1 && dlClose === -1) {
    return null;
  }
  if (dlClose !== -1 && (dt === -1 || dlClose < dt)) {
    return { kind: "dl_close", index: start + dlClose };
  }
  return { kind: "dt", index: start + dt };
}

function parseDl(
  html: string,
  start: number,
  folderStack: string[],
  rows: ParsedBookmarkRow[],
): number {
  let i = skipDlWrapper(html, start);

  while (i < html.length) {
    const next = findNextDtOrDlClose(html, i);
    if (!next) {
      return html.length;
    }
    if (next.kind === "dl_close") {
      const closeMatch = html.slice(next.index).match(/^<\/DL>/i);
      return next.index + (closeMatch?.[0].length ?? 0);
    }

    i = next.index;
    const dtTag = html.slice(i).match(/^<DT[\s>]/i);
    if (!dtTag) {
      return html.length;
    }
    const afterDt = html.slice(i + dtTag[0].length);

    const folderMatch = afterDt.match(
      /^[\s\n\r]*<H3[^>]*>([\s\S]*?)<\/H3>[\s\n\r]*<DL[^>]*>/i,
    );
    if (folderMatch) {
      const folderName = stripTags(folderMatch[1]);
      if (folderName) {
        folderStack.push(folderName);
      }
      const innerStart = i + dtTag[0].length + folderMatch[0].length;
      i = parseDl(html, innerStart, folderStack, rows);
      if (folderName) {
        folderStack.pop();
      }
      i = skipAfterInnerDl(html, i);
      continue;
    }

    const linkMatch = afterDt.match(
      /^[\s\n\r]*<A\s+([^>]*?)>([\s\S]*?)<\/A>/i,
    );
    if (linkMatch) {
      const url = parseHref(linkMatch[1]);
      if (url) {
        rows.push({
          url,
          title: stripTags(linkMatch[2]),
          tagNames: parseTagsAttribute(linkMatch[1]),
          leafCollectionName:
            folderStack.length > 0
              ? folderStack[folderStack.length - 1]!
              : null,
        });
      }
      i += dtTag[0].length + linkMatch[0].length;
      continue;
    }

    i += dtTag[0].length;
  }

  return i;
}

/** Parse Chrome/Firefox/Safari Netscape-format bookmarks HTML (pure). */
export function parseBookmarksHtml(html: string): ParsedBookmarkRow[] {
  const trimmed = html.trim();
  if (!trimmed) {
    throw new BookmarksHtmlParseError("Bookmarks file is empty");
  }
  if (!/<DL[\s>]/i.test(trimmed)) {
    throw new BookmarksHtmlParseError(
      "Not a Netscape bookmarks file (missing DL)",
    );
  }

  const rows: ParsedBookmarkRow[] = [];
  const folderStack: string[] = [];
  const firstDl = trimmed.search(/<DL[\s>]/i);
  parseDl(trimmed, firstDl, folderStack, rows);
  return rows;
}

/** Whether to file an existing link from the HTML folder on merge. */
export function shouldApplyHtmlCollection(
  policy: BookmarksHtmlCollectionPolicy,
  options: {
    created: boolean;
    itemIsUnsorted: boolean;
    hasFolder: boolean;
  },
): boolean {
  if (!options.hasFolder) {
    return false;
  }
  if (options.created) {
    return true;
  }
  switch (policy) {
    case "keep":
      return false;
    case "apply":
      return true;
    case "unsorted-only":
      return options.itemIsUnsorted;
  }
}

export type SkippedBookmarkRow = {
  url: string;
  title: string;
  reason: string;
};

export function formatSkippedBookmarksLog(rows: SkippedBookmarkRow[]): string {
  const lines = [`Skipped bookmarks (${rows.length})`, ""];
  for (const row of rows) {
    lines.push(`${row.url || "(no url)"}`);
    if (row.title) {
      lines.push(`  Title: ${row.title}`);
    }
    lines.push(`  Reason: ${row.reason}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
