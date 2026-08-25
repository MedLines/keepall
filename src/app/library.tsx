"use client";

import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CollectionValidationError,
  type Collection,
} from "@/domain/collection";
import {
  itemInCollection,
  resolveItemCollectionNames,
  resolveItemTagNames,
  type Item,
} from "@/domain/item";
import {
  libraryViewHref,
  mergeLibraryViewState,
  parseLibraryViewState,
  sortLibraryItems,
  type LibraryViewState,
} from "@/domain/library-view";
import { LinkValidationError } from "@/domain/link";
import { NoteValidationError } from "@/domain/note";
import { matchesSearchQuery, normalizeSearchQuery } from "@/domain/search";
import { TagValidationError, type Tag } from "@/domain/tag";
import {
  createCollection,
  listCollections,
} from "@/persistence/collections";
import {
  appendImageAssetToItem,
  assignCollectionToItem,
  assignTagToItem,
  deleteItem,
  listItems,
  replaceImageAssetAtIndex,
  updateImage,
  updateLink,
  updateNote,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { enrichLinkPreview } from "./enrich-link-preview";
import { LibraryItem, type PendingMutation } from "./library-item";
import { LibraryInspect } from "./library-inspect";
import { ImageValidationError, clampImageSlideIndex } from "@/domain/image";

type RestoreFocus = { id: string; action: "edit" | "delete" };

export function Library() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parseLibraryViewState(searchParams);

  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editTitleDraft, setEditTitleDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [tagErrorItemId, setTagErrorItemId] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [collectionErrorItemId, setCollectionErrorItemId] = useState<
    string | null
  >(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(
    null,
  );

  const libraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstEditFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(
    null,
  );
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<RestoreFocus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function reload() {
      setLoadState("loading");
      setError(null);

      try {
        const [nextItems, nextTags, nextCollections] = await Promise.all([
          listItems(),
          listTags(),
          listCollections(),
        ]);
        if (!cancelled) {
          setItems(nextItems);
          setTags(nextTags);
          setCollections(nextCollections);
          setLoadState("ready");
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Couldn't load items.");
          setLoadState("error");
        }
      }
    }

    void reload();
    window.addEventListener(ITEMS_CHANGED_EVENT, reload);

    return () => {
      cancelled = true;
      window.removeEventListener(ITEMS_CHANGED_EVENT, reload);
    };
  }, []);

  useLayoutEffect(() => {
    if (editingId) {
      firstEditFieldRef.current?.focus();
      return;
    }

    if (pendingDeleteId) {
      confirmDeleteRef.current?.focus();
      return;
    }

    const restore = restoreFocusRef.current;
    if (!restore) {
      return;
    }

    const button = document.querySelector<HTMLButtonElement>(
      `button[data-focus-return="${restore.action}:${restore.id}"]`,
    );
    button?.focus();
    restoreFocusRef.current = null;
  }, [editingId, pendingDeleteId, items]);

  const mutationBusy = pendingMutation !== null;
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const collectionsById = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const browseCollectionId = view.collection;
  const searchQuery = view.q;
  const visibleItems = sortLibraryItems(
    items.filter((item) => {
      if (
        browseCollectionId !== null &&
        !itemInCollection(item, browseCollectionId)
      ) {
        return false;
      }

      return matchesSearchQuery(item, searchQuery);
    }),
    view.sort,
  );
  const hasActiveSearch = normalizeSearchQuery(searchQuery).length > 0;

  function updateView(patch: Partial<LibraryViewState>) {
    const current = parseLibraryViewState(searchParams);
    const next = mergeLibraryViewState(current, patch);
    router.replace(libraryViewHref(pathname, next), { scroll: false });
  }

  const inspectId = view.item;
  const inspectedItem =
    inspectId === null
      ? null
      : (items.find((entry) => entry.id === inspectId) ?? null);

  useEffect(() => {
    if (inspectId !== null && loadState === "ready" && inspectedItem === null) {
      updateView({ item: null, slide: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear stale item once after load
  }, [inspectId, inspectedItem, loadState]);

  useEffect(() => {
    if (loadState !== "ready") {
      return;
    }
    if (!inspectedItem || inspectedItem.type !== "image") {
      return;
    }
    const clamped = clampImageSlideIndex(inspectedItem.assetIds, view.slide);
    if (clamped !== view.slide) {
      updateView({ slide: clamped });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp when assets or slide drift
  }, [inspectedItem, view.slide, loadState]);

  function clearEdit(options?: { restoreFocus?: boolean }) {
    if (options?.restoreFocus && editingId) {
      restoreFocusRef.current = { id: editingId, action: "edit" };
    }
    setEditingId(null);
    setEditDraft("");
    setEditTitleDraft("");
    setEditError(null);
  }

  function closeInspect() {
    updateView({ item: null, slide: 0 });
    clearEdit();
    setPendingDeleteId(null);
    setGalleryError(null);
  }

  function openInspect(id: string) {
    updateView({ item: id, slide: 0 });
  }

  function setInspectSlide(slide: number) {
    updateView({ slide });
  }

  function cancelDelete() {
    if (pendingDeleteId) {
      restoreFocusRef.current = { id: pendingDeleteId, action: "delete" };
    }
    setPendingDeleteId(null);
  }

  function onEditSaveShortcut(
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    save: () => void,
  ) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!mutationBusy) {
        save();
      }
    }
  }

  async function confirmDelete(id: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "delete", id });
    setDeleteError(null);

    try {
      await deleteItem(id);
      setPendingDeleteId(null);
      restoreFocusRef.current = null;
      if (view.item === id) {
        updateView({ item: null, slide: 0 });
      }
      libraryHeadingRef.current?.focus();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setDeleteError("Couldn't delete item.");
    } finally {
      setPendingMutation(null);
    }
  }

  async function saveNoteEdit(id: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "save-note", id });
    setEditError(null);

    try {
      await updateNote(id, { content: editDraft });
      clearEdit();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof NoteValidationError) {
        setEditError(caught.message);
      } else {
        setEditError("Couldn't save note.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  async function saveLinkEdit(id: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "save-link", id });
    setEditError(null);

    try {
      const previous = items.find((item) => item.id === id);
      const previousUrl =
        previous?.type === "link" ? previous.url : undefined;
      const updated = await updateLink(id, {
        url: editDraft,
        title: editTitleDraft,
      });
      clearEdit();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      if (previousUrl !== undefined && previousUrl !== updated.url) {
        void enrichLinkPreview(updated.id, updated.url);
      }
    } catch (caught) {
      if (caught instanceof LinkValidationError) {
        setEditError(caught.message);
      } else {
        setEditError("Couldn't save link.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  async function saveImageEdit(id: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "save-image", id });
    setEditError(null);

    try {
      await updateImage(id, {
        caption: editDraft,
        sourceUrl: editTitleDraft,
      });
      clearEdit();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof ImageValidationError) {
        setEditError(caught.message);
      } else {
        setEditError("Couldn't save image.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  async function addImagesToItem(itemId: string, files: File[]) {
    if (pendingMutation || files.length === 0) {
      return;
    }

    setPendingMutation({ op: "append-image", id: itemId });
    setGalleryError(null);

    try {
      let updated = null as Awaited<ReturnType<typeof appendImageAssetToItem>> | null;
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        updated = await appendImageAssetToItem(itemId, {
          bytes,
          mimeType: file.type || "application/octet-stream",
        });
      }
      if (updated) {
        updateView({ item: itemId, slide: updated.assetIds.length - 1 });
      }
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof ImageValidationError) {
        setGalleryError(caught.message);
      } else {
        setGalleryError("Couldn't add images.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  async function replaceInspectSlide(itemId: string, file: File) {
    if (pendingMutation || inspectedItem?.type !== "image") {
      return;
    }

    const slideIndex = clampImageSlideIndex(inspectedItem.assetIds, view.slide);
    setPendingMutation({ op: "replace-image-slide", id: itemId });
    setGalleryError(null);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await replaceImageAssetAtIndex(itemId, slideIndex, {
        bytes,
        mimeType: file.type || "application/octet-stream",
      });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof ImageValidationError) {
        setGalleryError(caught.message);
      } else {
        setGalleryError("Couldn't replace image.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  async function addTagToItem(itemId: string, name: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "assign-tag", id: itemId });
    setTagErrorItemId(null);
    setTagError(null);

    try {
      const tag = await createTag({ name });
      await assignTagToItem(itemId, tag.id);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setTagErrorItemId(itemId);
      if (caught instanceof TagValidationError) {
        setTagError(caught.message);
      } else {
        setTagError("Couldn't add tag.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  async function addCollectionToItem(itemId: string, name: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "assign-collection", id: itemId });
    setCollectionErrorItemId(null);
    setCollectionError(null);

    try {
      const collection = await createCollection({ name });
      await assignCollectionToItem(itemId, collection.id);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setCollectionErrorItemId(itemId);
      if (caught instanceof CollectionValidationError) {
        setCollectionError(caught.message);
      } else {
        setCollectionError("Couldn't add to collection.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  return (
    <section className="mt-8" aria-labelledby="library-heading">
      <h2
        className="text-lg font-semibold"
        id="library-heading"
        ref={libraryHeadingRef}
        tabIndex={-1}
      >
        Library
      </h2>
      {loadState === "loading" ? (
        <p className="mt-3 text-sm text-zinc-600">Loading…</p>
      ) : loadState === "error" ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error ?? "Couldn't load items."}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">No items yet.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="library-search">
              Search
            </label>
            <input
              className="rounded-md border border-zinc-300 bg-white px-3 py-2"
              id="library-search"
              type="search"
              value={searchQuery}
              onChange={(event) => updateView({ q: event.target.value })}
              placeholder="Search titles, notes, and URLs"
            />
          </div>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label="Sort library"
          >
            <button
              className={`rounded-md border px-3 py-1 text-sm font-medium ${
                view.sort === "newest"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800"
              }`}
              type="button"
              onClick={() => updateView({ sort: "newest" })}
            >
              Newest
            </button>
            <button
              className={`rounded-md border px-3 py-1 text-sm font-medium ${
                view.sort === "oldest"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800"
              }`}
              type="button"
              onClick={() => updateView({ sort: "oldest" })}
            >
              Oldest
            </button>
          </div>
          {collections.length > 0 ? (
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Browse collections"
            >
              <button
                className={`rounded-md border px-3 py-1 text-sm font-medium ${
                  browseCollectionId === null
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-800"
                }`}
                type="button"
                onClick={() => updateView({ collection: null })}
              >
                All
              </button>
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  className={`rounded-md border px-3 py-1 text-sm font-medium ${
                    browseCollectionId === collection.id
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-800"
                  }`}
                  type="button"
                  onClick={() => updateView({ collection: collection.id })}
                >
                  {collection.name}
                </button>
              ))}
            </div>
          ) : null}
          {deleteError ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {deleteError}
            </p>
          ) : null}
          {visibleItems.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              {hasActiveSearch
                ? "No matching items."
                : browseCollectionId !== null
                  ? "No items in this collection."
                  : "No items yet."}
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
              {visibleItems.map((item) => (
                <LibraryItem
                  key={item.id}
                  item={item}
                  inspected={inspectId === item.id}
                  onOpenInspect={() => openInspect(item.id)}
                  tagNames={resolveItemTagNames(item, tagsById)}
                  tagError={tagErrorItemId === item.id ? tagError : null}
                  collectionNames={resolveItemCollectionNames(
                    item,
                    collectionsById,
                  )}
                  collectionError={
                    collectionErrorItemId === item.id ? collectionError : null
                  }
                  editing={editingId === item.id && inspectId !== item.id}
                  pendingDelete={
                    pendingDeleteId === item.id && inspectId !== item.id
                  }
                  mutationBusy={mutationBusy}
                  pendingMutation={pendingMutation}
                  editDraft={editDraft}
                  editTitleDraft={editTitleDraft}
                  editError={editError}
                  setFirstEditField={(node) => {
                    firstEditFieldRef.current = node;
                  }}
                  confirmDeleteRef={confirmDeleteRef}
                  onEditDraftChange={setEditDraft}
                  onEditTitleChange={setEditTitleDraft}
                  onEditSaveShortcut={onEditSaveShortcut}
                  onSaveNote={() => void saveNoteEdit(item.id)}
                  onSaveLink={() => void saveLinkEdit(item.id)}
                  onSaveImage={() => void saveImageEdit(item.id)}
                  onCancelEdit={() => clearEdit({ restoreFocus: true })}
                  onConfirmDelete={() => void confirmDelete(item.id)}
                  onCancelDelete={cancelDelete}
                  onAddTag={(name: string) => void addTagToItem(item.id, name)}
                  onAddCollection={(name: string) =>
                    void addCollectionToItem(item.id, name)
                  }
                  onStartEdit={() => {
                    setPendingDeleteId(null);
                    setDeleteError(null);
                    setEditError(null);
                    setTagError(null);
                    setTagErrorItemId(null);
                    setCollectionError(null);
                    setCollectionErrorItemId(null);
                    setEditingId(item.id);
                    if (item.type === "note") {
                      setEditDraft(item.content);
                      setEditTitleDraft("");
                    } else if (item.type === "image") {
                      setEditDraft(item.caption);
                      setEditTitleDraft(item.sourceUrl);
                    } else {
                      setEditDraft(item.url);
                      setEditTitleDraft(item.title);
                    }
                  }}
                  onStartDelete={() => {
                    clearEdit();
                    setDeleteError(null);
                    setTagError(null);
                    setTagErrorItemId(null);
                    setCollectionError(null);
                    setCollectionErrorItemId(null);
                    setPendingDeleteId(item.id);
                  }}
                />
              ))}
            </ul>
          )}
          <LibraryInspect
            item={inspectedItem}
            slide={view.slide}
            galleryError={galleryError}
            tagNames={
              inspectedItem
                ? resolveItemTagNames(inspectedItem, tagsById)
                : []
            }
            collectionNames={
              inspectedItem
                ? resolveItemCollectionNames(inspectedItem, collectionsById)
                : []
            }
            tagError={
              inspectedItem && tagErrorItemId === inspectedItem.id
                ? tagError
                : null
            }
            collectionError={
              inspectedItem && collectionErrorItemId === inspectedItem.id
                ? collectionError
                : null
            }
            editing={
              inspectedItem !== null && editingId === inspectedItem.id
            }
            pendingDelete={
              inspectedItem !== null && pendingDeleteId === inspectedItem.id
            }
            mutationBusy={mutationBusy}
            pendingMutation={pendingMutation}
            editDraft={editDraft}
            editTitleDraft={editTitleDraft}
            editError={editError}
            setFirstEditField={(node) => {
              firstEditFieldRef.current = node;
            }}
            confirmDeleteRef={confirmDeleteRef}
            onClose={closeInspect}
            onSlideChange={setInspectSlide}
            onAddImages={(files) => {
              if (inspectedItem?.type === "image") {
                void addImagesToItem(inspectedItem.id, files);
              }
            }}
            onReplaceSlide={(file) => {
              if (inspectedItem?.type === "image") {
                void replaceInspectSlide(inspectedItem.id, file);
              }
            }}
            onEditDraftChange={setEditDraft}
            onEditTitleChange={setEditTitleDraft}
            onEditSaveShortcut={onEditSaveShortcut}
            onSaveNote={() => {
              if (inspectedItem) {
                void saveNoteEdit(inspectedItem.id);
              }
            }}
            onSaveLink={() => {
              if (inspectedItem) {
                void saveLinkEdit(inspectedItem.id);
              }
            }}
            onSaveImage={() => {
              if (inspectedItem) {
                void saveImageEdit(inspectedItem.id);
              }
            }}
            onCancelEdit={() => clearEdit()}
            onConfirmDelete={() => {
              if (inspectedItem) {
                void confirmDelete(inspectedItem.id);
              }
            }}
            onCancelDelete={cancelDelete}
            onAddTag={(name: string) => {
              if (inspectedItem) {
                void addTagToItem(inspectedItem.id, name);
              }
            }}
            onAddCollection={(name: string) => {
              if (inspectedItem) {
                void addCollectionToItem(inspectedItem.id, name);
              }
            }}
            onStartEdit={() => {
              if (!inspectedItem) {
                return;
              }
              const target = inspectedItem;
              setPendingDeleteId(null);
              setDeleteError(null);
              setEditError(null);
              setTagError(null);
              setTagErrorItemId(null);
              setCollectionError(null);
              setCollectionErrorItemId(null);
              setEditingId(target.id);
              if (target.type === "note") {
                setEditDraft(target.content);
                setEditTitleDraft("");
              } else if (target.type === "image") {
                setEditDraft(target.caption);
                setEditTitleDraft(target.sourceUrl);
              } else {
                setEditDraft(target.url);
                setEditTitleDraft(target.title);
              }
            }}
            onStartDelete={() => {
              if (!inspectedItem) {
                return;
              }
              clearEdit();
              setDeleteError(null);
              setTagError(null);
              setTagErrorItemId(null);
              setCollectionError(null);
              setCollectionErrorItemId(null);
              setPendingDeleteId(inspectedItem.id);
            }}
          />
        </>
      )}
    </section>
  );
}
