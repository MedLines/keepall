import { ARTICLE_TAGS, MAX_ARTICLE_CONTENT_DEPTH, MAX_ARTICLE_CONTENT_NODES, articleContentText, parseArticleContent, safeArticleHref, type ArticleNode, type ArticleTag } from "@/domain/article";

const OMIT_TAGS = new Set(["script", "style", "noscript", "iframe", "svg", "canvas", "object", "embed", "template", "form", "input", "button", "select", "textarea", "video", "audio", "source", "picture", "img"]);
const TABLE_TAGS = new Set(["thead", "tbody", "tfoot", "tr", "th", "td", "caption"]);

function contentTag(tag: string): string {
  if (tag === "b") return "strong";
  if (tag === "i") return "em";
  if (tag === "div" || tag === "article") return "section";
  return tag;
}

function contentAttributes(element: Element, tag: string, sourceUrl: string): { href?: string; start?: number } {
  const attributes: { href?: string; start?: number } = {};
  const rawHref = element.getAttribute("href");
  if (tag === "a" && rawHref !== null) {
    const href = safeArticleHref(rawHref, sourceUrl);
    if (href) attributes.href = href;
  }
  const rawStart = element.getAttribute("start");
  if (tag === "ol" && rawStart !== null && /^-?\d+$/.test(rawStart)) {
    const start = Number(rawStart);
    if (Number.isSafeInteger(start) && Math.abs(start) <= 1_000_000) attributes.start = start;
  }
  return attributes;
}

export function extractArticleContent(root: Node, sourceUrl: string): ArticleNode[] {
  let count = 0;
  function visit(node: Node, depth: number, pre = false, inTable = false): ArticleNode[] {
    if (++count > MAX_ARTICLE_CONTENT_NODES || depth > MAX_ARTICLE_CONTENT_DEPTH) throw new Error("Article structure exceeds capture limits.");
    if (node.nodeType === 3) {
      const text = pre ? node.textContent ?? "" : (node.textContent ?? "").replace(/\s+/g, " ");
      return text ? [{ text }] : [];
    }
    if (node.nodeType !== 1) return [];
    const element = node as Element;
    const originalTag = element.tagName.toLowerCase();
    const tag = contentTag(originalTag);
    if (OMIT_TAGS.has(tag) || element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true") return [];
    const children = Array.from(element.childNodes).flatMap(child => visit(child, depth + 1, pre || tag === "pre", inTable || tag === "table"));
    // Readability converts layout tables to divs but may leave their row wrappers.
    if (TABLE_TAGS.has(tag) && !inTable) return children;
    if (!ARTICLE_TAGS.includes(tag as ArticleTag)) return children;
    if (tag !== "br" && tag !== "hr" && !articleContentText(children)) return [];
    return [{ tag: tag as ArticleTag, children, ...contentAttributes(element, tag, sourceUrl) }];
  }
  return parseArticleContent(Array.from(root.childNodes).flatMap(node => visit(node, 0)));
}
