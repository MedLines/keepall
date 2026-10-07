import { isHttpUrl } from "./classify";

export const MAX_ARTICLE_TEXT_CHARACTERS = 500_000;
export type SavedArticle = {
  title: string;
  text: string;
  sourceUrl: string;
  capturedAt: number;
  author?: string;
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

/** Accept only bounded plain text and safe source metadata, including on restore. */
export function parseSavedArticle(raw: unknown): SavedArticle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ArticleValidationError("Saved article must be an object.");
  const article = raw as Record<string, unknown>;
  if (!boundedText(article.title, 500) || !boundedText(article.text, MAX_ARTICLE_TEXT_CHARACTERS) ||
      !boundedText(article.sourceUrl, 8192) || !isHttpUrl(article.sourceUrl) ||
      typeof article.capturedAt !== "number" || !Number.isFinite(article.capturedAt) || article.capturedAt < 0 ||
      (article.author !== undefined && !boundedText(article.author, 500, false))) {
    throw new ArticleValidationError("Saved article content or metadata is invalid.");
  }
  const source = new URL(article.sourceUrl);
  if (source.username || source.password) throw new ArticleValidationError("Saved article source must not contain credentials.");
  return { title: article.title.trim(), text: article.text.trim(), sourceUrl: source.href, capturedAt: article.capturedAt,
    ...(typeof article.author === "string" && article.author.trim() ? { author: article.author.trim() } : {}) };
}
