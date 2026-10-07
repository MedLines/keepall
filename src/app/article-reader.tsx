"use client";

import { useEffect, useRef, useState } from "react";
import { ArticleValidationError, parseSavedArticle } from "@/domain/article";
import type { LinkItem } from "@/domain/link";
import { saveLinkArticle } from "@/persistence/articles";

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
  return <section aria-label="Saved article" className="mt-10 border-t border-border-control pt-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold">{article ? article.title : "Read offline"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{article ? `${article.author ? `${article.author} · ` : ""}Saved ${new Date(article.capturedAt).toLocaleDateString()}. Available offline.` : "Save the article's text here to read and search it without a connection."}</p>
      </div>
      <button type="button" className="ui-control min-h-11 px-4 text-sm font-medium" disabled={disabled || saving} onClick={() => void capture()}>{saving ? "Saving article…" : error ? "Retry saving article" : article ? "Update saved article" : "Save article"}</button>
    </div>
    {error ? <p role="alert" className="mt-4 text-sm leading-relaxed text-text-danger">{error} Your link, personal note, and any saved article are still available.</p> : null}
    {saved ? <p role="status" className="mt-4 text-sm text-text-secondary">Article saved for offline reading.</p> : null}
    {article ? <>
      <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center break-all text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary">Open original</a>
      <article aria-label="Article text" className="mx-auto mt-6 max-w-3xl space-y-5 break-words text-base leading-8 [overflow-wrap:anywhere]">
        <p className="whitespace-pre-wrap">{article.text}</p>
      </article>
    </> : null}
  </section>;
}
