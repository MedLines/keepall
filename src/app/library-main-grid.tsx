"use client";

import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from "react";
import type { Item } from "@/domain/item";
import type { LibraryLayout, LibraryListColumns } from "@/domain/library-view";
import { LibraryVirtualItems } from "./library-virtual-items";
import { LIBRARY_VIRTUALIZE_MIN, listColumnCount } from "./library-scale";
import { LibraryMasonry, type MasonryPlacement } from "./library-masonry";
import { LibraryQuickPreview } from "./library-quick-preview";

export type LibraryPreviewHandle = { openPreview: (itemId?: string) => void };

type Props = {
  ref?: Ref<LibraryPreviewHandle>;
  visibleItems: Item[];
  scopeKey: string;
  layout: LibraryLayout;
  listColumns?: LibraryListColumns;
  scrollRef: RefObject<HTMLElement | null>;
  empty: ReactNode;
  renderItem: (item: Item, placement?: MasonryPlacement) => ReactNode;
  selectedIds: ReadonlySet<string>;
  onSelectIds: (ids: Set<string>) => void;
  onOpenItem: (item: Item) => void;
  previewEnabled?: boolean;
  keyboardDisabled?: boolean;
  onPreviewOpenChange?: (open: boolean) => void;
};

const arrowStep: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/** Both views window large libraries; keyboard order follows the filtered results. */
export function LibraryMainGrid({
  ref, visibleItems, scopeKey, layout, listColumns = "auto", scrollRef, empty, renderItem,
  selectedIds, onSelectIds, onOpenItem, previewEnabled = true, keyboardDisabled = false, onPreviewOpenChange,
}: Props) {
  const browseRef = useRef<HTMLDivElement>(null);
  const [listColumnTotal, setListColumnTotal] = useState(1);
  const columns = layout === "list" ? listColumns === "auto" ? listColumnTotal : Number(listColumns) : 1;
  const arrowSteps: Record<string, number> = { ...arrowStep, ArrowUp: -columns, ArrowDown: columns };
  useLayoutEffect(() => {
    const node = browseRef.current;
    if (!node || layout !== "list") return;
    setListColumnTotal(listColumnCount(node.clientWidth));
    const observer = new ResizeObserver(([entry]) => setListColumnTotal(listColumnCount(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [layout]);
  const instructionsId = useId();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const rangeRef = useRef<{ anchor: string; base: ReadonlySet<string> } | null>(null);
  const focusedIndex = visibleItems.findIndex(item => item.id === focusedId);
  const previewIndex = visibleItems.findIndex(item => item.id === previewId);
  const previewItem = visibleItems[previewIndex] ?? null;
  const previewOpen = previewItem !== null;
  useEffect(() => { onPreviewOpenChange?.(previewOpen); }, [onPreviewOpenChange, previewOpen]);


  useImperativeHandle(ref, () => ({
    openPreview(itemId) {
      if (!previewEnabled || keyboardDisabled) return;
      const item = visibleItems.find(item => item.id === (itemId ?? focusedId))
        ?? (itemId === undefined ? visibleItems[0] : undefined);
      if (!item) return;
      setFocusedId(item.id);
      setPreviewId(item.id);
    },
  }), [focusedId, visibleItems, previewEnabled, keyboardDisabled]);

  useEffect(() => { rangeRef.current = null; }, [visibleItems, scopeKey]);
  useEffect(() => { if (selectedIds.size === 0) rangeRef.current = null; }, [selectedIds.size]);

  useEffect(() => {
    if (!focusRequest) return;
    const frame = requestAnimationFrame(() => {
      const node = Array.from(browseRef.current?.querySelectorAll<HTMLElement>("[data-item-id]") ?? [])
        .find(node => node.dataset.itemId === focusRequest.id);
      if (!node) return;
      node.focus({ preventScroll: true });
      const scroll = scrollRef.current;
      if (!scroll) return;
      const rect = node.getBoundingClientRect();
      const viewport = scroll.getBoundingClientRect();
      if (rect.top < viewport.top) scroll.scrollTop += rect.top - viewport.top;
      else if (rect.bottom > viewport.bottom) scroll.scrollTop += Math.min(rect.bottom - viewport.bottom, rect.top - viewport.top);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, layout, scrollRef]);

  useEffect(() => {
    if (previewId !== null && previewIndex < 0) {
      const frame = requestAnimationFrame(() => {
        setPreviewId(null);
        if (visibleItems[0]) {
          setFocusedId(visibleItems[0].id);
          setFocusRequest({ id: visibleItems[0].id });
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [previewId, previewIndex, visibleItems]);

  function requestFocus(id: string) {
    setFocusedId(id);
    setFocusRequest({ id });
  }

  function closePreview() {
    setPreviewId(null);
    if (previewItem) requestFocus(previewItem.id);
  }

  const grid = visibleItems.length === 0 ? empty : layout === "grid" ? (
    <LibraryMasonry key={scopeKey} items={visibleItems} scopeKey={scopeKey} scrollRef={scrollRef} renderItem={renderItem} focusedIndex={focusedIndex} />
  ) : visibleItems.length >= LIBRARY_VIRTUALIZE_MIN ? (
    <LibraryVirtualItems key={scopeKey} items={visibleItems} scrollRef={scrollRef} renderItem={renderItem} focusedIndex={focusedIndex} columns={columns} />
  ) : (
    <ul className="library-list grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-label="Library items">{visibleItems.map(item => renderItem(item))}</ul>
  );

  return <div ref={browseRef} tabIndex={-1} aria-describedby={instructionsId}
    onFocusCapture={event => {
      const node = event.target as HTMLElement;
      if (node.dataset.itemId) {
        if (node.dataset.itemId !== focusRequest?.id) rangeRef.current = null;
        setFocusedId(node.dataset.itemId);
      }
    }}
    onPointerDownCapture={() => { rangeRef.current = null; }}
    onKeyDown={event => {
      const node = event.target as HTMLElement;
      const id = node.dataset.itemId;
      if (!id || keyboardDisabled || event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      const index = visibleItems.findIndex(item => item.id === id);
      if (index < 0) return;
      const step = arrowSteps[event.key];
      if (step) {
        event.preventDefault();
        const nextIndex = Math.max(0, Math.min(visibleItems.length - 1, index + step));
        const next = visibleItems[nextIndex];
        if (event.shiftKey) {
          const range = rangeRef.current ?? { anchor: id, base: new Set(selectedIds) };
          rangeRef.current = range;
          const anchorIndex = visibleItems.findIndex(item => item.id === range.anchor);
          const ids = new Set(range.base);
          for (const item of visibleItems.slice(Math.min(anchorIndex, nextIndex), Math.max(anchorIndex, nextIndex) + 1)) ids.add(item.id);
          onSelectIds(ids);
        } else rangeRef.current = null;
        requestFocus(next.id);
      } else if (!event.shiftKey && event.key === " " && previewEnabled) {
        event.preventDefault();
        setPreviewId(id);
      } else if (!event.shiftKey && event.key === "Enter" && previewEnabled) {
        event.preventDefault();
        onOpenItem(visibleItems[index]);
      }
    }}
  >
    <p id={instructionsId} className="sr-only">Arrow keys browse items in result order. Shift and an arrow selects a range.{previewEnabled ? " Space previews. Enter opens the full item." : ""}</p>
    {grid}
    <LibraryQuickPreview item={previewItem} index={previewIndex} count={visibleItems.length}
      onClose={closePreview} onOpenItem={onOpenItem}
      returnFocus={() => Array.from(browseRef.current?.querySelectorAll<HTMLElement>("[data-item-id]") ?? [])
        .find(node => node.dataset.itemId === focusedId) ?? browseRef.current}
      onMove={step => {
        const next = visibleItems[previewIndex + step];
        if (!next) return;
        setFocusedId(next.id);
        setPreviewId(next.id);
      }}
    />
  </div>;
}
