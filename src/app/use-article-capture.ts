"use client";

import { useEffect, useRef, useState } from "react";
import { ArticleValidationError, parseCapturedArticle } from "@/domain/article";
import type { LinkItem } from "@/domain/link";
import { saveLinkArticle } from "@/persistence/articles";

export function useArticleCapture(link: Pick<LinkItem, "id" | "url"> | null, onSaved?: (link: LinkItem) => void, disabled = false) {
  const key = link ? `${link.id}:${link.url}` : "";
  const [state, setState] = useState({ key, saving: false, error: null as string | null, saved: false });
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, [key]);

  async function capture() {
    if (!link || request.current || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setState({ key, saving: true, error: null, saved: false });
    try {
      const response = await fetch("/api/article", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link.url }), signal: controller.signal });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new ArticleValidationError(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "The article service is unavailable. Try again later.");
      const article = parseCapturedArticle(body);
      controller.signal.throwIfAborted();
      const updated = await saveLinkArticle(link.id, link.url, article);
      if (!controller.signal.aborted) {
        onSaved?.(updated);
        setState({ key, saving: false, error: null, saved: true });
      }
    } catch (caught) {
      if (!controller.signal.aborted) setState({ key, saving: false, saved: false,
        error: caught instanceof ArticleValidationError ? caught.message : "Couldn't save this article. Check your connection and storage, then try again." });
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  return { ...(state.key === key ? state : { saving: false, error: null, saved: false }), capture };
}
