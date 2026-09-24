"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { ArrowLeftIcon, DeleteIcon, EditIcon, LayersIcon, VideoIcon } from "./shell-icons";

type VideoState =
  | { status: "loading" | "missing" | "error" }
  | { status: "ready"; item: VideoItem; tags: Tag[]; collections: Collection[] };

export function VideoItemPage({ itemId, returnHref }: { itemId: string; returnHref: string }) {
  const router = useRouter();
  const [state, setState] = useState<VideoState>({ status: "loading" });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoAssetId = state.status === "ready" ? state.item.assetId : null;
  const poster = useThumbnailObjectUrl(videoAssetId);

  useEffect(() => {
    let active = true;
    void Promise.all([getItem(itemId), listTags(), listCollections()]).then(([item, tags, collections]) => {
      if (!active) return;
      setState(item?.type === "video" ? { status: "ready", item, tags, collections } : { status: "missing" });
    }).catch(() => { if (active) setState({ status: "error" }); });
    return () => { active = false; };
  }, [itemId]);

  useEffect(() => {
    if (!videoAssetId) return;
    let active = true;
    let url: string | null = null;
    void getVideoBlob(videoAssetId).then((blob) => {
      if (!active) return;
      if (!blob) { setError("Video file is missing."); return; }
      url = URL.createObjectURL(blob);
      setVideoUrl(url);
    }).catch(() => { if (active) setError("Couldn't load video."); });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
      setVideoUrl(null);
    };
  }, [videoAssetId]);

  if (state.status !== "ready") {
    return <main className="grid min-h-dvh place-items-center bg-bg-canvas p-5 text-text-secondary">
      {state.status === "loading" ? "Loading video…" : state.status === "missing" ? "Video not found." : "Couldn't load video."}
      <Link href={returnHref} className="ui-control mt-4 min-h-10 px-4">Return to library</Link>
    </main>;
  }

  const item = state.item;
  const tags = resolveItemTags(item, new Map(state.tags.map((tag) => [tag.id, tag])));
  const collections = resolveItemCollections(item, new Map(state.collections.map((collection) => [collection.id, collection])));
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
    setBusy(true); setError(null);
    try { await action(); } catch { setError("Couldn't update video organization."); }
    finally { setBusy(false); }
  };

  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-canvas text-text-primary">
    <main className="ui-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="item-page-scroll">
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={returnHref} className="ui-control inline-flex min-h-11 items-center gap-2 px-3 text-sm"><ArrowLeftIcon />Library</Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ui-control inline-flex min-h-11 items-center gap-2 px-3 text-sm" onClick={() => { setEditError(null); setEditing(true); }}><EditIcon />Edit details</button>
          <button type="button" className="ui-control inline-flex min-h-11 items-center gap-2 px-3 text-sm" onClick={() => setOrganizerOpen(true)}><LayersIcon />Organize</button>
          <button type="button" className="ui-control inline-flex min-h-11 items-center gap-2 px-3 text-sm text-text-danger" onClick={() => setDeleteOpen(true)}><DeleteIcon />Delete</button>
        </div>
      </div>
      <h1 className="mb-5 text-2xl font-semibold">{item.title}</h1>
      <div className="overflow-hidden rounded-control border border-border-control bg-bg-media">
        {videoUrl ? <video aria-label={item.title} src={videoUrl} poster={poster ?? undefined} controls preload="metadata" playsInline className="mx-auto max-h-[75vh] w-full" onError={() => setError("This browser couldn't play the saved video.")} />
          : <div className="grid aspect-video place-items-center text-text-secondary"><VideoIcon />Loading video…</div>}
      </div>
      {item.noteContent?.trim() ? <article aria-labelledby="video-notes-heading" className="mx-auto mt-8 w-full max-w-3xl border-t border-border-control pb-20 pt-8 sm:mt-10 sm:pb-24 sm:pt-10">
        <h2 id="video-notes-heading" className="text-2xl font-semibold leading-tight text-text-primary">Notes</h2>
        <NoteContent content={item.noteContent} format={item.noteFormat === "markdown" ? "markdown" : "plain"} className="mt-5 text-text-primary" />
      </article> : null}
      <p className="mt-4 text-sm text-text-secondary">{item.sourceFileName}</p>
      {collections.length || tags.length ? <p className="mt-2 text-sm text-text-secondary">{[...collections, ...tags].map((entry) => entry.name).join(" · ")}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-text-danger">{error}</p> : null}
    </div>
    </main>
    {editing ? <VideoItemEditDialog item={item} open busy={busy} error={editError} onSave={(draft) => void saveDetails(draft)} onOpenChange={setEditing} /> : null}
    <ItemOrganizerDrawer open={organizerOpen} onOpenChange={setOrganizerOpen} side="right" itemTitle={item.title}
      tags={tags} collections={collections} tagSuggestions={state.tags.map((tag) => ({ id: tag.id, name: tag.name }))}
      collectionSuggestions={state.collections.map((collection) => ({ id: collection.id, name: collection.name }))}
      disabled={busy} pendingTag={busy} pendingCollection={busy} tagError={error} collectionError={error}
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
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete video" description={`Delete “${item.title}” from this browser?`}
      confirmLabel="Delete video" busy={busy} error={error} onConfirm={() => {
        setBusy(true); setError(null);
        void deleteItem(itemId).then(() => { window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT)); router.push(returnHref); })
          .catch(() => setError("Couldn't delete video."))
          .finally(() => setBusy(false));
      }} />
  </div>;
}
