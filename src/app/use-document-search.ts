"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveItemTagNames, type Item } from "@/domain/item";
import { parseSearchTerms, type DocumentSearchMatch } from "@/domain/search";
import type { Tag } from "@/domain/tag";
import { createDocumentSearchClient } from "./document-search-client";

export function useDocumentSearch(items: Item[], tags: Tag[], query: string) {
  const client = useMemo(() => createDocumentSearchClient(), []);
  const documents = useMemo(() => items.filter(item => item.type === "document"), [items]);
  const entries = useMemo(() => {
    const tagMap = new Map(tags.map(tag => [tag.id, tag]));
    return documents.map(item => ({ item, tagNames: resolveItemTagNames(item, tagMap) }));
  }, [documents, tags]);
  const enabled = documents.length > 0 && parseSearchTerms(query).length > 0;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    entries: typeof entries; query: string; attempt: number;
    matches?: Map<string, DocumentSearchMatch>; unavailable: number; error: boolean;
  } | null>(null);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) setResult(null);
  }

  // New library snapshots also cover backup replacement with reused original IDs.
  useEffect(() => () => client.reset(), [client, entries]);
  useEffect(() => {
    let active = true;
    if (enabled) {
      void client.search(entries, query).then(response => {
        if (active) setResult({ entries, query, attempt, matches: new Map(response.matches), unavailable: response.unavailable, error: false });
      }).catch(() => {
        if (active) setResult({ entries, query, attempt, unavailable: 0, error: true });
      });
    } else client.cancel();
    return () => { active = false; };
  }, [client, entries, query, attempt, enabled]);

  const settled = enabled && result?.entries === entries ? result : null;
  const current = settled?.query === query && settled.attempt === attempt ? settled : null;
  return {
    enabled,
    query: enabled ? settled?.query ?? "" : query,
    matches: settled?.matches,
    pending: enabled && !current,
    error: current?.error ?? false,
    unavailable: current?.unavailable ?? 0,
    retry: () => { client.reset(); setAttempt(value => value + 1); },
  };
}
