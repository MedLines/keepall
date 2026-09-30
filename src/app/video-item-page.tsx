"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { itemActionLabel } from "@/domain/item-label";
import type { VideoItem } from "@/domain/video";
import type { Tag } from "@/domain/tag";
import type { Collection } from "@/domain/collection";
import { resolveItemCollections, resolveItemTags } from "@/domain/item";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createTag, listTags } from "@/persistence/tags";
import { createCollection, listCollections } from "@/persistence/collections";
import { assignCollectionToItem, assignTagToItem, deleteItem, getItem, unassignTagFromItem } from "@/persistence/items";
import { getVideoBlob, updateVideoDetails } from "@/persistence/videos";
import { NoteContent } from "./note-content";
import { VideoItemEditDialog, type VideoDetailsDraft } from "./item-edit-dialog";
import { useThumbnailObjectUrl } from "./use-thumbnail-object-url";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import { ItemLibraryDetails } from "./item-library-details";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { ArrowLeftIcon, DeleteIcon, EditIcon, LayersIcon, VideoIcon } from "./shell-icons";

type VideoState =
  | { itemId: string; status: "loading" | "missing" | "error" }
  | { itemId: string; status: "ready"; item: VideoItem; tags: Tag[]; collections: Collection[] };

type MediaState =
  | { key: string; status: "loading" | "missing" | "error" | "unsupported" }
  | { key: string; status: "ready"; url: string };

function VideoPlayback({ title, poster, media, onRetry, onError }: { title: string; poster: string | null; media: MediaState; onRetry: () => void; onError: () => void }) {
  return <div className="overflow-hidden rounded-control border border-border-control bg-bg-media">
    {media.status === "ready" ? <video aria-label={title} src={media.url} poster={poster ?? undefined} controls preload="metadata" playsInline className="mx-auto max-h-[75vh] w-full" onError={onError} />
      : <div className="grid aspect-video place-content-center gap-3 p-5 text-center text-text-on-media">
        <VideoIcon />
        {media.status === "loading" ? <span>Loading video…</span> : <>
          <p role="alert" className="text-sm">{media.status === "missing" ? "The saved video file is missing." : media.status === "unsupported" ? "This browser couldn't play the saved video. Try a browser that supports this video format." : "Couldn't load video. Try reading the saved file again."}</p>
          {media.status === "missing" ? <Link href="/settings#backup-heading" className="text-sm underline underline-offset-2">Check backups in Settings</Link> : null}
          <button type="button" className="ui-control mx-auto min-h-10 px-3 text-sm text-text-primary" onClick={onRetry}>Retry video</button>
        </>}
      </div>}
  </div>;
}

export function VideoItemPage({ itemId, returnHref }: { itemId: string; returnHref: string }) {
  const router = useRouter();
  const [state, setState] = useState<VideoState>({ itemId, status: "loading" });
  const [media, setMedia] = useState<MediaState>({ key: "", status: "loading" });
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const currentState = state.itemId === itemId ? state : { itemId, status: "loading" as const };
  const videoAssetId = currentState.status === "ready" ? currentState.item.assetId : null;
  const mediaKey = videoAssetId ? JSON.stringify([itemId, videoAssetId, retry]) : "";
  const currentMedia = media.key === mediaKey ? media : { key: mediaKey, status: "loading" as const };
  const poster = useThumbnailObjectUrl(videoAssetId);

  useEffect(() => {
    let active = true;
    void Promise.all([getItem(itemId), listTags(), listCollections()]).then(([item, tags, collections]) => {
      if (!active) return;
      setState(item?.type === "video" ? { itemId, status: "ready", item, tags, collections } : { itemId, status: "missing" });
    }).catch(() => { if (active) setState({ itemId, status: "error" }); });
    return () => { active = false; };
  }, [itemId]);

  useEffect(() => {
    if (!videoAssetId) return;
    let active = true;
    let url: string | null = null;
    const key = mediaKey;
    void getVideoBlob(videoAssetId).then((blob) => {
      if (!active) return;
      if (!blob) { setMedia({ key, status: "missing" }); return; }
      url = URL.createObjectURL(blob);
      setMedia({ key, status: "ready", url });
    }).catch(() => { if (active) setMedia({ key, status: "error" }); });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [videoAssetId, mediaKey]);

  if (currentState.status !== "ready") {
    return <main className="grid min-h-dvh place-items-center bg-bg-canvas p-5 text-text-secondary">
      {currentState.status === "loading" ? "Loading video…" : currentState.status === "missing" ? "Video not found." : "Couldn't load video."}
      <Link href={returnHref} className="ui-control mt-4 min-h-10 px-4">Return to library</Link>
    </main>;
  }

  const item = currentState.item;
  const tags = resolveItemTags(item, new Map(currentState.tags.map((tag) => [tag.id, tag])));
  const collections = resolveItemCollections(item, new Map(currentState.collections.map((collection) => [collection.id, collection])));
  const applyUpdate = (next: VideoItem, extra?: { tag?: Tag; collection?: Collection }) => {
    setState((current) => current.status === "ready" ? {
      ...current, item: next,
      tags: extra?.tag ? [...current.tags, extra.tag] : current.tags,
      collections: extra?.collection ? [...current.collections, extra.collection] : current.collections,
    } : current);
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
  };
  const saveDetails = async (draft: VideoDetailsDraft) => {
    setBusy(true); setEditError(null);
    try {
      applyUpdate(await updateVideoDetails(itemId, draft));
      setEditing(false);
    } catch {
      setEditError("Couldn't save video details. Check the title and try again.");
    } finally {
      setBusy(false);
    }
  };
  const runOrg = async (action: () => Promise<void>) => {
    setBusy(true); setActionError(null);
    try { await action(); } catch { setActionError("Couldn't update video organization."); }
    finally { setBusy(false); }
  };

  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-canvas text-text-primary">
    <header className="z-10 shrink-0 border-b border-border-control bg-bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 w-full max-w-[100rem] items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <Link href={returnHref} aria-label="Library" className="ui-control inline-flex min-h-10 shrink-0 items-center gap-2 px-3 text-sm"><ArrowLeftIcon /><span className="hidden sm:inline">Library</span></Link>
        <span className="min-w-0 flex-1 truncate text-sm text-text-secondary" title={item.title}>{item.title}</span>
        <button type="button" aria-label="Edit details" className="ui-control inline-flex min-h-10 shrink-0 items-center gap-2 px-3 text-sm" onClick={() => { setEditError(null); setEditing(true); }}><EditIcon /><span className="hidden sm:inline">Edit details</span></button>
        <button type="button" aria-label="Organize" className="ui-control inline-flex min-h-10 shrink-0 items-center gap-2 px-3 text-sm" onClick={() => { setActionError(null); setOrganizerOpen(true); }}><LayersIcon /><span className="hidden sm:inline">Organize</span></button>
        <button type="button" aria-label="Move to Trash" className="ui-control inline-flex min-h-10 shrink-0 items-center gap-2 px-3 text-sm text-text-danger" onClick={() => { setActionError(null); setDeleteOpen(true); }}><DeleteIcon /><span className="hidden sm:inline">Move to Trash</span></button>
      </div>
    </header>
    <main className="ui-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="item-page-scroll">
      <div className="mx-auto grid w-full max-w-[100rem] items-start gap-8 px-5 pb-24 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="min-w-0 lg:mx-auto lg:w-full lg:max-w-5xl">
          <h1 className="mb-5 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{item.title}</h1>
          <VideoPlayback title={item.title} poster={poster} media={currentMedia} onRetry={() => setRetry((value) => value + 1)} onError={() => setMedia((current) => current.key === mediaKey ? { key: mediaKey, status: "unsupported" } : current)} />
          {item.noteContent?.trim() ? <article aria-labelledby="video-notes-heading" className="mt-10 border-t border-border-control pt-7">
            <h2 id="video-notes-heading" className="text-xl font-semibold">Notes</h2>
            <NoteContent content={item.noteContent} format={item.noteFormat === "markdown" ? "markdown" : "plain"} className="mt-5 text-text-primary" />
          </article> : null}
        </div>
        <ItemLibraryDetails label="Video details" summary={{ label: "Type", value: "Local video" }} collections={collections} tags={tags} createdAt={item.createdAt} updatedAt={item.updatedAt} sourceFileName={item.sourceFileName} className="lg:sticky lg:top-8" />
      </div>
    </main>
    {editing ? <VideoItemEditDialog item={item} open busy={busy} error={editError} onSave={(draft) => void saveDetails(draft)} onOpenChange={setEditing} /> : null}
    <ItemOrganizerDrawer open={organizerOpen} onOpenChange={setOrganizerOpen} side="right" itemTitle={itemActionLabel(item)}
      tags={tags} collections={collections} tagSuggestions={currentState.tags.map((tag) => ({ id: tag.id, name: tag.name }))}
      collectionSuggestions={currentState.collections.map((collection) => ({ id: collection.id, name: collection.name }))}
      disabled={busy} pendingTag={busy} pendingCollection={busy} tagError={actionError} collectionError={actionError}
      onAddTag={(name) => void runOrg(async () => {
        const tag = await createTag({ name });
        const next = await assignTagToItem(itemId, tag.id);
        if (next.type === "video") applyUpdate(next, { tag });
      })}
      onRemoveTag={(id) => void runOrg(async () => {
        const next = await unassignTagFromItem(itemId, id);
        if (next.type === "video") applyUpdate(next);
      })}
      onMoveToCollection={(name) => void runOrg(async () => {
        const collection = await createCollection({ name });
        const next = await assignCollectionToItem(itemId, collection.id);
        if (next.type === "video") applyUpdate(next, { collection });
      })}
    />
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Move video to Trash?" description={`Move “${itemActionLabel(item)}” to Trash? You can restore it later.`}
      confirmLabel="Move to Trash" pendingLabel="Moving…" busy={busy} error={actionError} onConfirm={() => {
        setBusy(true); setActionError(null);
        void deleteItem(itemId).then(() => { window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT)); router.push(returnHref); })
          .catch(() => setActionError("Couldn't move video to Trash."))
          .finally(() => setBusy(false));
      }} />
  </div>;
}
