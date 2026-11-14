"use client";

import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import type { Item } from "@/domain/item";
import {
  cardHeightGroup,
  cardHeightKey,
  isCardHeightGroupVerified,
  knownCardHeight,
  rememberCardHeight,
  verifyCardHeightGroup,
} from "./card-heights";
import {
  gridColumnCount,
  LIBRARY_GRID_GAP_PX,
  LIBRARY_GRID_ROW_ESTIMATE_PX,
  LIBRARY_VIRTUALIZE_MIN,
  estimateLibraryGridItemHeight,
} from "./library-scale";

export type MasonryPlacement = {
  index: number;
  style: CSSProperties;
  measureElement: (element: HTMLLIElement | null) => void;
  /** Rendered off screen only to learn its height: no media, previews or other loading. */
  measureOnly?: boolean;
};

type Props = {
  items: Item[];
  scrollRef: RefObject<HTMLElement | null>;
  scopeKey: string;
  /** What the cards show beyond the scope, such as the search query; defaults to the scope. */
  heightScope?: string;
  renderItem: (item: Item, placement?: MasonryPlacement) => ReactNode;
  focusedIndex?: number;
};

/** Cards measured off screen per pass: about 2ms each, so a pass fits inside one frame. */
const MEASURE_BATCH = 8;

// Keys already handed to the measurer, so a card that cannot be measured is not retried forever.
const scheduledHeights = new Set<string>();

function whenIdle(callback: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(callback, { timeout: 500 });
    return () => cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(callback, 50);
  return () => window.clearTimeout(handle);
}

export function LibraryMasonry({ items, scrollRef, scopeKey, heightScope = scopeKey, renderItem, focusedIndex = -1 }: Props) {
  const gridRef = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [heightsVersion, setHeightsVersion] = useState(0);
  const columns = gridColumnCount(width);
  const columnWidth = width
    ? (width - (columns - 1) * LIBRARY_GRID_GAP_PX) / columns
    : 0;
  const virtualized = items.length >= LIBRARY_VIRTUALIZE_MIN;
  const heightGroup = cardHeightGroup(heightScope, width);
  // A new identity makes the virtualizer re-lay out unmeasured cards with newly learned heights.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- heightsVersion invalidates the layout on purpose
  const getItemKey = useCallback((index: number) => items[index].id, [items, heightsVersion]);
  const estimateSize = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return LIBRARY_GRID_ROW_ESTIMATE_PX;
      // Saved heights are used before the background check confirms them; a failed check re-lays out.
      return knownCardHeight(cardHeightKey(heightGroup, item)) ?? estimateLibraryGridItemHeight(item, columnWidth);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- heightsVersion: the height store is read live
    [columnWidth, items, heightGroup, heightsVersion],
  );
  const rangeExtractor = useCallback((range: Parameters<typeof defaultRangeExtractor>[0]) => (
    virtualized
      ? [...new Set([...defaultRangeExtractor(range), ...(focusedIndex >= 0 ? [focusedIndex] : [])])].sort((a, b) => a - b)
      : Array.from({ length: items.length }, (_, index) => index)
  ), [items.length, virtualized, focusedIndex]);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    getItemKey,
    estimateSize,
    lanes: columns,
    // Keep each card in its column as images load; only its vertical position changes.
    laneAssignmentMode: "estimate",
    gap: LIBRARY_GRID_GAP_PX,
    overscan: columns * 4,
    scrollMargin,
    rangeExtractor,
    directDomUpdates: true,
    useAnimationFrameWithResizeObserver: true,
    useFlushSync: false,
  });

  const setGridRef = useCallback((node: HTMLUListElement | null) => {
    gridRef.current = node;
    virtualizer.containerRef(node);
  }, [virtualizer]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    let nextWidth = Math.round(grid.clientWidth);
    const commitWidth = () => {
      frame = 0;
      setWidth((current) => current === nextWidth ? current : nextWidth);
    };
    const observer = new ResizeObserver(([entry]) => {
      nextWidth = Math.round(entry.contentRect.width);
      if (!frame) frame = requestAnimationFrame(commitWidth);
    });
    setWidth(nextWidth);
    observer.observe(grid);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Status messages above the grid are part of the same scroll container.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const scroll = scrollRef.current;
    if (grid && scroll) {
      const margin = grid.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
      if (margin !== scrollMargin) setScrollMargin(margin);
    }
  }, [scrollRef, scrollMargin, width]);

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [width, virtualizer]);

  const isScrolling = useCallback(() => virtualizer.isScrolling, [virtualizer]);
  const onHeightsLearned = useCallback(() => setHeightsVersion((version) => version + 1), []);
  // Cards that really mounted keep the store current, e.g. after a tag rename that leaves updatedAt alone.
  const keepMountedHeights = useCallback(() => {
    // Wait for the saved-height check: overwriting its sample with live sizes would hide a mismatch.
    if (!isCardHeightGroupVerified(heightGroup)) return;
    const byId = new Map(items.map(item => [item.id, item]));
    for (const [id, size] of virtualizer.itemSizeCache) {
      const item = byId.get(String(id));
      if (item) rememberCardHeight(cardHeightKey(heightGroup, item), size);
    }
  }, [heightGroup, items, virtualizer]);

  return (
    <>
      <ul ref={setGridRef} aria-label="Library items" data-masonry-scope={scopeKey} className="relative w-full">
        {width > 0 ? virtualizer.getVirtualItems().map(cell => renderItem(items[cell.index], {
          index: cell.index,
          measureElement: virtualizer.measureElement,
          style: {
            position: "absolute",
            top: 0,
            insetInlineStart: cell.lane * (columnWidth + LIBRARY_GRID_GAP_PX),
            width: width ? columnWidth : "100%",
          },
        })) : null}
      </ul>
      {virtualized && width > 0 ? (
        <CardHeightMeasurer
          items={items}
          group={heightGroup}
          columnWidth={columnWidth}
          renderItem={renderItem}
          isScrolling={isScrolling}
          onIdle={keepMountedHeights}
          onHeightsLearned={onHeightsLearned}
        />
      ) : null}
    </>
  );
}

/** Hands learned heights to the virtualizer every few batches instead of re-laying out per batch. */
const PUBLISH_EVERY_BATCHES = 12;

/**
 * Renders cards with no known height off screen, a batch at a time in idle time, top first.
 * It owns its own state so a batch re-renders only the hidden cards, not the visible grid.
 * The first batch for a scope and width re-measures cards with saved heights, and drops the
 * saved heights if any no longer match (card styles changed since they were saved).
 */
function CardHeightMeasurer({ items, group, columnWidth, renderItem, isScrolling, onIdle, onHeightsLearned }: {
  items: Item[];
  group: string;
  columnWidth: number;
  renderItem: (item: Item, placement?: MasonryPlacement) => ReactNode;
  isScrolling: () => boolean;
  onIdle: () => void;
  onHeightsLearned: () => void;
}) {
  const [batch, setBatch] = useState<number[]>([]);
  const unpublished = useRef(0);

  // Each committed batch changes `batch`, which schedules the next one in idle time.
  useEffect(() => {
    let cancelled = false;
    let cancelIdle = () => {};
    const tick = () => {
      if (cancelled) return;
      if (isScrolling()) {
        cancelIdle = whenIdle(tick);
        return;
      }
      onIdle();
      const next = nextBatch(items, group);
      if (next.length) {
        for (const index of next) scheduledHeights.add(cardHeightKey(group, items[index]));
        setBatch(next);
        return;
      }
      setBatch((current) => current.length ? [] : current);
      if (unpublished.current) {
        unpublished.current = 0;
        onHeightsLearned();
      }
    };
    // Text measured before web fonts load would be the wrong height.
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!cancelled) cancelIdle = whenIdle(tick);
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [batch, items, group, isScrolling, onIdle, onHeightsLearned]);

  // Runs once the batch's cards are in the DOM; reading their heights forces one layout.
  const measureBatch = useCallback((list: HTMLUListElement | null) => {
    if (!list) return;
    const verifying = !isCardHeightGroupVerified(group);
    let matches = true;
    const measured: Array<[string, number]> = [];
    for (const card of Array.from(list.children)) {
      const item = items[Number((card as HTMLElement).dataset.index)];
      if (!item) continue;
      const key = cardHeightKey(group, item);
      const height = Math.round(card.getBoundingClientRect().height);
      const saved = knownCardHeight(key);
      if (verifying && saved !== undefined && Math.abs(saved - height) > 1) matches = false;
      measured.push([key, height]);
    }
    if (verifying) verifyCardHeightGroup(group, matches);
    for (const [key, height] of measured) rememberCardHeight(key, height);
    unpublished.current += 1;
    if (verifying || unpublished.current >= PUBLISH_EVERY_BATCHES) {
      unpublished.current = 0;
      onHeightsLearned();
    }
  }, [items, group, onHeightsLearned]);

  if (!batch.length) return null;
  return (
    <div aria-hidden="true" inert className="pointer-events-none invisible relative h-0 overflow-hidden" style={{ contain: "strict" }}>
      {/* A new list per batch, so its ref measures every batch. */}
      <ul key={batch[0]} ref={measureBatch} className="relative" style={{ width: columnWidth }}>
        {batch.map(index => items[index] ? renderItem(items[index], {
          index,
          measureOnly: true,
          measureElement: ignoreMeasure,
          style: { position: "relative", width: columnWidth },
        }) : null)}
      </ul>
    </div>
  );
}

/** Saved heights get a one-batch check first; after that, only cards with no height are measured. */
function nextBatch(items: Item[], group: string): number[] {
  const next: number[] = [];
  const verifying = !isCardHeightGroupVerified(group);
  for (let index = 0; index < items.length && next.length < MEASURE_BATCH; index += 1) {
    const key = cardHeightKey(group, items[index]);
    if (scheduledHeights.has(key)) continue;
    const saved = knownCardHeight(key) !== undefined;
    if (verifying ? saved : !saved) next.push(index);
  }
  // Nothing saved to check against: the group is trustworthy as is.
  if (verifying && !next.length) {
    verifyCardHeightGroup(group, true);
    return nextBatch(items, group);
  }
  return next;
}

function ignoreMeasure() {}
