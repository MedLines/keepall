import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { MAX_ARTICLE_TEXT_CHARACTERS, type SavedArticle } from "@/domain/article";
import { parsePreviewCandidateUrl, PreviewUrlBlockedError } from "./preview-ssrf";
import { fetchPublicArticlePage } from "./article-http";

export const MAX_ARTICLE_HTML_BYTES = 2 * 1024 * 1024;
export const ARTICLE_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

export class ArticleCaptureError extends Error {
  constructor(message: string) { super(message); this.name = "ArticleCaptureError"; }
}

export function extractArticleHtml(html: string, sourceUrl: string, capturedAt = Date.now()): SavedArticle {
  // JSDOM defaults keep script execution and all resource loading disabled.
  const dom = new JSDOM(html, { url: sourceUrl });
  try {
    const document = dom.window.document;
    if (!isProbablyReaderable(document) || document.getElementsByTagName("*").length > 20_000) {
      throw new ArticleCaptureError("No readable article was found. The page may need a login, or its text may load only in a browser.");
    }
    const result = new Readability(document, {
      maxElemsToParse: 20_000, charThreshold: 200,
      serializer: node => {
        const element = node as Element;
        for (const unsafe of element.querySelectorAll("script,style,noscript,iframe,svg,canvas")) unsafe.remove();
        for (const br of element.querySelectorAll("br")) br.replaceWith("\n");
        for (const block of element.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr")) block.append("\n\n");
        return element.textContent ?? "";
      },
    }).parse();
    const text = (result?.content ?? "").split("\n").map(line => line.replace(/[\t\r ]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!result || text.length < 200) throw new ArticleCaptureError("No readable article was found. Open the original page or try again later.");
    if (text.length > MAX_ARTICLE_TEXT_CHARACTERS) throw new ArticleCaptureError("This article is too long to save. Save a text document instead.");
    return { title: (result.title?.trim() || new URL(sourceUrl).hostname).slice(0, 500), text, sourceUrl, capturedAt,
      ...(result.byline?.trim() ? { author: result.byline.trim().slice(0, 500) } : {}) };
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
