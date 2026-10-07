export const MAX_ARTICLE_TEXT_CHARACTERS = 500_000;
export const MAX_ARTICLE_CONTENT_NODES = 10_000;
export const MAX_ARTICLE_CONTENT_DEPTH = 24;
export const MAX_ARTICLE_IMAGES = 16;
export const MAX_ARTICLE_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_ARTICLE_IMAGES_BYTES = 8 * 1024 * 1024;
export const ARTICLE_TAGS = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "strong", "em", "a", "br", "hr", "section", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "sup", "sub", "s", "img", "figure", "figcaption"] as const;
export type ArticleTag = typeof ARTICLE_TAGS[number];
export type ArticleElement = { tag: ArticleTag; children: ArticleNode[]; href?: string; start?: number; src?: string; alt?: string; assetId?: string };
export type ArticleNode = { text: string } | ArticleElement;
export type CapturedArticleImage = { sourceUrl: string; mimeType: "image/webp"; dataBase64: string };
export type CapturedArticle = SavedArticle & { images?: CapturedArticleImage[] };
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

function articleNodeAttributes(node: Record<string, unknown>, tag: ArticleTag): Omit<ArticleElement, "tag" | "children"> {
  const attributes: Omit<ArticleElement, "tag" | "children"> = {};
  if (node.href !== undefined) {
    if (tag !== "a" || typeof node.href !== "string" || !safeArticleHref(node.href)) throw new ArticleValidationError("Saved article link is invalid.");
    attributes.href = safeArticleHref(node.href);
  }
  if (node.start !== undefined) {
    if (tag !== "ol" || typeof node.start !== "number" || !Number.isSafeInteger(node.start) || Math.abs(node.start) > 1_000_000) throw new ArticleValidationError("Saved article list is invalid.");
    attributes.start = node.start;
  }
  for (const field of ["src", "alt", "assetId"] as const) {
    if (node[field] === undefined) continue;
    const value = node[field];
    if (tag !== "img" || !boundedText(value, field === "src" ? 8192 : field === "alt" ? 2000 : 128, field !== "alt")) throw new ArticleValidationError("Saved article image is invalid.");
    if (field === "src") {
      const source = safeArticleHref(value);
      if (!source) throw new ArticleValidationError("Saved article image source is invalid.");
      attributes.src = source;
    } else attributes[field] = value;
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
      if ((tag === "br" || tag === "hr" || tag === "img") && children.length) throw new ArticleValidationError("Saved article element is invalid.");
      const attributes = articleNodeAttributes(node, tag);
      characters += (attributes.href?.length ?? 0) + (attributes.src?.length ?? 0) + (attributes.alt?.length ?? 0) + (attributes.assetId?.length ?? 0);
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
    if (node.tag === "img") return node.alt ?? "";
    if (node.tag === "br" || node.tag === "hr") return "\n";
    const value = node.children.map(text).join("");
    return BLOCK_TAGS.has(node.tag) ? `\n\n${value}\n\n` : node.tag === "td" || node.tag === "th" ? `${value}\t` : value;
  }
  return content.map(text).join("").replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function articleImages(content: ArticleNode[] = []): ArticleElement[] {
  return content.flatMap(node => "text" in node ? [] : node.tag === "img" ? [node] : articleImages(node.children));
}

export function articleAssetIds(article?: SavedArticle): string[] {
  return articleImages(article?.content).flatMap(node => node.assetId ? [node.assetId] : []);
}

export function mapArticleImages(content: ArticleNode[] | undefined, transform: (image: ArticleElement) => ArticleElement): ArticleNode[] | undefined {
  return content?.map(node => "text" in node ? node : node.tag === "img" ? transform(node) : { ...node, children: mapArticleImages(node.children, transform)! });
}

/** Transport bytes are bounded separately; persisted articles reference local assets. */
export function parseCapturedArticle(raw: unknown): CapturedArticle {
  const article = parseSavedArticle(raw);
  const images = (raw as Record<string, unknown>).images;
  if (images === undefined) return article;
  if (!Array.isArray(images) || images.length > MAX_ARTICLE_IMAGES) throw new ArticleValidationError("Too many article images.");
  const sources = new Set(articleImages(article.content).flatMap(image => image.src ? [image.src] : []));
  const received = new Set<string>();
  let bytes = 0;
  const parsed = images.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ArticleValidationError("Article image data is invalid.");
    const image = value as Record<string, unknown>;
    const sourceUrl = typeof image.sourceUrl === "string" ? safeArticleHref(image.sourceUrl) : undefined;
    if (!sourceUrl || !sources.has(sourceUrl) || received.has(sourceUrl) || image.mimeType !== "image/webp" || !boundedText(image.dataBase64, Math.ceil(MAX_ARTICLE_IMAGE_BYTES / 3) * 4) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.dataBase64)) throw new ArticleValidationError("Article image data is invalid.");
    const size = image.dataBase64.length / 4 * 3 - (image.dataBase64.endsWith("==") ? 2 : image.dataBase64.endsWith("=") ? 1 : 0);
    bytes += size;
    if (size > MAX_ARTICLE_IMAGE_BYTES || bytes > MAX_ARTICLE_IMAGES_BYTES) throw new ArticleValidationError("Article images exceed storage limits.");
    received.add(sourceUrl);
    return { sourceUrl, mimeType: "image/webp" as const, dataBase64: image.dataBase64 };
  });
  return { ...article, images: parsed };
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
