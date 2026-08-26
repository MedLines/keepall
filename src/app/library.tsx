"use client";

import {
  type KeyboardEvent,
  useCallback,
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
  itemHasTag,
  itemInCollection,
  resolveItemCollectionNames,
  resolveItemTags,
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
import { TagValidationError, normalizeTagName, type Tag } from "@/domain/tag";
import {
  createCollection,
  deleteCollection,
  listCollections,
  renameCollection,
} from "@/persistence/collections";
import {
  appendImageAssetToItem,
  assignCollectionToItem,
  assignTagToItem,
  deleteItem,
  listItems,
  replaceImageAssetAtIndex,
  unassignTagFromItem,
  updateImage,
  updateLink,
  updateNote,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { enrichLinkPreview } from "./enrich-link-preview";
import { LibraryItem, type PendingMutation } from "./library-item";
import { LibraryListRow } from "./library-list-row";
import { LibraryInspect } from "./library-inspect";
import { LibraryBulkBar, type BulkPanel } from "./library-bulk-bar";
import type { OrgNameSuggestion } from "./org-name-suggest";
import { ImageValidationError, clampImageSlideIndex, type ImageItem } from "@/domain/image";

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
  const [collectionManageError, setCollectionManageError] = useState<
    string | null
  >(null);
  const [newCollectionDraft, setNewCollectionDraft] = useState("");
  const [renameCollectionDraft, setRenameCollectionDraft] = useState("");
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkPanel, setBulkPanel] = useState<BulkPanel>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkTagDraft, setBulkTagDraft] = useState("");
  const [bulkRemoveTagDraft, setBulkRemoveTagDraft] = useState("");
  const [bulkCollectionDraft, setBulkCollectionDraft] = useState("");

  const libraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstEditFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(
    null,
  );
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<RestoreFocus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function reload(options?: { soft?: boolean }) {
      const soft = options?.soft === true;
      if (!soft) {
        setLoadState("loading");
      }
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
          if (!soft) {
            setLoadState("error");
          }
        }
      }
    }

    void reload();
    function onItemsChanged() {
      void reload({ soft: true });
    }
    window.addEventListener(ITEMS_CHANGED_EVENT, onItemsChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(ITEMS_CHANGED_EVENT, onItemsChanged);
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

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkPanel(null);
    setBulkError(null);
    setBulkTagDraft("");
    setBulkRemoveTagDraft("");
    setBulkCollectionDraft("");
  }, []);

  function toggleItemSelected(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const mutationBusy = pendingMutation !== null;
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const collectionsById = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const browseCollectionId = view.collection;
  const browseCollection =
    browseCollectionId !== null
      ? (collectionsById.get(browseCollectionId) ?? null)
      : null;
  const browseTagId =
    view.tag !== null && tagsById.has(view.tag) ? view.tag : null;
  const browseTagName =
    browseTagId !== null ? (tagsById.get(browseTagId)?.name ?? null) : null;
  const browseType = view.type;
  const browseLayout = view.layout;
  const searchQuery = view.q;
  const visibleItems = sortLibraryItems(
    items.filter((item) => {
      if (browseType !== null && item.type !== browseType) {
        return false;
      }

      if (
        browseCollectionId !== null &&
        !itemInCollection(item, browseCollectionId)
      ) {
        return false;
      }

      if (browseTagId !== null && !itemHasTag(item, browseTagId)) {
        return false;
      }

      return matchesSearchQuery(item, searchQuery);
    }),
    view.sort,
  );
  const hasActiveSearch = normalizeSearchQuery(searchQuery).length > 0;
  const selectionActive = selectedIds.size > 0;
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const tagSuggestions: OrgNameSuggestion[] = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
  }));
  const collectionSuggestions: OrgNameSuggestion[] = collections.map(
    (collection) => ({
      id: collection.id,
      name: collection.name,
    }),
  );
  const bulkRemoveTagSuggestions: OrgNameSuggestion[] = (() => {
    const tagIdSet = new Set<string>();
    for (const id of selectedIds) {
      const item = itemsById.get(id);
      if (item) {
        for (const tagId of item.tagIds) {
          tagIdSet.add(tagId);
        }
      }
    }
    return tags
      .filter((tag) => tagIdSet.has(tag.id))
      .map((tag) => ({ id: tag.id, name: tag.name }));
  })();
  const inspectId = view.item;

  function updateView(
    patch: Partial<LibraryViewState>,
    history: "replace" | "push" = "replace",
  ) {
    const current = parseLibraryViewState(searchParams);
    const next = mergeLibraryViewState(current, patch);
    const href = libraryViewHref(pathname, next);
    if (history === "push") {
      router.push(href, { scroll: false });
    } else {
      router.replace(href, { scroll: false });
    }
  }

  const inspectedItem =
    inspectId === null
      ? null
      : (items.find((entry) => entry.id === inspectId) ?? null);

  useEffect(() => {
    if (browseCollection) {
      setRenameCollectionDraft(browseCollection.name);
    } else {
      setRenameCollectionDraft("");
    }
  }, [browseCollection]);

  useEffect(() => {
    if (
      browseCollectionId !== null &&
      loadState === "ready" &&
      browseCollection === null
    ) {
      updateView({ collection: null }, "replace");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear stale collection once after load
  }, [browseCollectionId, browseCollection, loadState]);

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

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (inspectId !== null) {
        return;
      }
      if (bulkPanel) {
        setBulkPanel(null);
        return;
      }
      if (selectedIds.size > 0) {
        clearSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bulkPanel, clearSelection, inspectId, selectedIds.size]);

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
    updateView({ item: null, slide: 0 }, "push");
    clearEdit();
    setPendingDeleteId(null);
    setGalleryError(null);
  }

  function openInspect(id: string) {
    updateView({ item: id, slide: 0 }, "push");
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
      let updated: ImageItem | null = null;
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        updated = await appendImageAssetToItem(itemId, {
          bytes,
          mimeType: file.type || "application/octet-stream",
        });
      }
      if (updated) {
        setItems((previous) =>
          previous.map((entry) => (entry.id === itemId ? updated! : entry)),
        );
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

  async function removeTagFromItem(itemId: string, tagId: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "unassign-tag", id: itemId });
    setTagErrorItemId(null);
    setTagError(null);

    try {
      await unassignTagFromItem(itemId, tagId);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setTagErrorItemId(itemId);
      setTagError("Couldn't remove tag.");
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

  async function bulkDeleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0 || pendingMutation) {
      return;
    }

    setPendingMutation({ op: "bulk-delete" });
    setBulkError(null);

    try {
      for (const id of ids) {
        await deleteItem(id);
      }
      if (ids.some((id) => view.item === id)) {
        updateView({ item: null, slide: 0 });
      }
      clearSelection();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setBulkError("Couldn't delete all items.");
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } finally {
      setPendingMutation(null);
    }
  }

  async function bulkAddTag(name: string) {
    const ids = [...selectedIds];
    if (ids.length === 0 || pendingMutation) {
      return;
    }

    setPendingMutation({ op: "bulk-assign-tag" });
    setBulkError(null);

    try {
      const tag = await createTag({ name });
      for (const itemId of ids) {
        await assignTagToItem(itemId, tag.id);
      }
      setBulkTagDraft("");
      setBulkPanel(null);
      clearSelection();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof TagValidationError) {
        setBulkError(caught.message);
      } else {
        setBulkError("Couldn't add tag to all items.");
      }
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } finally {
      setPendingMutation(null);
    }
  }

  async function bulkRemoveTag(name: string) {
    const ids = [...selectedIds];
    if (ids.length === 0 || pendingMutation) {
      return;
    }

    const normalized = normalizeTagName(name);
    const tag = tags.find((entry) => entry.name === normalized);
    if (!tag) {
      setBulkError("Tag not found on selection.");
      return;
    }

    setPendingMutation({ op: "bulk-unassign-tag" });
    setBulkError(null);

    try {
      for (const itemId of ids) {
        await unassignTagFromItem(itemId, tag.id);
      }
      setBulkRemoveTagDraft("");
      setBulkPanel(null);
      clearSelection();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setBulkError("Couldn't remove tag from all items.");
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } finally {
      setPendingMutation(null);
    }
  }

  async function bulkAddCollection(name: string) {
    const ids = [...selectedIds];
    if (ids.length === 0 || pendingMutation) {
      return;
    }

    setPendingMutation({ op: "bulk-assign-collection" });
    setBulkError(null);

    try {
      const collection = await createCollection({ name });
      for (const itemId of ids) {
        await assignCollectionToItem(itemId, collection.id);
      }
      setBulkCollectionDraft("");
      setBulkPanel(null);
      clearSelection();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof CollectionValidationError) {
        setBulkError(caught.message);
      } else {
        setBulkError("Couldn't move all items to collection.");
      }
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } finally {
      setPendingMutation(null);
    }
  }

  async function createLibraryCollection() {
    const name = newCollectionDraft.trim();
    if (!name || pendingMutation) {
      return;
    }

    setPendingMutation({ op: "create-collection" });
    setCollectionManageError(null);

    try {
      const collection = await createCollection({ name });
      setNewCollectionDraft("");
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      updateView({ collection: collection.id }, "push");
    } catch (caught) {
      if (caught instanceof CollectionValidationError) {
        setCollectionManageError(caught.message);
      } else {
        setCollectionManageError("Couldn't create collection.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  async function renameSelectedCollection() {
    if (!browseCollection || pendingMutation) {
      return;
    }
    const name = renameCollectionDraft.trim();
    if (!name) {
      return;
    }

    setPendingMutation({
      op: "rename-collection",
      id: browseCollection.id,
    });
    setCollectionManageError(null);

    try {
      await renameCollection(browseCollection.id, name);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof CollectionValidationError) {
        setCollectionManageError(caught.message);
      } else {
        setCollectionManageError("Couldn't rename collection.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  async function deleteSelectedCollection() {
    if (!browseCollection || pendingMutation) {
      return;
    }

    const confirmed = window.confirm(
      `Delete collection “${browseCollection.name}”? Items in it become Unsorted. Items are not deleted.`,
    );
    if (!confirmed) {
      return;
    }

    setPendingMutation({
      op: "delete-collection",
      id: browseCollection.id,
    });
    setCollectionManageError(null);

    try {
      await deleteCollection(browseCollection.id);
      updateView({ collection: null }, "push");
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setCollectionManageError("Couldn't delete collection.");
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
            aria-label="Filter by type"
          >
            {(
              [
                { value: null, label: "All" },
                { value: "link" as const, label: "Links" },
                { value: "note" as const, label: "Notes" },
                { value: "image" as const, label: "Images" },
              ] as const
            ).map((option) => (
              <button
                key={option.label}
                className={`rounded-md border px-3 py-1 text-sm font-medium ${
                  browseType === option.value
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-800"
                }`}
                type="button"
                onClick={() => updateView({ type: option.value }, "push")}
              >
                {option.label}
              </button>
            ))}
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
              onClick={() => updateView({ sort: "newest" }, "push")}
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
              onClick={() => updateView({ sort: "oldest" }, "push")}
            >
              Oldest
            </button>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label="Library layout"
          >
            <button
              className={`rounded-md border px-3 py-1 text-sm font-medium ${
                browseLayout === "grid"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800"
              }`}
              type="button"
              onClick={() => updateView({ layout: "grid" }, "replace")}
            >
              Grid
            </button>
            <button
              className={`rounded-md border px-3 py-1 text-sm font-medium ${
                browseLayout === "list"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800"
              }`}
              type="button"
              onClick={() => updateView({ layout: "list" }, "replace")}
            >
              List
            </button>
          </div>
          <div className="mt-3 space-y-2">
            <div
              className="flex flex-wrap gap-2"
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
                onClick={() => updateView({ collection: null }, "push")}
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
                  onClick={() =>
                    updateView({ collection: collection.id }, "push")
                  }
                >
                  {collection.name}
                </button>
              ))}
            </div>
            {collections.length === 0 ? (
              <p className="text-sm text-zinc-600">No collections yet.</p>
            ) : null}
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void createLibraryCollection();
              }}
            >
              <div className="flex min-w-40 flex-1 flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor="new-collection-name"
                >
                  New collection
                </label>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                  id="new-collection-name"
                  value={newCollectionDraft}
                  disabled={mutationBusy}
                  onChange={(event) =>
                    setNewCollectionDraft(event.target.value)
                  }
                  placeholder="Name"
                />
              </div>
              <button
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60"
                type="submit"
                disabled={mutationBusy || !newCollectionDraft.trim()}
              >
                {pendingMutation?.op === "create-collection"
                  ? "Creating…"
                  : "Create"}
              </button>
            </form>
            {browseCollection ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex min-w-40 flex-1 flex-col gap-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor="rename-collection-name"
                  >
                    Rename collection
                  </label>
                  <input
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    id="rename-collection-name"
                    value={renameCollectionDraft}
                    disabled={mutationBusy}
                    onChange={(event) =>
                      setRenameCollectionDraft(event.target.value)
                    }
                  />
                </div>
                <button
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60"
                  type="button"
                  disabled={mutationBusy || !renameCollectionDraft.trim()}
                  onClick={() => void renameSelectedCollection()}
                >
                  {pendingMutation?.op === "rename-collection"
                    ? "Saving…"
                    : "Save name"}
                </button>
                <button
                  className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-60"
                  type="button"
                  disabled={mutationBusy}
                  onClick={() => void deleteSelectedCollection()}
                >
                  {pendingMutation?.op === "delete-collection"
                    ? "Deleting…"
                    : "Delete collection"}
                </button>
              </div>
            ) : null}
            {collectionManageError ? (
              <p className="text-sm text-red-700" role="alert">
                {collectionManageError}
              </p>
            ) : null}
          </div>
          {browseTagId !== null && browseTagName !== null ? (
            <div
              className="mt-3 flex flex-wrap items-center gap-2"
              role="status"
            >
              <p className="text-sm text-zinc-700">
                Tag: <span className="font-medium">{browseTagName}</span>
              </p>
              <button
                className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-800"
                type="button"
                onClick={() => updateView({ tag: null }, "push")}
              >
                Clear tag
              </button>
            </div>
          ) : null}
          {deleteError ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {deleteError}
            </p>
          ) : null}
          <LibraryBulkBar
            busy={mutationBusy}
            collectionDraft={bulkCollectionDraft}
            collectionSuggestions={collectionSuggestions}
            count={selectedIds.size}
            error={bulkError}
            panel={bulkPanel}
            pendingAddCollection={pendingMutation?.op === "bulk-assign-collection"}
            pendingAddTag={pendingMutation?.op === "bulk-assign-tag"}
            pendingDelete={pendingMutation?.op === "bulk-delete"}
            pendingRemoveTag={pendingMutation?.op === "bulk-unassign-tag"}
            removeTagDraft={bulkRemoveTagDraft}
            removeTagSuggestions={bulkRemoveTagSuggestions}
            tagDraft={bulkTagDraft}
            tagSuggestions={tagSuggestions}
            onBulkAddCollection={(name) => void bulkAddCollection(name)}
            onBulkAddTag={(name) => void bulkAddTag(name)}
            onBulkRemoveTag={(name) => void bulkRemoveTag(name)}
            onClearSelection={clearSelection}
            onClosePanel={() => {
              setBulkPanel(null);
              setBulkError(null);
            }}
            onCollectionDraftChange={setBulkCollectionDraft}
            onConfirmDelete={() => void bulkDeleteSelected()}
            onOpenPanel={(panel) => {
              setBulkError(null);
              setBulkPanel(panel);
            }}
            onRemoveTagDraftChange={setBulkRemoveTagDraft}
            onTagDraftChange={setBulkTagDraft}
          />
          {visibleItems.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              {hasActiveSearch
                ? "No matching items."
                : browseType !== null
                  ? "No items of this type."
                  : browseTagId !== null
                    ? "No items with this tag."
                    : browseCollectionId !== null
                      ? "No items in this collection."
                      : "No items yet."}
            </p>
          ) : browseLayout === "list" ? (
            <ul className="mt-3 flex flex-col gap-2">
              {visibleItems.map((item) => (
                <LibraryListRow
                  key={item.id}
                  item={item}
                  inspected={inspectId === item.id}
                  selected={selectedIds.has(item.id)}
                  selectionActive={selectionActive}
                  onOpenInspect={() => openInspect(item.id)}
                  onToggleSelect={() => toggleItemSelected(item.id)}
                />
              ))}
            </ul>
          ) : (
            <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
              {visibleItems.map((item) => (
                <LibraryItem
                  key={item.id}
                  item={item}
                  inspected={inspectId === item.id}
                  onOpenInspect={() => openInspect(item.id)}
                  tagNames={resolveItemTags(item, tagsById)}
                  tagError={tagErrorItemId === item.id ? tagError : null}
                  collectionNames={resolveItemCollectionNames(
                    item,
                    collectionsById,
                  )}
                  collectionError={
                    collectionErrorItemId === item.id ? collectionError : null
                  }
                  onBrowseTag={(tagId) => updateView({ tag: tagId }, "push")}
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
                  onRemoveTag={(tagId: string) =>
                    void removeTagFromItem(item.id, tagId)
                  }
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
                  selected={selectedIds.has(item.id)}
                  selectionActive={selectionActive}
                  onToggleSelect={() => toggleItemSelected(item.id)}
                  tagSuggestions={tagSuggestions}
                  collectionSuggestions={collectionSuggestions}
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
                ? resolveItemTags(inspectedItem, tagsById)
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
            onBrowseTag={(tagId) => updateView({ tag: tagId }, "push")}
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
            onRemoveTag={(tagId: string) => {
              if (inspectedItem) {
                void removeTagFromItem(inspectedItem.id, tagId);
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
            tagSuggestions={tagSuggestions}
            collectionSuggestions={collectionSuggestions}
          />
        </>
      )}
    </section>
  );
}
