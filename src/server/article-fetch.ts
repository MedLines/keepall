import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { MAX_ARTICLE_TEXT_CHARACTERS, articleContentText, parseSavedArticle, type SavedArticle } from "@/domain/article";
import { extractArticleContent } from "./article-content";
import { parsePreviewCandidateUrl, PreviewUrlBlockedError } from "./preview-ssrf";
import { fetchPublicArticlePage } from "./article-http";

export const MAX_ARTICLE_HTML_BYTES = 2 * 1024 * 1024;
export const ARTICLE_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

export class ArticleCaptureError extends Error {
  constructor(message: string) { super(message); this.name = "ArticleCaptureError"; }
}

function articleHeading(document: Document): string | undefined {
  const editorial = document.querySelector("article h1, main h1");
  const headings = document.querySelectorAll("body h1");
  const heading = editorial ?? (headings.length === 1 ? headings[0] : undefined);
  if (!heading || heading.closest('[hidden], [aria-hidden="true"]')) return;
  const text = heading.textContent?.replace(/\s+/g, " ").trim();
  if (!text || text.length > 500) return;
  const normalized = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return editorial || normalized(document.title).includes(normalized(text)) ? text : undefined;
}

export function extractArticleHtml(html: string, sourceUrl: string, capturedAt = Date.now()): SavedArticle {
  // JSDOM defaults keep script execution and all resource loading disabled.
  const dom = new JSDOM(html, { url: sourceUrl });
  try {
    const document = dom.window.document;
    const headingTitle = articleHeading(document);
    if (document.getElementsByTagName("*").length > 20_000) {
      throw new ArticleCaptureError("No readable article was found. The page may need a login, or its text may load only in a browser.");
    }
    const result = new Readability(document, {
      maxElemsToParse: 20_000, charThreshold: 200,
      serializer: node => extractArticleContent(node, sourceUrl),
    }).parse();
    const content = result?.content ?? [];
    const text = articleContentText(content);
    if (!result || text.length < 200) throw new ArticleCaptureError("No readable article was found. Open the original page or try again later.");
    if (text.length > MAX_ARTICLE_TEXT_CHARACTERS) throw new ArticleCaptureError("This article is too long to save. Save a text document instead.");
    return parseSavedArticle({ title: (headingTitle || result.title?.trim() || new URL(sourceUrl).hostname).slice(0, 500), text, content, sourceUrl, capturedAt,
      ...(result.byline?.trim() ? { author: result.byline.trim().slice(0, 500) } : {}),
      ...(result.siteName?.trim() ? { siteName: result.siteName.trim().slice(0, 500) } : {}),
      ...(result.publishedTime && result.publishedTime.length <= 128 && Number.isFinite(Date.parse(result.publishedTime)) ? { publishedAt: result.publishedTime } : {}) });
  } catch (error) {
    if (error instanceof ArticleCaptureError) throw error;
    throw new ArticleCaptureError("Couldn't extract readable text from this page. Open the original or try again later.");
  } finally { dom.window.close(); }
}

async function readHtml(response: Response): Promise<string> {
  if (!response.body) throw new ArticleCaptureError("The page returned no article text.");
  if (Number(response.headers.get("content-length")) > MAX_ARTICLE_HTML_BYTES) {
    await response.body.cancel();
    throw new ArticleCaptureError("This page is too large to capture.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, html = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return html + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > MAX_ARTICLE_HTML_BYTES) throw new ArticleCaptureError("This page is too large to capture.");
      html += decoder.decode(chunk.value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

async function captureResponse(response: Response, sourceUrl: string): Promise<SavedArticle> {
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || (type && !/text\/html|application\/xhtml\+xml/i.test(type))) {
    await response.body?.cancel();
    throw new ArticleCaptureError(response.ok ? "Save article works with HTML pages. Import this file as a document instead." : "The website couldn't provide this article. It may require a login or be temporarily unavailable.");
  }
  return extractArticleHtml(await readHtml(response), sourceUrl);
}

export async function fetchArticle(rawUrl: string, options?: { fetchImpl?: typeof fetch; assertUrl?: (url: string) => Promise<URL> }): Promise<SavedArticle> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARTICLE_TIMEOUT_MS);
  const fetchImpl = options?.fetchImpl ?? ((url, init) => fetchPublicArticlePage(String(url), init!.signal as AbortSignal));
  let current = rawUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const allowed = options?.assertUrl ? await options.assertUrl(current) : parsePreviewCandidateUrl(current);
      const response = await fetchImpl(allowed.href, { method: "GET", redirect: "manual", cache: "no-store", signal: controller.signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) throw new ArticleCaptureError("The page redirected without a destination.");
        current = new URL(location, allowed).href;
        continue;
      }
      return await captureResponse(response, allowed.href);
    }
    throw new ArticleCaptureError("The website redirected too many times. Open the original page.");
  } catch (error) {
    if (error instanceof ArticleCaptureError || error instanceof PreviewUrlBlockedError) throw error;
    throw new ArticleCaptureError(controller.signal.aborted ? "Article capture timed out. Try again when the website responds." : "Couldn't reach this article. Check your connection and try again.");
  } finally { clearTimeout(timer); }
}
