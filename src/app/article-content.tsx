"use client";

import { createElement, useMemo, type ReactNode } from "react";
import { parseArticleContent, type ArticleNode, type SavedArticle } from "@/domain/article";
import "./article-content.css";

function renderNode(node: ArticleNode, key: number): ReactNode {
  if ("text" in node) return node.text;
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
