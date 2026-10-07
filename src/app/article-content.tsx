"use client";

import { createElement, useMemo, type ReactNode } from "react";
import { parseArticleContent, type ArticleElement, type ArticleNode, type SavedArticle } from "@/domain/article";
import { LocalAssetImage } from "./local-asset-image";
import "./article-content.css";

function ArticleImage({ image }: { image: ArticleElement }) {
  return image.assetId
    ? <LocalAssetImage assetId={image.assetId} alt={image.alt ?? ""} />
    : <span role="img" aria-label={image.alt || "Unavailable article image"} className="my-5 block rounded-input border border-border-control bg-bg-control p-4 text-sm text-text-secondary">Image not saved for offline reading.{image.alt ? ` ${image.alt}` : ""}</span>;
}

function renderNode(node: ArticleNode, key: number): ReactNode {
  if ("text" in node) return node.text;
  if (node.tag === "img") return <ArticleImage key={key} image={node} />;
  const tag = node.tag === "h1" ? "h2" : node.tag === "section" ? "div" : node.tag;
  const props = node.tag === "a" && node.href
    ? { key, href: node.href, target: "_blank", rel: "noopener noreferrer" }
    : node.tag === "ol" && node.start !== undefined ? { key, start: node.start } : { key };
  return createElement(tag, props, ...(node.tag === "br" || node.tag === "hr" ? [] : node.children.map(renderNode)));
}

export function ArticleContent({ article }: { article: SavedArticle }) {
  const content = useMemo(() => {
    if (!article.content) return;
    try { return parseArticleContent(article.content); } catch { return; }
  }, [article.content]);
  return <article aria-label="Article text" className="article-content">
    {content ? content.map(renderNode) : article.text.split(/\n\s*\n/).filter(part => part.trim()).map((part, index) => <p key={index} className="whitespace-pre-wrap">{part}</p>)}
  </article>;
}
