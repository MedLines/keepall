"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveItemTagNames, type Item } from "@/domain/item";
import { parseSearchTerms, type DocumentSearchMatch } from "@/domain/search";
import type { Tag } from "@/domain/tag";
import { createDocumentSearchClient } from "./document-search-client";

export function useDocumentSearch(items: Item[], tags: Tag[], query: string, revision = "initial") {
  const client = useMemo(() => createDocumentSearchClient(), []);
  const documents = useMemo(() => items.filter(item => item.type === "document"), [items]);
  const nextEntries = useMemo(() => {
    const tagMap = new Map(tags.map(tag => [tag.id, tag]));
    return documents.map(item => ({ item, tagNames: resolveItemTagNames(item, tagMap) }));
  }, [documents, tags]);
  const key = useMemo(() => JSON.stringify(nextEntries), [nextEntries]);
  const [input, setInput] = useState({ key, entries: nextEntries });
  if (input.key !== key) setInput({ key, entries: nextEntries });
  const entries = input.entries;
  const enabled = documents.length > 0 && parseSearchTerms(query).length > 0;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    entries: typeof entries; query: string; attempt: number; revision: string;
    matches?: Map<string, DocumentSearchMatch>; unavailable: number; error: boolean;
  } | null>(null);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) setResult(null);
  }

  // Original writes invalidate cached bytes even when a backup reuses item and asset IDs.
  useEffect(() => () => client.reset(), [client, revision]);
  useEffect(() => {
    let active = true;
    const timer = enabled ? window.setTimeout(() => {
      void client.search(entries, query).then(response => {
        if (active) setResult({ entries, query, attempt, revision, matches: new Map(response.matches), unavailable: response.unavailable, error: false });
      }).catch(() => {
        if (active) setResult({ entries, query, attempt, revision, unavailable: 0, error: true });
      });
    }, 120) : null;
    if (!enabled) client.cancel();
    return () => { active = false; if (timer !== null) window.clearTimeout(timer); };
  }, [client, entries, query, attempt, enabled, revision]);

  const settled = enabled ? result : null;
  const current = settled?.entries === entries && settled.query === query && settled.attempt === attempt && settled.revision === revision ? settled : null;
  return {
    enabled,
    query: enabled ? settled?.query ?? query : query,
    matches: settled?.matches,
    pending: enabled && !current,
    error: current?.error ?? false,
    unavailable: current?.unavailable ?? 0,
    retry: () => { client.reset(); setAttempt(value => value + 1); },
  };
}
