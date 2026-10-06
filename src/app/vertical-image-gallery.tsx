"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { ImageItem } from "@/domain/image";
import { LibraryItemMedia } from "./library-item-media";
import { ImageIcon } from "./shell-icons";
import { useNearViewport } from "./use-near-viewport";

export function VerticalImageGallery({ item, active, listRef, scrollRef, preserveScrollAnchor, onOpen }: {
  item: ImageItem;
  active: boolean;
  listRef: RefObject<HTMLOListElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  preserveScrollAnchor: () => () => void;
  onOpen: (index: number) => void;
}) {
  return (
    <ol ref={listRef} hidden={!active} aria-label="Images in scroll view" className="isolate space-y-6">
      {item.assetIds.map((assetId, index) => (
        <li key={`${assetId}-${index}`} data-gallery-index={index} data-gallery-asset={assetId}>
          <ScrollImage item={item} assetId={assetId} index={index} active={active} scrollRef={scrollRef} preserveScrollAnchor={preserveScrollAnchor} onOpen={() => onOpen(index)} />
        </li>
      ))}
    </ol>
  );
}

function ScrollImage({ item, assetId, index, active, scrollRef, preserveScrollAnchor, onOpen }: {
  item: ImageItem;
  assetId: string;
  index: number;
  active: boolean;
  scrollRef: RefObject<HTMLElement | null>;
  preserveScrollAnchor: () => () => void;
  onOpen: () => void;
}) {
  const { ref, near } = useNearViewport("600px 0px", scrollRef);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const restorePosition = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    restorePosition.current?.();
    restorePosition.current = null;
  }, [dimensions]);

  function imageLoaded(_ratio: number, nextDimensions: { width: number; height: number }) {
    if (nextDimensions.width === dimensions?.width && nextDimensions.height === dimensions.height) return;
    restorePosition.current = preserveScrollAnchor();
    setDimensions(nextDimensions);
  }

  return (
    <figure style={{ width: dimensions?.width }} className="mx-auto max-w-full">
      <div ref={ref} style={{ aspectRatio: dimensions ? dimensions.width / dimensions.height : 4 / 3 }} className="bg-bg-image-viewer">
        <button
          type="button"
          className="control-shape-none block size-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
          aria-label={`View image ${index + 1} full screen`}
          onClick={onOpen}
        >
          {active && near ? (
            <LibraryItemMedia item={item} assetId={assetId} variant="viewer" onImageLoad={imageLoaded} />
          ) : (
            <span className="flex size-full items-center justify-center text-text-secondary" aria-hidden="true"><ImageIcon className="size-8" /></span>
          )}
        </button>
      </div>
      <figcaption className="mt-2 text-xs tabular-nums text-text-secondary">Image {index + 1} of {item.assetIds.length}</figcaption>
    </figure>
  );
}
