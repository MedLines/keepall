"use client";

import { useEffect, useState } from "react";
import type { DocumentItem } from "@/domain/document";
import { getDocumentPreview } from "@/persistence/document-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";

export function useDocumentPreview(item: DocumentItem) {
  const key = `${item.assetId}:${item.format}`;
  const [preview, setPreview] = useState<{ key: string; text: string | null } | null>(null);
  useEffect(() => {
    if (item.format === "pdf") return;
    let generation = 0;
    function refresh() {
      const request = ++generation;
      void getDocumentPreview(item.assetId).then(text => {
        if (request === generation) setPreview({ key, text });
      }).catch(() => { if (request === generation) setPreview({ key, text: null }); });
    }
    refresh();
    window.addEventListener(ITEMS_CHANGED_EVENT, refresh);
    return () => { generation++; window.removeEventListener(ITEMS_CHANGED_EVENT, refresh); };
  }, [item.assetId, item.format, key]);
  return preview?.key === key ? preview : null;
}
