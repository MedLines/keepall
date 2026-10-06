"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentItem } from "@/domain/document";
import { getPdfThumbnail } from "@/persistence/pdf-thumbnail";
import { DocumentIcon } from "./document-icon";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { ItemViewTransition } from "./item-view-transition";

export function PdfCardThumbnail({ item, compact = false }: {
  item: DocumentItem;
  compact?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [thumbnail, setThumbnail] = useState<{ assetId: string; image: string | null } | null>(null);
  useEffect(() => {
    let generation = 0;
    let visible = false;
    function refresh() {
      if (!visible) return;
      const request = ++generation;
      void getPdfThumbnail(item.assetId).then(image => {
        if (request === generation) setThumbnail({ assetId: item.assetId, image });
      }).catch(() => {
        if (request === generation) setThumbnail({ assetId: item.assetId, image: null });
      });
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      visible = true; observer.disconnect(); refresh();
    }, { rootMargin: "200px" });
    if (frame.current) observer.observe(frame.current);
    window.addEventListener(ITEMS_CHANGED_EVENT, refresh);
    return () => { generation++; observer.disconnect(); window.removeEventListener(ITEMS_CHANGED_EVENT, refresh); };
  }, [item.assetId]);
  const ready = thumbnail?.assetId === item.assetId;
  return <ItemViewTransition itemId={item.id} assetId={item.assetId} kind="document" source><div ref={frame} data-pdf-preview className={compact ? "size-full overflow-hidden rounded-[inherit] bg-bg-raised" : "media-outline media-squircle-inset w-full overflow-hidden bg-bg-raised"}>
    {ready && thumbnail.image ?
      // eslint-disable-next-line @next/next/no-img-element -- bounded local first-page rendering, cached in memory
      <img src={thumbnail.image} alt={`First page of ${item.title || item.sourceFileName}`} className={`block bg-white ${compact ? "size-full object-cover object-top" : "h-auto w-full"}`} />
      : <div className={`flex flex-col items-center justify-center gap-3 text-text-secondary ${compact ? "size-full" : "aspect-[16/10]"}`}><DocumentIcon format="pdf" className={compact ? "size-6" : "size-8"} /><span className={compact ? "sr-only" : "text-sm"}>{ready ? "Preview unavailable" : "Loading preview…"}</span></div>}
  </div></ItemViewTransition>;
}
