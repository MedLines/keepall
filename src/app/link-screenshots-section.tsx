"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { LinkItem } from "@/domain/link";
import { linkCoverAssetId, linkScreenshots } from "@/domain/link-screenshot";
import { removeLinkScreenshotImage, setLinkCoverImage } from "@/persistence/items";
import { ItemMediaFrame } from "./item-media-frame";
import { ITEM_MEDIA_HEIGHT } from "./item-page-styles";
import { FocusedImageViewer, MediaViewerTrigger } from "./focused-image-viewer";
import { LinkScreenshotStrip } from "./link-screenshot-strip";

/** Screenshots captured from the page, with cover choice and removal. Hidden when there are none. */
export function LinkScreenshotsSection({ link, disabled, onUpdated, className = "" }: {
  link: LinkItem;
  disabled: boolean;
  onUpdated: (link: LinkItem) => void;
  className?: string;
}) {
  const headingId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [mutation, setMutation] = useState<"cover" | "remove" | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shots = linkScreenshots(link);
  const current = shots.find((shot) => shot.assetId === selected) ?? shots[0];
  if (!current) return null;

  const busy = disabled || mutation !== null;
  const chosen = link.coverAssetId === current.assetId;
  const isCover = linkCoverAssetId(link) === current.assetId;
  const index = shots.indexOf(current);

  async function toggleCover() {
    if (busy || !current) return;
    setMutation("cover");
    setError(null);
    try {
      onUpdated(await setLinkCoverImage(link.id, chosen ? null : current.assetId));
    } catch {
      setError("Couldn't change the cover. Try again.");
    } finally {
      setMutation(null);
    }
  }

  async function remove() {
    if (mutation || !current) return;
    setMutation("remove");
    setError(null);
    try {
      const updated = await removeLinkScreenshotImage(link.id, current.assetId);
      setSelected(null);
      setRemoveOpen(false);
      onUpdated(updated);
    } catch {
      setError("Couldn't remove the screenshot. Try again.");
    } finally {
      setMutation(null);
    }
  }

  return <section aria-labelledby={headingId} className={className}>
    <h2 id={headingId} className="flex items-baseline gap-2 text-xl font-semibold">
      Screenshots <span className="text-sm font-normal tabular-nums text-text-secondary">{shots.length}</span>
    </h2>
    <p className="mt-2 text-sm text-text-secondary">Captured from the page with the Keepall extension.</p>
    {/* Same stage and full-screen viewer as image items. */}
    <figure className={`mt-6 ${ITEM_MEDIA_HEIGHT}`}>
      <ItemMediaFrame className="image-viewer-canvas">
        <MediaViewerTrigger item={link} assetId={current.assetId} label="View screenshot full screen" onOpen={() => setViewerOpen(true)} />
      </ItemMediaFrame>
      <figcaption className="sr-only">Screenshot {index + 1} of {shots.length}</figcaption>
    </figure>
    <FocusedImageViewer
      item={link}
      assetId={current.assetId}
      assetIds={shots.map((shot) => shot.assetId)}
      open={viewerOpen}
      currentSlide={index}
      onOpenChange={setViewerOpen}
      onSlideChange={(slide) => setSelected(shots[slide]?.assetId ?? null)}
    />
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <LinkScreenshotStrip link={link} selected={current.assetId} onSelect={setSelected} />
      <div className="flex shrink-0 items-center gap-2">
        {isCover && !chosen
          ? <span className="px-2 text-sm text-text-secondary">Shown as the card cover</span>
          : <Button disabled={busy} onClick={() => void toggleCover()}>{chosen ? "Use automatic cover" : "Use as cover"}</Button>}
        <Button disabled={busy} onClick={() => { setError(null); setRemoveOpen(true); }}>Remove</Button>
      </div>
    </div>
    {error && !removeOpen ? <p role="alert" className="mt-3 text-sm text-text-danger">{error}</p> : null}
    <ConfirmDialog
      open={removeOpen}
      title="Remove screenshot?"
      description="This screenshot is deleted from the link. You can capture the page again with the Keepall extension."
      confirmLabel="Remove screenshot"
      pendingLabel="Removing…"
      busy={mutation === "remove"}
      error={removeOpen ? error : null}
      onConfirm={() => void remove()}
      onOpenChange={setRemoveOpen}
    />
  </section>;
}
