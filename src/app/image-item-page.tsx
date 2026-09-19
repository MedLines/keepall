"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampImageSlideIndex, ImageValidationError, type ImageItem } from "@/domain/image";
import {
  itemListTitle,
  resolveItemCollections,
  resolveItemTags,
} from "@/domain/item";
import { CollectionValidationError, type Collection } from "@/domain/collection";
import { TagValidationError, type Tag } from "@/domain/tag";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createCollection, listCollections } from "@/persistence/collections";
import {
  appendImageAssetToItem,
  assignCollectionToItem,
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
} from "./image-item-edit-dialog";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { LibraryItemMedia } from "./library-item-media";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  FullScreenIcon,
  LayersIcon,
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

type Props = {
  itemId: string;
  returnHref: string;
};

const CONTROL =
  "ui-control inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium disabled:cursor-default disabled:opacity-40";
const MAX_VISIBLE_GALLERY_PREVIEWS = 15;

export function ImageItemPage({ itemId, returnHref }: Props) {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [slide, setSlide] = useState(0);
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

  async function addImages(files: File[]) {
    if (loadState.status !== "ready" || galleryMutation || files.length === 0) {
      return;
    }
    setGalleryMutation("add");
    setGalleryError(null);
    try {
      let updated = loadState.item;
      for (const file of files) {
        updated = await appendImageAssetToItem(itemId, {
          bytes: new Uint8Array(await file.arrayBuffer()),
          mimeType: file.type || "application/octet-stream",
        });
      }
      setLoadState({ ...loadState, item: updated });
      setSlide(updated.assetIds.length - 1);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setGalleryError(
        caught instanceof ImageValidationError
          ? caught.message
          : "Couldn't add images.",
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
      setDeleteError("Couldn't delete item.");
    } finally {
      setActionMutation(null);
    }
  }

  if (loadState.status === "loading") {
    return <ItemPageMessage message="Loading image…" />;
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
        item={loadState.item}
        tags={loadState.tags}
        collections={loadState.collections}
        returnHref={returnHref}
        slide={slide}
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
        itemTitle={itemListTitle(loadState.item)}
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
      />

      <ConfirmDialog
        open={removeImageOpen}
        title="Remove this image?"
        description={`Remove image ${clampImageSlideIndex(loadState.item.assetIds, slide) + 1} from “${itemListTitle(loadState.item)}”? The other images will remain.`}
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
        title="Delete this item?"
        description={`Delete “${itemListTitle(loadState.item)}”? This cannot be undone.`}
        confirmLabel="Confirm delete"
        pendingLabel="Deleting…"
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
  item,
  tags,
  collections,
  returnHref,
  slide,
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
  item: ImageItem;
  tags: Tag[];
  collections: Collection[];
  returnHref: string;
  slide: number;
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

  return (
    <div className="h-full overflow-hidden bg-bg-canvas">
      <div className="flex size-full flex-col">
        <header className="shrink-0 border-b border-border-control">
          <div className="mx-auto flex min-h-16 w-full max-w-[100rem] items-center gap-3 px-3 sm:px-5">
            <Link className={CONTROL} href={returnHref} aria-label="Back to library">
              <ArrowLeftIcon />
              <span className="hidden sm:inline">Library</span>
            </Link>
            {title ? (
              <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary sm:text-lg">
                {title}
              </h1>
            ) : (
              <h1 className="sr-only">Image item</h1>
            )}
            <div className="ms-auto flex shrink-0 items-center gap-2" aria-label="Item actions">
              <button
                className={CONTROL}
                type="button"
                aria-label="Edit details"
                disabled={actionBusy}
                onClick={onEdit}
              >
                <EditIcon />
                <span className="hidden xl:inline">Edit</span>
              </button>
              <button
                className={CONTROL}
                type="button"
                aria-label="Organize"
                disabled={actionBusy}
                onClick={onOrganize}
              >
                <LayersIcon />
                <span className="hidden xl:inline">Organize</span>
              </button>
              <button
                className={`${CONTROL} text-text-danger`}
                type="button"
                aria-label="Delete item"
                disabled={actionBusy}
                onClick={onDelete}
              >
                <DeleteIcon />
              </button>
            </div>
          </div>
        </header>

        <main
          className="ui-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
          data-testid="item-page-scroll"
        >
          <div className="mx-auto grid w-full max-w-[100rem] items-start gap-6 px-3 pb-8 pt-4 sm:px-5 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-0">
            <div className="min-w-0">
            <section className="flex min-w-0 flex-col gap-3" aria-label="Image gallery">
              <div className="item-workspace-media relative flex h-[min(76dvh,54rem)] min-h-[24rem] items-center justify-center overflow-hidden rounded-card bg-bg-media">
                <button
                  type="button"
                  className="group relative flex size-full min-h-0 items-center justify-center overflow-hidden"
                  aria-label="View image full screen"
                  onClick={() => onViewerOpenChange(true)}
                >
                  <LibraryItemMedia
                    item={item}
                    variant="inspect"
                    assetId={currentAssetId}
                    className="max-h-[calc(100dvh-14rem)]"
                  />
                  <span className="ui-control pointer-events-none absolute right-3 top-3 flex size-11 items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
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

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <GalleryControls
                  item={item}
                  currentSlide={currentSlide}
                  onSlideChange={onSlideChange}
                />
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
                <div className="flex shrink-0 gap-2 sm:ms-auto">
                  <button className={CONTROL} type="button" disabled={galleryMutation !== null} onClick={() => addInputRef.current?.click()}>
                    {galleryMutation === "add" ? "Adding…" : "Add images"}
                  </button>
                  <button className={CONTROL} type="button" disabled={galleryMutation !== null} onClick={() => replaceInputRef.current?.click()}>
                    {galleryMutation === "replace" ? "Replacing…" : "Replace"}
                  </button>
                  {item.assetIds.length > 1 ? (
                    <button
                      className={`${CONTROL} text-text-danger`}
                      type="button"
                      aria-label="Remove current image"
                      disabled={galleryMutation !== null}
                      onClick={onRemoveImage}
                    >
                      <DeleteIcon />
                      <span className="hidden xl:inline">Remove</span>
                    </button>
                  ) : null}
                </div>
              </div>
              {galleryError ? <p className="text-sm text-text-danger" role="alert">{galleryError}</p> : null}
            </section>

            {item.caption ? (
              <article
                className="mx-auto mt-8 w-full max-w-3xl border-t border-border-control pb-20 pt-8 sm:mt-10 sm:pb-24 sm:pt-10"
                aria-labelledby="image-notes-heading"
              >
                <h2 id="image-notes-heading" className="text-2xl font-semibold leading-tight text-text-primary">
                  Notes
                </h2>
                <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-text-primary">
                  {item.caption}
                </p>
              </article>
            ) : null}
            </div>

            <aside className="library-panel rounded-panel border border-border-control bg-bg-surface p-5 lg:sticky lg:top-5 lg:ms-6" aria-label="Image details">
            <h2 className="text-base font-semibold text-text-primary">Details</h2>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-text-secondary">
              {item.assetIds.length > 1 ? `${item.assetIds.length} images` : "Image"}
            </p>

            {itemCollections.length ? (
              <DetailGroup title="Collection">
                {itemCollections.map((collection) => (
                  <Link key={collection.id} href={`/?collection=${encodeURIComponent(collection.id)}`} className="ui-control inline-flex min-h-9 items-center px-3 text-sm">
                    {collection.name}
                  </Link>
                ))}
              </DetailGroup>
            ) : null}

            {itemTags.length ? (
              <DetailGroup title="Tags">
                {itemTags.map((tag) => (
                  <Link key={tag.id} href={`/?tag=${encodeURIComponent(tag.id)}`} className="ui-control inline-flex min-h-9 items-center px-3 text-sm">
                    {tag.name}
                  </Link>
                ))}
              </DetailGroup>
            ) : null}

            <dl className="mt-7 grid w-full gap-3 text-sm">
              <div>
                <dt className="text-text-secondary">Saved</dt>
                <dd className="mt-0.5 text-text-primary">{new Date(item.createdAt).toLocaleDateString()}</dd>
              </div>
              {item.sourceFileName ? (
                <div>
                  <dt className="text-text-secondary">Original file</dt>
                  <dd className="mt-0.5 break-all text-text-primary">{item.sourceFileName}</dd>
                </div>
              ) : null}
            </dl>

            {item.sourceUrl ? (
              <a className={`${CONTROL} mt-7 w-full`} href={item.sourceUrl} target="_blank" rel="noreferrer">
                Open source
              </a>
            ) : null}
            </aside>
          </div>
        </main>
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
  if (slideCount <= 1) {
    return null;
  }
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
    <nav className="min-w-0 flex-1" aria-label="Image slides">
      <div className="ui-scrollbar-hidden scroll-fade-x flex min-w-0 items-center justify-start gap-1 overflow-x-auto p-1 sm:gap-2">
        {visibleSlides.map((index) => (
          <button
            key={index}
            type="button"
            className={`squircle-panel h-12 min-w-6 flex-1 overflow-hidden rounded-control-sm border p-1 sm:min-w-10 sm:max-w-16 ${index === currentSlide ? "border-border-selected bg-bg-selected" : "border-border-control bg-bg-control"}`}
            aria-label={`Show image ${index + 1}`}
            aria-current={index === currentSlide ? "true" : undefined}
            onClick={() => onSlideChange(index)}
          >
            <LibraryItemMedia
              item={item}
              variant="card"
              assetId={item.assetIds[index]}
              compact
              className="rounded-[0.5rem]"
            />
          </button>
        ))}
      </div>
    </nav>
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </section>
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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="ui-backdrop fixed inset-0 z-[90]" />
        <Dialog.Viewport
          className="ui-scrollbar fixed inset-0 z-[90] overflow-y-auto p-2 sm:p-5"
          data-testid="focused-image-scroll"
        >
          <Dialog.Popup className="relative mx-auto grid min-h-full w-full max-w-[100rem] place-items-center outline-none">
            <Dialog.Title className="sr-only">Focused image viewer</Dialog.Title>
            <LibraryItemMedia item={item} variant="viewer" assetId={assetId} />
            <Dialog.Close className={`${CONTROL} fixed right-3 top-3 bg-bg-surface/95 backdrop-blur-sm`} aria-label="Close full-screen image">
              <CloseIcon />
            </Dialog.Close>
            {slideCount > 1 ? (
              <>
                <button className={`${CONTROL} fixed left-3 top-1/2 -translate-y-1/2 bg-bg-surface/95 backdrop-blur-sm`} type="button" aria-label="Previous full-screen image" disabled={currentSlide === 0} onClick={() => onSlideChange(currentSlide - 1)}>
                  <ArrowLeftIcon />
                </button>
                <button className={`${CONTROL} fixed right-3 top-1/2 -translate-y-1/2 bg-bg-surface/95 backdrop-blur-sm`} type="button" aria-label="Next full-screen image" disabled={currentSlide === slideCount - 1} onClick={() => onSlideChange(currentSlide + 1)}>
                  <ArrowRightIcon />
                </button>
                <p className="fixed bottom-3 rounded-control bg-bg-overlay/70 px-3 py-2 text-sm tabular-nums text-text-on-media">{currentSlide + 1} of {slideCount}</p>
              </>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
