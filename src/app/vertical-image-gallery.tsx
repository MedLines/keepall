"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { ImageItem } from "@/domain/image";
import { LibraryItemMedia } from "./library-item-media";
import { ImageIcon } from "./shell-icons";
import { CurrentImageMenu } from "./image-actions-menu";
import { ImageToolsPanel } from "./image-tools-panel";
import { useNearViewport } from "./use-near-viewport";

export function VerticalImageGallery({ item, active, busy, toolsDisabled, listRef, scrollRef, preserveScrollAnchor, onOpen, onReplace, onRemove }: {
  item: ImageItem;
  active: boolean;
  busy: boolean;
  toolsDisabled: boolean;
  listRef: RefObject<HTMLOListElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  preserveScrollAnchor: () => () => void;
  onOpen: (index: number) => void;
  onReplace: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <ol ref={listRef} hidden={!active} aria-label="Images in scroll view" className="isolate space-y-6">
      {item.assetIds.map((assetId, index) => (
        <li key={`${assetId}-${index}`} data-gallery-index={index} data-gallery-asset={assetId}>
          <ScrollImage item={item} assetId={assetId} index={index} active={active} busy={busy} toolsDisabled={toolsDisabled} scrollRef={scrollRef} preserveScrollAnchor={preserveScrollAnchor} onOpen={() => onOpen(index)} onReplace={() => onReplace(index)} onRemove={() => onRemove(index)} />
        </li>
      ))}
    </ol>
  );
}

function ScrollImage({ item, assetId, index, active, busy, toolsDisabled, scrollRef, preserveScrollAnchor, onOpen, onReplace, onRemove }: {
  item: ImageItem;
  assetId: string;
  index: number;
  active: boolean;
  busy: boolean;
  toolsDisabled: boolean;
  scrollRef: RefObject<HTMLElement | null>;
  preserveScrollAnchor: () => () => void;
  onOpen: () => void;
  onReplace: () => void;
  onRemove: () => void;
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
    <figure className="mx-auto w-full max-w-full">
      <ImageToolsPanel item={item} assetId={assetId} slide={index} disabled={toolsDisabled}>
      <div ref={ref} style={{ width: dimensions?.width, aspectRatio: dimensions ? dimensions.width / dimensions.height : 4 / 3 }} className="relative mx-auto max-w-full bg-bg-image-viewer">
        <div className="absolute right-3 top-3 z-10">
          <CurrentImageMenu label={`Image ${index + 1} actions`} busy={busy} canRemove={item.assetIds.length > 1} onReplace={onReplace} onRemove={onRemove} />
        </div>
        <button
          type="button"
          className="control-shape-none block size-full cursor-zoom-in focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
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
      </ImageToolsPanel>
    </figure>
  );
}
