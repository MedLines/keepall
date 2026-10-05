"use client";

import { useEffect, useState } from "react";
import { decodeTextDocument, type DocumentAsset, type DocumentItem } from "@/domain/document";
import { getDocumentOriginal } from "@/persistence/documents";

type DocumentTextState =
  | { key: string; status: "loading" | "missing" | "error" }
  | { key: string; status: "ready"; text: string; original: DocumentAsset };

export function useDocumentText(item: Pick<DocumentItem, "id" | "assetId">) {
  const key = `${item.id}:${item.assetId}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DocumentTextState>({ key: "", status: "loading" });
  useEffect(() => {
    let active = true;
    void getDocumentOriginal(item.id).then((original) => {
      if (!active) return;
      if (!original || original.id !== item.assetId) {
        setState({ key, status: "missing" });
        return;
      }
      const text = decodeTextDocument(original.bytes);
      setState({ key, status: "ready", text, original });
    }).catch(() => {
      if (active) setState({ key, status: "error" });
    });
    return () => { active = false; };
  }, [item.id, item.assetId, key, attempt]);
  return {
    state: state.key === key ? state : { key, status: "loading" as const },
    retry: () => { setState({ key, status: "loading" }); setAttempt((current) => current + 1); },
  };
}
