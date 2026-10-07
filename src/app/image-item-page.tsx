"use client";

import { ScrollPanel } from "@/components/ui/scroll-panel";

import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { itemActionLabel } from "@/domain/item-label";
import { clampImageSlideIndex, assertLocalImageFile, ImageValidationError, type ImageItem } from "@/domain/image";
import {
  resolveItemCollections,
  resolveItemTags,
} from "@/domain/item";
import { CollectionValidationError, type Collection } from "@/domain/collection";
import { TagValidationError, type Tag } from "@/domain/tag";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createCollection, listCollections } from "@/persistence/collections";
import {
  appendImageAssetsToItem,
  assignCollectionToItem,
  clearCollectionOnItem,
  assignTagToItem,
  deleteItem,
  getItem,
  removeImageAssetAtIndex,
  replaceImageAssetAtIndex,
  unassignTagFromItem,
  updateImage,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import {
  ImageItemEditDialog,
  type ImageDetailsDraft,
} from "./item-edit-dialog";
import { ItemLibraryDetails } from "./item-library-details";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { LibraryItemMedia } from "./library-item-media";
import { ItemViewTransition } from "./item-view-transition";
import { NoteContent } from "./note-content";
import { VerticalImageGallery } from "./vertical-image-gallery";
import { ImageToolsPanel } from "./image-tools-panel";
import { ItemPageHeader } from "./item-page-header";
import { ItemPageLoading } from "./library-loading-content";
import { ITEM_DETAILS_POSITION, ITEM_PAGE_GRID, ITEM_PAGE_SCROLL, ITEM_DETAILS_CONTROL } from "./item-page-styles";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  DeleteIcon,
  FullScreenIcon,
  PlusIcon,
  ImageIcon,
  MoreIcon,
} from "./shell-icons";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | {
      status: "ready";
      item: ImageItem;
      tags: Tag[];
      collections: Collection[];
    };

import type { ItemNavigationSnapshot } from "./item-navigation-snapshot";

type Props = {
  itemId: string;
  returnHref: string;
  initialSnapshot?: ItemNavigationSnapshot;
};

const CONTROL =
  "ui-control inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium disabled:cursor-default disabled:opacity-40";
const MAX_VISIBLE_GALLERY_PREVIEWS = 15;
type GalleryMode = "slides" | "scroll";

export function ImageItemPage({ itemId, returnHref, initialSnapshot }: Props) {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>(() => initialSnapshot?.item.id === itemId && initialSnapshot.item.type === "image"
    ? { status: "ready", item: initialSnapshot.item, tags: initialSnapshot.tags, collections: initialSnapshot.collections }
    : { status: "loading" });
  const [slide, setSlide] = useState(0);
  const [galleryMode, setGalleryMode] = useState<GalleryMode>("slides");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [galleryMutation, setGalleryMutation] = useState<
    "add" | "replace" | "remove" | null
  >(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [removeImageOpen, setRemoveImageOpen] = useState(false);
  const [removeImageError, setRemoveImageError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [organizerSide, setOrganizerSide] = useState<"left" | "right">("right");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionMutation, setActionMutation] = useState<
    "edit" | "tag" | "collection" | "delete" | null
  >(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const readSnapshot = useCallback(async (): Promise<LoadState> => {
    try {
      const [item, tags, collections] = await Promise.all([
        getItem(itemId),
        listTags(),
        listCollections(),
      ]);
      if (!item || item.type !== "image") {
        return { status: "missing" };
      }
      return { status: "ready", item, tags, collections };
    } catch {
      return { status: "error" };
    }
  }, [itemId]);

  useEffect(() => {
    let cancelled = false;
    const applySnapshot = (next: LoadState) => {
      if (cancelled) return;
      setLoadState(next);
      if (next.status === "ready") {
        setSlide((current) => clampImageSlideIndex(next.item.assetIds, current));
      }
    };
    void readSnapshot().then(applySnapshot);
    const reload = () => void readSnapshot().then(applySnapshot);
    window.addEventListener(ITEMS_CHANGED_EVENT, reload);
    return () => {
      cancelled = true;
      window.removeEventListener(ITEMS_CHANGED_EVENT, reload);
    };
  }, [readSnapshot]);

  useLayoutEffect(() => {
    if (
      loadState.status !== "ready" ||
      loadState.item.assetIds.length < 2 || viewerOpen || galleryMode === "scroll" ||
      editOpen || organizerOpen || removeImageOpen || deleteOpen
    ) return;

    const assetIds = loadState.item.assetIds;
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight") ||
        event.altKey || event.ctrlKey || event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest("input, textarea, select, [contenteditable='true'], [role='menu'], [data-image-tools]"))
      ) return;

      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      setSlide((current) => clampImageSlideIndex(assetIds, current + direction));
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [loadState, viewerOpen, galleryMode, editOpen, organizerOpen, removeImageOpen, deleteOpen]);

  async function addImages(files: File[]) {
    if (loadState.status !== "ready" || galleryMutation || files.length === 0) {
      return;
    }
    setGalleryMutation("add");
    setGalleryError(null);
    try {
      const uploads = [];
      for (const file of files) {
        assertLocalImageFile(file);
        uploads.push({
          bytes: new Uint8Array(await file.arrayBuffer()),
          mimeType: file.type || "application/octet-stream",
        });
      }
      const updated = await appendImageAssetsToItem(itemId, uploads);
      setLoadState({ ...loadState, item: updated });
      setSlide(updated.assetIds.length - 1);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setGalleryError(
        caught instanceof ImageValidationError
          ? `${caught.message} No images were added.`
          : "Couldn't add images. No images were added.",
      );
    } finally {
      setGalleryMutation(null);
    }
  }

  async function replaceImage(file: File) {
    if (loadState.status !== "ready" || galleryMutation) {
      return;
    }
    const currentSlide = clampImageSlideIndex(loadState.item.assetIds, slide);
    setGalleryMutation("replace");
    setGalleryError(null);
    try {
      assertLocalImageFile(file);
      const updated = await replaceImageAssetAtIndex(itemId, currentSlide, {
        bytes: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type || "application/octet-stream",
      });
      setLoadState({ ...loadState, item: updated });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setGalleryError(
        caught instanceof ImageValidationError
          ? caught.message
          : "Couldn't replace image.",
      );
    } finally {
      setGalleryMutation(null);
    }
  }

  async function removeCurrentImage() {
    if (loadState.status !== "ready" || galleryMutation) {
      return;
    }
    const currentSlide = clampImageSlideIndex(loadState.item.assetIds, slide);
    setGalleryMutation("remove");
    setRemoveImageError(null);
    try {
      const updated = await removeImageAssetAtIndex(itemId, currentSlide);
      setLoadState({ ...loadState, item: updated });
      setSlide(clampImageSlideIndex(updated.assetIds, currentSlide));
      setRemoveImageOpen(false);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setRemoveImageError(
        caught instanceof ImageValidationError
          ? caught.message
          : "Couldn't remove this image.",
      );
    } finally {
      setGalleryMutation(null);
    }
  }

  function applyItemUpdate(item: ImageItem) {
    setLoadState((current) =>
      current.status === "ready" ? { ...current, item } : current,
    );
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
  }

  async function saveDetails(draft: ImageDetailsDraft) {
    if (actionMutation) return;
    setActionMutation("edit");
    setEditError(null);
    try {
      const updated = await updateImage(itemId, draft);
      applyItemUpdate(updated);
      setEditOpen(false);
    } catch (caught) {
      setEditError(
        caught instanceof ImageValidationError
          ? caught.message
          : "Couldn't save image details.",
      );
    } finally {
      setActionMutation(null);
    }
  }

  async function addTag(name: string) {
    if (actionMutation) return;
    setActionMutation("tag");
    setTagError(null);
    try {
      const tag = await createTag({ name });
      const updated = await assignTagToItem(itemId, tag.id);
      if (updated.type !== "image") throw new Error("Image not found");
      setLoadState((current) =>
        current.status === "ready"
          ? {
              ...current,
              item: updated,
              tags: current.tags.some((entry) => entry.id === tag.id)
                ? current.tags
                : [...current.tags, tag],
            }
          : current,
      );
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setTagError(
        caught instanceof TagValidationError
          ? caught.message
          : "Couldn't add tag.",
      );
    } finally {
      setActionMutation(null);
    }
  }

  async function removeTag(tagId: string) {
    if (actionMutation) return;
    setActionMutation("tag");
    setTagError(null);
    try {
      const updated = await unassignTagFromItem(itemId, tagId);
      if (updated.type !== "image") throw new Error("Image not found");
      applyItemUpdate(updated);
    } catch {
      setTagError("Couldn't remove tag.");
    } finally {
      setActionMutation(null);
    }
  }

  async function moveToUnsorted() {
    if (actionMutation) return;
    setActionMutation("collection");
    setCollectionError(null);
    try {
      const updated = await clearCollectionOnItem(itemId);
      if (updated.type !== "image") throw new Error("Item not found");
      applyItemUpdate(updated);
    } catch {
      setCollectionError("Couldn't move to Unsorted.");
    } finally {
      setActionMutation(null);
    }
  }

  async function moveToCollection(name: string) {
    if (actionMutation) return;
    setActionMutation("collection");
    setCollectionError(null);
    try {
      const collection = await createCollection({ name });
      const updated = await assignCollectionToItem(itemId, collection.id);
      if (updated.type !== "image") throw new Error("Image not found");
      setLoadState((current) =>
        current.status === "ready"
          ? {
              ...current,
              item: updated,
              collections: current.collections.some(
                (entry) => entry.id === collection.id,
              )
                ? current.collections
                : [...current.collections, collection],
            }
          : current,
      );
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setCollectionError(
        caught instanceof CollectionValidationError
          ? caught.message
          : "Couldn't move item.",
      );
    } finally {
      setActionMutation(null);
    }
  }

  async function confirmDelete() {
    if (actionMutation) return;
    setActionMutation("delete");
    setDeleteError(null);
    try {
      await deleteItem(itemId);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      router.push(returnHref);
    } catch {
      setDeleteError("Couldn't move item to Trash.");
    } finally {
      setActionMutation(null);
    }
  }

  if (loadState.status === "loading") {
    return <ItemPageLoading returnHref={returnHref} />;
  }

  if (loadState.status === "error") {
    return (
      <ItemPageMessage
        title="Couldn't load this image"
        message="Keepall could not read the item from browser storage."
        returnHref={returnHref}
      />
    );
  }

  if (loadState.status === "missing") {
    return (
      <ItemPageMessage
        title="Image not found"
        message="It may have been deleted, or this URL belongs to another browser profile."
        returnHref={returnHref}
      />
    );
  }

  return (
    <>
      <ImageWorkspace
        key={loadState.item.id}
        loadingReveal={!initialSnapshot}
        item={loadState.item}
        tags={loadState.tags}
        collections={loadState.collections}
        returnHref={returnHref}
        slide={slide}
        galleryMode={galleryMode}
        onGalleryModeChange={setGalleryMode}
        readingPaused={viewerOpen || editOpen || organizerOpen || removeImageOpen || deleteOpen || galleryMutation !== null}
        viewerOpen={viewerOpen}
        onSlideChange={setSlide}
        onViewerOpenChange={setViewerOpen}
        galleryMutation={galleryMutation}
        galleryError={galleryError}
        actionBusy={actionMutation !== null || galleryMutation !== null}
        onAddImages={(files) => void addImages(files)}
        onReplaceImage={(file) => void replaceImage(file)}
        onRemoveImage={() => {
          setRemoveImageError(null);
          setRemoveImageOpen(true);
        }}
        onEdit={() => {
          setEditError(null);
          setEditOpen(true);
        }}
        onOrganize={() => {
          setTagError(null);
          setCollectionError(null);
          setOrganizerSide(
            document.documentElement.dir === "rtl" ? "left" : "right",
          );
          setOrganizerOpen(true);
        }}
        onDelete={() => {
          setDeleteError(null);
          setDeleteOpen(true);
        }}
      />

      {editOpen ? (
        <ImageItemEditDialog
          item={loadState.item}
          open
          busy={actionMutation === "edit"}
          error={editError}
          onSave={(draft) => void saveDetails(draft)}
          onOpenChange={setEditOpen}
        />
      ) : null}

      <ItemOrganizerDrawer
        open={organizerOpen}
        onOpenChange={setOrganizerOpen}
        side={organizerSide}
        itemTitle={itemActionLabel(loadState.item)}
        tags={resolveItemTags(
          loadState.item,
          new Map(loadState.tags.map((tag) => [tag.id, tag])),
        )}
        collections={resolveItemCollections(
          loadState.item,
          new Map(
            loadState.collections.map((collection) => [collection.id, collection]),
          ),
        )}
        tagSuggestions={loadState.tags.filter(
          (tag) => !loadState.item.tagIds.includes(tag.id),
        )}
        collectionSuggestions={loadState.collections.filter(
          (collection) =>
            !loadState.item.collectionIds.includes(collection.id),
        )}
        disabled={actionMutation !== null}
        pendingTag={actionMutation === "tag"}
        pendingCollection={actionMutation === "collection"}
        tagError={tagError}
        collectionError={collectionError}
        onAddTag={(name) => void addTag(name)}
        onRemoveTag={(tagId) => void removeTag(tagId)}
        onMoveToCollection={(name) => void moveToCollection(name)}
        onMoveToUnsorted={() => void moveToUnsorted()}
      />

      <ConfirmDialog
        open={removeImageOpen}
        title="Remove this image?"
        description={`Remove image ${clampImageSlideIndex(loadState.item.assetIds, slide) + 1} from “${itemActionLabel(loadState.item)}”? The other images will remain.`}
        confirmLabel="Remove image"
        pendingLabel="Removing…"
        busy={galleryMutation === "remove"}
        error={removeImageError}
        onConfirm={() => void removeCurrentImage()}
        onOpenChange={(open) => {
          setRemoveImageOpen(open);
          if (!open) setRemoveImageError(null);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Move this item to Trash?"
        description={`Move “${itemActionLabel(loadState.item)}” to Trash? You can restore it later.`}
        confirmLabel="Move to Trash"
        pendingLabel="Moving…"
        busy={actionMutation === "delete"}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteError(null);
        }}
      />
    </>
  );
}

function ItemPageMessage({
  title,
  message,
  returnHref,
}: {
  title?: string;
  message: string;
  returnHref?: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg-shell p-5">
      <section className="library-panel squircle-panel w-full max-w-lg rounded-panel bg-bg-surface p-8 text-center shadow-panel">
        {title ? <h1 className="text-2xl font-semibold">{title}</h1> : null}
        <p className={title ? "mt-3 text-sm text-text-secondary" : "text-sm text-text-secondary"}>{message}</p>
        {returnHref ? (
          <Link className={`${CONTROL} mt-6`} href={returnHref}>
            Return to library
          </Link>
        ) : null}
      </section>
    </main>
  );
}

function ImageWorkspace({
  loadingReveal,
  item,
  tags,
  collections,
  returnHref,
  slide,
  galleryMode,
  onGalleryModeChange,
  readingPaused,
  viewerOpen,
  onSlideChange,
  onViewerOpenChange,
  galleryMutation,
  galleryError,
  actionBusy,
  onAddImages,
  onReplaceImage,
  onRemoveImage,
  onEdit,
  onOrganize,
  onDelete,
}: {
  loadingReveal: boolean;
  item: ImageItem;
  tags: Tag[];
  collections: Collection[];
  returnHref: string;
  slide: number;
  galleryMode: GalleryMode;
  onGalleryModeChange: (mode: GalleryMode) => void;
  readingPaused: boolean;
  viewerOpen: boolean;
  onSlideChange: (slide: number) => void;
  onViewerOpenChange: (open: boolean) => void;
  galleryMutation: "add" | "replace" | "remove" | null;
  galleryError: string | null;
  actionBusy: boolean;
  onAddImages: (files: File[]) => void;
  onReplaceImage: (file: File) => void;
  onRemoveImage: () => void;
  onEdit: () => void;
  onOrganize: () => void;
  onDelete: () => void;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const galleryListRef = useRef<HTMLOListElement>(null);
  const readingPosition = useRef<{ assetId: string; offset: number } | null>(null);
  const viewerStartAsset = useRef<string | null>(null);
  const gallerySignature = item.assetIds.join(",");
  const previousView = useRef({ galleryMode, viewerOpen, gallerySignature });
  const currentSlide = clampImageSlideIndex(item.assetIds, slide);
  const currentAssetId = item.assetIds[currentSlide] ?? null;
  const title = item.title.trim();
  const tagsById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );
  const collectionsById = useMemo(
    () => new Map(collections.map((collection) => [collection.id, collection])),
    [collections],
  );
  const itemTags = resolveItemTags(item, tagsById);
  const itemCollections = resolveItemCollections(item, collectionsById);

  function preserveScrollAnchor() {
    const row = galleryListRef.current?.children[currentSlide];
    const container = scrollRef.current;
    const top = row?.getBoundingClientRect().top ?? 0;
    // A nearby original may be much taller than its unloaded placeholder.
    return () => {
      if (container && row?.isConnected) container.scrollTop += row.getBoundingClientRect().top - top;
    };
  }

  function rememberReadingPosition() {
    if (galleryMode !== "scroll" || readingPaused) return;
    const container = scrollRef.current;
    const rows = galleryListRef.current?.children;
    if (!container || !rows?.length) return;
    const readingLine = container.getBoundingClientRect().top + 12;
    const atBottom = container.scrollHeight - container.clientHeight - container.scrollTop <= 1;
    const row = (atBottom ? null : Array.from(rows).find(row => row.getBoundingClientRect().bottom > readingLine)) ?? rows[rows.length - 1];
    const index = Number(row.getAttribute("data-gallery-index"));
    readingPosition.current = { assetId: item.assetIds[index], offset: Math.max(0, readingLine - row.getBoundingClientRect().top) };
    if (index !== currentSlide) onSlideChange(index);
  }

  useLayoutEffect(() => {
    const previous = previousView.current;
    previousView.current = { galleryMode, viewerOpen, gallerySignature };
    const switched = previous.galleryMode !== galleryMode;
    const closedViewer = previous.viewerOpen && !viewerOpen;
    const changedImages = previous.gallerySignature !== gallerySignature;
    const container = scrollRef.current;
    if (!container || (!switched && !closedViewer && !changedImages)) return;
    if (galleryMode === "slides") {
      if (switched) container.scrollTop = 0;
      return;
    }
    const saved = readingPosition.current;
    if (closedViewer && viewerStartAsset.current === currentAssetId) return;
    const row = galleryListRef.current?.children[currentSlide];
    if (!row) return;
    const offset = saved?.assetId === currentAssetId ? saved.offset : 0;
    container.scrollTop += row.getBoundingClientRect().top - container.getBoundingClientRect().top - 12 + offset;
  }, [galleryMode, viewerOpen, currentSlide, currentAssetId, gallerySignature]);

  const galleryControls = (
    <div className="grid gap-2">
      <div className="icon-segmented-switch squircle-panel relative isolate flex h-11 w-full rounded-control-lg bg-bg-control p-0.5" role="group" aria-label="Gallery view" data-selected={galleryMode === "scroll" ? "end" : "start"}>
        <span aria-hidden="true" className="icon-segmented-thumb squircle-panel ui-selected pointer-events-none absolute left-0.5 top-0.5 h-10 w-[calc(50%_-_2px)] rounded-control-sm" />
        {(["slides", "scroll"] as const).map(mode => (
          <button key={mode} type="button" aria-label={`${mode === "slides" ? "Slides" : "Scroll"} view`}
            aria-pressed={galleryMode === mode}
            className={`squircle-panel relative flex h-10 min-w-0 flex-1 items-center justify-center rounded-control-sm px-2 text-xs font-medium ${galleryMode === mode ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
            onClick={() => onGalleryModeChange(mode)}>
            {mode === "slides" ? "Slides" : "Scroll"}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`${loadingReveal ? "item-startup-content" : ""} h-full overflow-hidden bg-bg-canvas`}>
      <div className="flex size-full flex-col">
        <ItemPageHeader returnHref={returnHref} title={title || "Image item"} sourceUrl={item.sourceUrl} titleAsHeading />

        <ScrollPanel role="main" className="min-h-0 flex-1" viewportRef={node => { scrollRef.current = node; }}
          viewportClassName={`${ITEM_PAGE_SCROLL} scroll-fade scroll-fade-6 [--scroll-fade-t-size:0px] [--scroll-fade-edge-opacity:0.5]`}
          viewportProps={{ onScroll: rememberReadingPosition, "data-testid": "item-page-scroll" }}>
          <div className={`${ITEM_PAGE_GRID} [--image-viewer-height:max(24rem,min(76dvh,54rem))]`}>
                <input
                  ref={addInputRef}
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                  aria-label="Choose images to add"
                  onChange={(event) => {
                    const files = event.target.files;
                    if (files?.length) onAddImages(Array.from(files));
                    event.target.value = "";
                  }}
                />
                <input
                  ref={replaceInputRef}
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                  aria-label="Choose replacement image"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onReplaceImage(file);
                    event.target.value = "";
                  }}
                />
            <div className="contents min-w-0 lg:col-start-1 lg:row-start-1 lg:block">
            <section className="relative row-start-1 flex min-w-0 flex-col gap-3" aria-label="Image gallery">
              {galleryMode === "scroll" ? (
              <div className="sticky top-0 z-10 -mb-3 h-0 self-end">
                <div className="absolute right-4 top-4">
                  <CurrentImageMenu
                    busy={galleryMutation !== null}
                    canRemove={item.assetIds.length > 1}
                    onReplace={() => replaceInputRef.current?.click()}
                    onRemove={onRemoveImage}
                  />
                </div>
              </div>
              ) : null}
              {galleryMode === "slides" ? (
              <ItemViewTransition itemId={item.id} assetId={currentAssetId ?? ""} source={false}>
              <div className="item-workspace-media image-viewer-canvas relative isolate flex h-[var(--image-viewer-height)] items-center justify-center overflow-hidden rounded-card bg-bg-image-viewer">
                <div className="pointer-events-none absolute inset-4 z-10 flex items-start justify-end">
                  <CurrentImageMenu
                    busy={galleryMutation !== null}
                    canRemove={item.assetIds.length > 1}
                    onReplace={() => replaceInputRef.current?.click()}
                    onRemove={onRemoveImage}
                  />
                </div>
                <button
                  type="button"
                  className="control-shape-none image-viewer-trigger group relative flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden p-3 sm:p-5"
                  aria-label="View image full screen"
                  onClick={() => onViewerOpenChange(true)}
                >
                  <LibraryItemMedia
                    item={item}
                    variant="canvas"
                    assetId={currentAssetId}
                    sharedTransition={false}
                  />
                  <span className="ui-control pointer-events-none absolute bottom-3 right-3 flex size-11 items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <FullScreenIcon />
                  </span>
                </button>
                {item.assetIds.length > 1 ? (
                  <>
                    <button
                      className={`${CONTROL} absolute left-4 top-1/2 z-10 -translate-y-1/2 bg-bg-surface/95 backdrop-blur-sm`}
                      type="button"
                      aria-label="Previous image"
                      disabled={currentSlide === 0}
                      onClick={() => onSlideChange(currentSlide - 1)}
                    >
                      <ArrowLeftIcon />
                    </button>
                    <button
                      className={`${CONTROL} absolute right-4 top-1/2 z-10 -translate-y-1/2 bg-bg-surface/95 backdrop-blur-sm`}
                      type="button"
                      aria-label="Next image"
                      disabled={currentSlide === item.assetIds.length - 1}
                      onClick={() => onSlideChange(currentSlide + 1)}
                    >
                      <ArrowRightIcon />
                    </button>
                  </>
                ) : null}
              </div>
              </ItemViewTransition>

              ) : null}
              {galleryMode === "slides" ? (
                <GalleryControls
                  item={item}
                  currentSlide={currentSlide}
                  onSlideChange={onSlideChange}
                />
              ) : null}
              <VerticalImageGallery
                item={item}
                active={galleryMode === "scroll"}
                listRef={galleryListRef}
                scrollRef={scrollRef}
                preserveScrollAnchor={preserveScrollAnchor}
                onOpen={(index) => {
                  viewerStartAsset.current = item.assetIds[index];
                  onSlideChange(index);
                  onViewerOpenChange(true);
                }}
              />
              {galleryMode === "scroll" ? (
                <div className="sticky bottom-0 z-10 flex justify-end bg-bg-canvas py-3">
                  <ImageCount current={currentSlide + 1} total={item.assetIds.length} />
                </div>
              ) : null}
              {galleryError ? <p className="text-sm text-text-danger" role="alert">{galleryError}</p> : null}
            </section>

            {item.caption ? (
              <article
                className="row-start-3 mt-8 w-full border-t border-border-control pb-20 pt-8 sm:mt-10 sm:pb-24 sm:pt-10"
                aria-labelledby="image-notes-heading"
              >
                <h2 id="image-notes-heading" className="text-2xl font-semibold leading-tight text-text-primary">
                  Notes
                </h2>
                <NoteContent content={item.caption} format={item.captionFormat === "markdown" ? "markdown" : "plain"} className="mt-5 text-text-primary" />
              </article>
            ) : null}
            </div>

            <ItemLibraryDetails
              label="Image details"
              controls={galleryControls}
              summary={{ label: "Contents", value: `${item.assetIds.length} ${item.assetIds.length === 1 ? "image" : "images"} · ${item.caption?.trim() ? "Notes added" : "No notes"}` }}
              collections={itemCollections}
              tags={itemTags}
              createdAt={item.createdAt}
              updatedAt={item.updatedAt}
              sourceFileName={item.sourceFileName}
              className={`${ITEM_DETAILS_POSITION} max-lg:row-start-2 lg:min-h-[var(--image-viewer-height)]`}
              disabled={actionBusy}
              onOrganize={onOrganize}
              onEdit={onEdit}
              onDelete={onDelete}
              mediaAction={
                <button className={ITEM_DETAILS_CONTROL} type="button" aria-label={galleryMutation === "add" ? "Adding images" : "Add images"} title="Add images" disabled={galleryMutation !== null} onClick={() => addInputRef.current?.click()}>
                  <PlusIcon className="size-4" />
                  <span>{galleryMutation === "add" ? "Adding…" : "Add images"}</span>
                </button>
              }
            >
              {currentAssetId ? <ImageToolsPanel key={currentAssetId} item={item} assetId={currentAssetId} slide={currentSlide} disabled={actionBusy} /> : null}
            </ItemLibraryDetails>
          </div>
        </ScrollPanel>
      </div>

      <FocusedImageViewer
        item={item}
        assetId={currentAssetId}
        open={viewerOpen}
        currentSlide={currentSlide}
        slideCount={item.assetIds.length}
        onOpenChange={onViewerOpenChange}
        onSlideChange={onSlideChange}
      />
    </div>
  );
}

function CurrentImageMenu({ busy, canRemove, onReplace, onRemove }: {
  busy: boolean;
  canRemove: boolean;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const openingDialog = useRef(false);
  return (
    <Menu.Root modal={false} onOpenChange={(open) => { if (open) openingDialog.current = false; }}>
      <Menu.Trigger className="ui-control pointer-events-auto flex size-11 items-center justify-center bg-bg-surface disabled:opacity-60" aria-label="Current image actions" title="Current image actions" disabled={busy}>
        <MoreIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} collisionPadding={8} positionMethod="fixed" className="z-[60] data-[anchor-hidden]:invisible">
          <Menu.Popup aria-label="Current image actions" className="ui-menu-popup ui-popover w-56 max-w-[calc(100vw-1rem)] outline-none" finalFocus={() => openingDialog.current ? false : true}>
            <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active data-[disabled]:opacity-50" disabled={busy} onClick={onReplace}>
              <ImageIcon />Replace current image
            </Menu.Item>
            {canRemove ? (
              <>
                <Menu.Separator className="my-1 border-t border-border-edge" />
                <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-danger outline-none data-[highlighted]:bg-bg-danger data-[disabled]:opacity-50" disabled={busy} onClick={() => { openingDialog.current = true; onRemove(); }}>
                  <DeleteIcon />Remove current image
                </Menu.Item>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ImageCount({ current, total, className = "" }: { current: number; total: number; className?: string }) {
  return (
    <span className={`inline-flex h-12 min-w-16 shrink-0 items-center justify-center rounded-[24px] border border-border-control bg-bg-control px-3 tabular-nums [corner-shape:var(--corner-shape-panel)] ${className}`} aria-label="Current image" title={`Image ${current} of ${total}`}>
      <span className="sr-only">Image {current} of {total}</span>
      <span aria-hidden="true" className="flex items-baseline gap-1.5 text-sm">
        <span className="font-semibold text-text-primary">{current}</span>
        <span className="text-text-secondary">/</span>
        <span className="font-medium text-text-secondary">{total}</span>
      </span>
    </span>
  );
}

function GalleryControls({
  item,
  currentSlide,
  onSlideChange,
}: {
  item: ImageItem;
  currentSlide: number;
  onSlideChange: (slide: number) => void;
}) {
  const slideCount = item.assetIds.length;
  const visibleCount = Math.min(slideCount, MAX_VISIBLE_GALLERY_PREVIEWS);
  const firstVisibleSlide = Math.max(
    0,
    Math.min(
      currentSlide - Math.floor(visibleCount / 2),
      slideCount - visibleCount,
    ),
  );
  const visibleSlides = Array.from(
    { length: visibleCount },
    (_, index) => firstVisibleSlide + index,
  );

  return (
    <nav className="flex h-14 min-w-0 shrink-0 items-center gap-3" aria-label="Image slides">
      {slideCount > 1 ? <div className="ui-scrollbar-hidden scroll-fade-x flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto p-1 sm:gap-2">
        {visibleSlides.map((index) => (
          <button
            key={index}
            type="button"
            className={`control-shape-none h-12 min-w-6 flex-1 overflow-hidden rounded-[24px] border p-0.5 [corner-shape:var(--corner-shape-panel)] sm:min-w-10 sm:max-w-16 ${index === currentSlide ? "border-border-selected bg-bg-selected" : "border-border-control bg-bg-control"}`}
            aria-label={`Show image ${index + 1}`}
            aria-current={index === currentSlide ? "true" : undefined}
            onClick={() => onSlideChange(index)}
          >
            <LibraryItemMedia
              item={item}
              variant="card"
              assetId={item.assetIds[index]}
              compact
              className="[corner-shape:var(--corner-shape-panel)]"
            />
          </button>
        ))}
      </div> : null}
      <ImageCount current={currentSlide + 1} total={slideCount} className="ms-auto" />
    </nav>
  );
}

function FocusedImageViewer({
  item,
  assetId,
  open,
  currentSlide,
  slideCount,
  onOpenChange,
  onSlideChange,
}: {
  item: ImageItem;
  assetId: string | null;
  open: boolean;
  currentSlide: number;
  slideCount: number;
  onOpenChange: (open: boolean) => void;
  onSlideChange: (slide: number) => void;
}) {
  const [zoom, setZoom] = useState<{ width: number; x: number; y: number; clientX: number; clientY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const beforeZoom = useRef<{ left: number; top: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const dragged = useRef(false);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const button = imageButtonRef.current;
    if (!viewport || !button) return;
    if (zoom) {
      const bounds = button.getBoundingClientRect();
      viewport.scrollLeft += bounds.left + bounds.width * zoom.x - zoom.clientX;
      viewport.scrollTop += bounds.top + bounds.height * zoom.y - zoom.clientY;
    } else if (beforeZoom.current) {
      viewport.scrollLeft = beforeZoom.current.left;
      viewport.scrollTop = beforeZoom.current.top;
      beforeZoom.current = null;
    }
  }, [zoom]);

  function changeSlide(next: number) {
    beforeZoom.current = null;
    setZoom(null);
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
    onSlideChange(next);
  }

  function toggleZoom(event: React.MouseEvent<HTMLButtonElement>) {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (zoom) {
      setZoom(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewport = viewportRef.current;
    if (!viewport || !bounds.width) return;
    const clientX = event.detail === 0 ? (Math.max(0, bounds.left) + Math.min(bounds.right, viewport.clientWidth)) / 2 : event.clientX;
    const clientY = event.detail === 0 ? (Math.max(0, bounds.top) + Math.min(bounds.bottom, viewport.clientHeight)) / 2 : event.clientY;
    beforeZoom.current = { left: viewport.scrollLeft, top: viewport.scrollTop };
    setZoom({
      width: bounds.width * 2,
      x: Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
      clientX,
      clientY,
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setZoom(null);
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="focused-image-backdrop fixed inset-0 z-[90]" data-zoomed={zoom !== null} />
        <Dialog.Viewport
          className="fixed inset-0 z-[90] overflow-hidden"
        >
          <ScrollPanel orientation="both" className="size-full" viewportRef={node => { viewportRef.current = node; }}
            viewportClassName="p-2 sm:p-5" contentClassName="min-h-full" viewportProps={{ "data-testid": "focused-image-scroll" }}>
          <Dialog.Popup
            className={`relative mx-auto grid min-h-full place-items-center outline-none ${zoom ? "w-max min-w-full" : "w-full max-w-[100rem]"}`}
            onKeyDownCapture={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey || slideCount < 2) return;
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              event.stopPropagation();
              changeSlide(clampImageSlideIndex(
                item.assetIds,
                currentSlide + (event.key === "ArrowRight" ? 1 : -1),
              ));
            }}
          >
            <Dialog.Title className="sr-only">Focused image viewer</Dialog.Title>
            <button
              ref={imageButtonRef}
              type="button"
              className={`control-shape-none mx-auto block p-0 focus-visible:outline-1 focus-visible:outline-border-focus ${zoom ? "cursor-grab active:cursor-grabbing" : "w-fit max-w-full cursor-zoom-in"}`}
              style={zoom ? { width: zoom.width } : undefined}
              aria-label={zoom ? "Zoom out image" : "Zoom in image"}
              aria-pressed={zoom !== null}
              onClick={toggleZoom}
              onDragStart={event => event.preventDefault()}
              onPointerDown={event => {
                dragged.current = false;
                const viewport = viewportRef.current;
                if (!zoom || !viewport || event.pointerType !== "mouse" || event.button !== 0) return;
                drag.current = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={event => {
                const start = drag.current;
                const viewport = viewportRef.current;
                if (!start || !viewport) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                if (Math.hypot(dx, dy) > 4) dragged.current = true;
                if (dragged.current) {
                  viewport.scrollLeft = start.left - dx;
                  viewport.scrollTop = start.top - dy;
                }
              }}
              onPointerUp={event => {
                drag.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => { drag.current = null; }}
            >
              <LibraryItemMedia item={item} variant="viewer" assetId={assetId} className={zoom ? "!w-full" : "max-h-[calc(100dvh-5rem)] object-contain"} />
            </button>
            <Dialog.Close className={`${CONTROL} fixed right-3 top-3 z-10 bg-bg-surface/95 backdrop-blur-sm`} aria-label="Close full-screen image">
              <CloseIcon />
            </Dialog.Close>
            {zoom ? (
              <button className={`${CONTROL} fixed left-3 top-3 z-10 bg-bg-surface/95 backdrop-blur-sm`} type="button" onClick={() => setZoom(null)}>
                Zoom out
              </button>
            ) : null}
            {slideCount > 1 ? (
              <>
                <button className="ui-control fixed left-3 top-1/2 z-10 flex size-14 -translate-y-1/2 items-center justify-center bg-bg-surface/95 backdrop-blur-sm disabled:cursor-default disabled:opacity-40" type="button" aria-label="Previous full-screen image" disabled={currentSlide === 0} onClick={() => changeSlide(currentSlide - 1)}>
                  <ArrowLeftIcon className="size-6" />
                </button>
                <button className="ui-control fixed right-3 top-1/2 z-10 flex size-14 -translate-y-1/2 items-center justify-center bg-bg-surface/95 backdrop-blur-sm disabled:cursor-default disabled:opacity-40" type="button" aria-label="Next full-screen image" disabled={currentSlide === slideCount - 1} onClick={() => changeSlide(currentSlide + 1)}>
                  <ArrowRightIcon className="size-6" />
                </button>
              </>
            ) : null}
            <p className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 rounded-control bg-bg-overlay/70 px-3 py-2 text-sm tabular-nums text-text-on-media" aria-label={`Image ${currentSlide + 1} of ${slideCount}`}>
              {currentSlide + 1} / {slideCount}
            </p>
          </Dialog.Popup>
          </ScrollPanel>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
