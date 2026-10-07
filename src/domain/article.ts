export const MAX_ARTICLE_TEXT_CHARACTERS = 500_000;
export const MAX_ARTICLE_CONTENT_NODES = 10_000;
export const MAX_ARTICLE_CONTENT_DEPTH = 24;
export const ARTICLE_TAGS = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "strong", "em", "a", "br", "hr", "section", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "sup", "sub", "s"] as const;
export type ArticleTag = typeof ARTICLE_TAGS[number];
export type ArticleNode = { text: string } | { tag: ArticleTag; children: ArticleNode[]; href?: string; start?: number };
export type SavedArticle = {
  title: string;
  text: string;
  sourceUrl: string;
  capturedAt: number;
  author?: string;
  siteName?: string;
  publishedAt?: string;
  content?: ArticleNode[];
};

export class ArticleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleValidationError";
  }
}

function boundedText(value: unknown, limit: number, required = true): value is string {
  return typeof value === "string" && value.length <= limit && (!required || Boolean(value.trim()));
}

export function safeArticleHref(raw: string, base?: string): string | undefined {
  if (raw.length > 8192) return;
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return;
    return url.href;
  } catch { return; }
}

function articleNodeAttributes(node: Record<string, unknown>, tag: ArticleTag): { href?: string; start?: number } {
  const attributes: { href?: string; start?: number } = {};
  if (node.href !== undefined) {
    if (tag !== "a" || typeof node.href !== "string" || !safeArticleHref(node.href)) throw new ArticleValidationError("Saved article link is invalid.");
    attributes.href = safeArticleHref(node.href);
  }
  if (node.start !== undefined) {
    if (tag !== "ol" || typeof node.start !== "number" || !Number.isSafeInteger(node.start) || Math.abs(node.start) > 1_000_000) throw new ArticleValidationError("Saved article list is invalid.");
    attributes.start = node.start;
  }
  return attributes;
}

/** Rebuild only allowed fields. No DOM attributes or raw HTML cross this boundary. */
export function parseArticleContent(raw: unknown): ArticleNode[] {
  let count = 0;
  let characters = 0;
  function nodes(value: unknown, depth: number): ArticleNode[] {
    if (!Array.isArray(value) || depth > MAX_ARTICLE_CONTENT_DEPTH || value.length > MAX_ARTICLE_CONTENT_NODES) {
      throw new ArticleValidationError("Saved article structure is invalid or too large.");
    }
    return value.map(rawNode => {
      if (++count > MAX_ARTICLE_CONTENT_NODES || !rawNode || typeof rawNode !== "object" || Array.isArray(rawNode)) {
        throw new ArticleValidationError("Saved article structure is invalid or too large.");
      }
      const node = rawNode as Record<string, unknown>;
      if (typeof node.text === "string" && node.tag === undefined) {
        characters += node.text.length;
        if (characters > MAX_ARTICLE_TEXT_CHARACTERS) throw new ArticleValidationError("Saved article structure is too large.");
        return { text: node.text };
      }
      if (!ARTICLE_TAGS.includes(node.tag as ArticleTag)) throw new ArticleValidationError("Saved article element is not supported.");
      const tag = node.tag as ArticleTag;
      const children = nodes(node.children, depth + 1);
      if ((tag === "br" || tag === "hr") && children.length) throw new ArticleValidationError("Saved article element is invalid.");
      const attributes = articleNodeAttributes(node, tag);
      characters += attributes.href?.length ?? 0;
      if (characters > MAX_ARTICLE_TEXT_CHARACTERS) throw new ArticleValidationError("Saved article structure is too large.");
      return { tag, children, ...attributes };
    });
  }
  return nodes(raw, 0);
}

function articleMetadata(article: Record<string, unknown>): Pick<SavedArticle, "author" | "siteName" | "publishedAt"> {
  const metadata: Pick<SavedArticle, "author" | "siteName" | "publishedAt"> = {};
  for (const field of ["author", "siteName"] as const) {
    const value = article[field];
    if (value === undefined) continue;
    if (!boundedText(value, 500, false)) throw new ArticleValidationError("Saved article metadata is invalid.");
    if (value.trim()) metadata[field] = value.trim();
  }
  if (article.publishedAt !== undefined) {
    if (!boundedText(article.publishedAt, 128) || !Number.isFinite(Date.parse(article.publishedAt))) throw new ArticleValidationError("Saved article publication date is invalid.");
    metadata.publishedAt = article.publishedAt;
  }
  return metadata;
}

function isValidCaptureTime(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && Number.isFinite(new Date(value).getTime());
}

const BLOCK_TAGS = new Set<ArticleTag>(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "section", "table", "tr", "caption"]);
export function articleContentText(content: ArticleNode[]): string {
  function text(node: ArticleNode): string {
    if ("text" in node) return node.text;
    if (node.tag === "br" || node.tag === "hr") return "\n";
    const value = node.children.map(text).join("");
    return BLOCK_TAGS.has(node.tag) ? `\n\n${value}\n\n` : node.tag === "td" || node.tag === "th" ? `${value}\t` : value;
  }
  return content.map(text).join("").replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Accept bounded semantic content and safe metadata, including legacy text-only restores. */
export function parseSavedArticle(raw: unknown): SavedArticle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ArticleValidationError("Saved article must be an object.");
  const article = raw as Record<string, unknown>;
  const sourceUrl = typeof article.sourceUrl === "string" ? safeArticleHref(article.sourceUrl) : undefined;
  if (!boundedText(article.title, 500) || !boundedText(article.text, MAX_ARTICLE_TEXT_CHARACTERS) || !sourceUrl || !isValidCaptureTime(article.capturedAt)) {
    throw new ArticleValidationError("Saved article content or metadata is invalid.");
  }
  const content = article.content === undefined ? undefined : parseArticleContent(article.content);
  const text = content ? articleContentText(content) : article.text.trim();
  if (!boundedText(text, MAX_ARTICLE_TEXT_CHARACTERS)) throw new ArticleValidationError("Saved article text is invalid.");
  return { title: article.title.trim(), text, sourceUrl, capturedAt: article.capturedAt,
    ...articleMetadata(article),
    ...(content ? { content } : {}) };
}
