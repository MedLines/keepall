"use client";

import { useEffect, useRef, useState } from "react";
import { ArticleValidationError, parseSavedArticle, type SavedArticle } from "@/domain/article";
import type { LinkItem } from "@/domain/link";
import { saveLinkArticle } from "@/persistence/articles";
import { ArticleContent } from "./article-content";
import { useAssetObjectUrl } from "./use-asset-object-url";

function LocalArticlePreview({ assetId }: { assetId: string }) {
  const url = useAssetObjectUrl(assetId);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- saved IndexedDB Blob; no remote fallback
  return <img src={url} alt="" className="media-outline mt-6 max-h-96 w-full rounded-input object-contain" />;
}

function SavedArticleHeader({ article, previewAssetId }: { article: SavedArticle; previewAssetId: string | null }) {
  const sourceName = article.siteName || new URL(article.sourceUrl).hostname.replace(/^www\./, "");
  return <header className="mb-8 mt-6 border-b border-border-control pb-7">
    <p className="text-sm font-medium text-text-secondary">{sourceName}</p>
    <h1 className="mt-3 break-words text-3xl font-semibold leading-tight tracking-tight [text-wrap:pretty] sm:text-4xl">{article.title}</h1>
    {article.author || article.publishedAt ? <p className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-sm leading-relaxed text-text-secondary">
      {article.author ? <span>{article.author}</span> : null}
      {article.author && article.publishedAt ? <span aria-hidden="true">·</span> : null}
      {article.publishedAt ? <time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</time> : null}
    </p> : null}
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
      <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-text-primary">Open original</a>
      <span>Saved <time dateTime={new Date(article.capturedAt).toISOString()}>{new Date(article.capturedAt).toLocaleDateString()}</time></span>
    </div>
    {previewAssetId ? <LocalArticlePreview assetId={previewAssetId} /> : null}
  </header>;
}

export function ArticleReader({ link, onSaved, disabled = false }: { link: LinkItem; onSaved: (link: LinkItem) => void; disabled?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  async function capture() {
    if (request.current || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setSaving(true); setError(null); setSaved(false);
    try {
      const response = await fetch("/api/article", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link.url }), signal: controller.signal });
      const body: unknown = await response.json();
      if (!response.ok) throw new ArticleValidationError(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Couldn't save this article. Try again later.");
      const article = parseSavedArticle(body);
      controller.signal.throwIfAborted();
      const updated = await saveLinkArticle(link.id, link.url, article);
      if (!controller.signal.aborted) { onSaved(updated); setSaved(true); }
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof ArticleValidationError ? caught.message : "Couldn't save this article. Check your connection and storage, then try again.");
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false); }
    }
  }
  const article = link.article;
  const minutes = article ? Math.max(1, Math.ceil(article.text.trim().split(/\s+/).length / 225)) : 0;
  return <section aria-label="Saved article" className={article ? "mx-auto max-w-[46rem] px-2 pb-3 pt-7 sm:px-7 sm:pt-10" : "mt-10 border-t border-border-control pt-7"}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      {article ? <p className="flex min-h-11 items-center text-sm text-text-secondary">Saved article · {minutes} min read · Available offline</p> : <div>
        <h2 className="text-xl font-semibold">Read offline</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">Saving this link keeps its web address. Save the article too to read and search its text without a connection.</p>
      </div>}
      <button type="button" className="ui-control min-h-11 px-4 text-sm font-medium" disabled={disabled || saving} onClick={() => void capture()}>{saving ? "Saving article…" : error ? "Retry saving article" : article ? "Update saved article" : "Save article for offline reading"}</button>
    </div>
    {error ? <p role="alert" className="mt-4 text-sm leading-relaxed text-text-danger">{error} Your link, personal note, and any saved article are still available.</p> : null}
    {saved ? <p role="status" className="mt-4 text-sm text-text-secondary">Article saved for offline reading.</p> : null}
    {article ? <>
      <SavedArticleHeader article={article} previewAssetId={link.previewAssetId} />
      <ArticleContent article={article} />
    </> : null}
  </section>;
}
