"use client";

import {
  type DragEvent,
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
  isItemPinnedInCollection,
  type Collection,
} from "@/domain/collection";
import {
  itemHasTag,
  itemInCollection,
  itemIsUnsorted,
  resolveItemCollectionNames,
  resolveItemTagNames,
  resolveItemTags,
  type Item,
} from "@/domain/item";
import {
  libraryViewHref,
  mergeLibraryViewState,
  parseLibraryViewState,
  sortLibraryItemsWithCollectionPins,
  type LibraryTypeFilter,
  type LibraryViewState,
} from "@/domain/library-view";
import { LinkValidationError } from "@/domain/link";
import { NoteValidationError } from "@/domain/note";
import { matchesSearchQuery, normalizeSearchQuery } from "@/domain/search";
import { PREVIEW_DAILY_VIEWPORT_CAP } from "@/domain/preview-enrich";
import { TagValidationError, normalizeTagName, type Tag } from "@/domain/tag";
import {
  createCollection,
  deleteCollection,
  listCollections,
  pinItemInCollection,
  renameCollection,
  unpinItemInCollection,
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
import { ITEMS_CHANGED_EVENT, PREVIEW_WELCOME_EVENT, type PreviewWelcomeDetail } from "./items-events";
import { enrichLinkPreview } from "./enrich-link-preview";
import {
  resumePreviewWelcomeBatch,
  startPreviewWelcomeBatch,
  subscribePreviewEnrichProgress,
  subscribePreviewViewportBudgetCapped,
  type PreviewEnrichProgress,
} from "./preview-enrich-coordinator";
import { wakeLinkPreviewRetries } from "./wake-link-preview-retries";
import { LibraryItem, type PendingMutation } from "./library-item";
import { LibraryInspect } from "./library-inspect";
import { LibraryBulkBar, type BulkPanel } from "./library-bulk-bar";
import { LibraryShell } from "./library-shell";
import { LibraryTopBar } from "./library-top-bar";
import { readShellPanelOpen, writeShellPanelOpen } from "./shell-styles";
import { isShellMobileViewport } from "./use-shell-mobile";
import type { OrgNameSuggestion } from "./org-name-suggest";
import {
  decodeLibraryDragIds,
  encodeLibraryDragIds,
  LIBRARY_ITEM_DRAG_MIME,
  resolveLibraryDragIds,
} from "./library-drag";
import { ImageValidationError, clampImageSlideIndex, type ImageItem } from "@/domain/image";

type RestoreFocus = { id: string; action: "edit" | "delete" };

function libraryViewTitle(
  browseCollection: Collection | null,
  browseUnsorted: boolean,
  browseType: LibraryTypeFilter | null,
  browseTagName: string | null,
): string {
  if (browseCollection) {
    return browseCollection.name;
  }
  if (browseUnsorted) {
    return "Unsorted";
  }
  if (browseTagName) {
    return browseTagName;
  }
  if (browseType === "link") {
    return "Links";
  }
  if (browseType === "note") {
    return "Notes";
  }
  if (browseType === "image") {
    return "Images";
  }
  return "All items";
}

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
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set());
  const [dropTargetCollectionId, setDropTargetCollectionId] = useState<
    string | null
  >(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [backupOpen, setBackupOpen] = useState(false);
  const [previewEnrichProgress, setPreviewEnrichProgress] =
    useState<PreviewEnrichProgress>(null);
  const [previewBudgetCapped, setPreviewBudgetCapped] = useState(false);

  const libraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstEditFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(
    null,
  );
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<RestoreFocus | null>(null);

  useEffect(() => {
    setPanelOpen(readShellPanelOpen());
  }, []);

  useEffect(() => {
    writeShellPanelOpen(panelOpen);
  }, [panelOpen]);

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

  useEffect(() => {
    void wakeLinkPreviewRetries();
    function onOnline() {
      void wakeLinkPreviewRetries();
    }
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    void resumePreviewWelcomeBatch();
    const unsubProgress = subscribePreviewEnrichProgress(setPreviewEnrichProgress);
    const unsubBudget = subscribePreviewViewportBudgetCapped(
      setPreviewBudgetCapped,
    );
    return () => {
      unsubProgress();
      unsubBudget();
    };
  }, []);

  useEffect(() => {
    function onPreviewWelcome(event: Event) {
      const detail = (event as CustomEvent<PreviewWelcomeDetail>).detail;
      void startPreviewWelcomeBatch(detail.linkIds);
    }
    window.addEventListener(PREVIEW_WELCOME_EVENT, onPreviewWelcome);
    return () => {
      window.removeEventListener(PREVIEW_WELCOME_EVENT, onPreviewWelcome);
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
  const browseUnsorted = view.unsorted;
  const browseLayout = view.layout;
  const searchQuery = view.q;
  const visibleItems = sortLibraryItemsWithCollectionPins(
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

      if (browseUnsorted && !itemIsUnsorted(item)) {
        return false;
      }

      if (browseTagId !== null && !itemHasTag(item, browseTagId)) {
        return false;
      }

      return matchesSearchQuery(
        item,
        searchQuery,
        resolveItemTagNames(item, tagsById),
      );
    }),
    view.sort,
    browseCollectionId !== null
      ? (browseCollection?.pinnedItemIds ?? null)
      : null,
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
        return;
      }
      if (panelOpen && isShellMobileViewport()) {
        setPanelOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bulkPanel, clearSelection, inspectId, panelOpen, selectedIds.size]);

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

  async function assignItemsToCollectionIds(
    itemIds: string[],
    collectionId: string,
    options?: { clearSelection?: boolean },
  ) {
    if (pendingMutation) {
      return;
    }

    const toAssign = [...new Set(itemIds)].filter((id) => {
      const item = itemsById.get(id);
      return item && !item.collectionIds.includes(collectionId);
    });
    if (toAssign.length === 0) {
      setDraggingIds(new Set());
      setDropTargetCollectionId(null);
      return;
    }

    setPendingMutation({ op: "bulk-assign-collection" });
    setDragError(null);

    try {
      for (const itemId of toAssign) {
        await assignCollectionToItem(itemId, collectionId);
      }
      if (options?.clearSelection) {
        clearSelection();
      }
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setDragError("Couldn't move items to collection.");
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } finally {
      setPendingMutation(null);
      setDraggingIds(new Set());
      setDropTargetCollectionId(null);
    }
  }

  function handleItemDragStart(itemId: string, event: DragEvent<HTMLElement>) {
    if (mutationBusy) {
      event.preventDefault();
      return;
    }

    const ids = resolveLibraryDragIds(itemId, selectedIds);
    event.dataTransfer.setData(
      LIBRARY_ITEM_DRAG_MIME,
      encodeLibraryDragIds(ids),
    );
    event.dataTransfer.effectAllowed = "move";
    setDraggingIds(new Set(ids));
    setDragError(null);
  }

  function handleItemDragEnd() {
    setDraggingIds(new Set());
    setDropTargetCollectionId(null);
  }

  function handleCollectionDragOver(
    collectionId: string,
    event: DragEvent<HTMLElement>,
  ) {
    if (mutationBusy) {
      return;
    }
    if (!event.dataTransfer.types.includes(LIBRARY_ITEM_DRAG_MIME)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetCollectionId(collectionId);
  }

  function handleCollectionDrop(
    collectionId: string,
    event: DragEvent<HTMLElement>,
  ) {
    event.preventDefault();
    setDropTargetCollectionId(null);
    const ids = decodeLibraryDragIds(
      event.dataTransfer.getData(LIBRARY_ITEM_DRAG_MIME),
    );
    if (!ids) {
      return;
    }
    void assignItemsToCollectionIds(ids, collectionId, {
      clearSelection: true,
    });
  }

  async function togglePinItem(itemId: string) {
    if (!browseCollection || pendingMutation) {
      return;
    }

    const pinned = isItemPinnedInCollection(browseCollection, itemId);
    setPendingMutation({
      op: pinned ? "unpin-item" : "pin-item",
      collectionId: browseCollection.id,
      itemId,
    });
    setPinError(null);

    try {
      if (pinned) {
        await unpinItemInCollection(browseCollection.id, itemId);
      } else {
        await pinItemInCollection(browseCollection.id, itemId);
      }
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setPinError("Couldn't update pin.");
    } finally {
      setPendingMutation(null);
    }
  }

  function itemPinVisible(item: Item): boolean {
    return (
      browseCollectionId !== null &&
      itemInCollection(item, browseCollectionId)
    );
  }

  function itemIsPinned(item: Item): boolean {
    return browseCollection
      ? isItemPinnedInCollection(browseCollection, item.id)
      : false;
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

  async function renameCollectionById(id: string, name: string) {
    if (pendingMutation) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setPendingMutation({
      op: "rename-collection",
      id,
    });
    setCollectionManageError(null);

    try {
      await renameCollection(id, trimmed);
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

  async function deleteCollectionById(id: string) {
    const collection = collections.find((entry) => entry.id === id);
    if (!collection || pendingMutation) {
      return;
    }

    const confirmed = window.confirm(
      `Delete collection “${collection.name}”? Items in it become Unsorted. Items are not deleted.`,
    );
    if (!confirmed) {
      return;
    }

    setPendingMutation({
      op: "delete-collection",
      id,
    });
    setCollectionManageError(null);

    try {
      await deleteCollection(id);
      if (browseCollectionId === id) {
        updateView({ collection: null }, "push");
      }
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setCollectionManageError("Couldn't delete collection.");
    } finally {
      setPendingMutation(null);
    }
  }

  const viewTitle = libraryViewTitle(
    browseCollection,
    browseUnsorted,
    browseType,
    browseTagName,
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-50">
      <LibraryTopBar
        headingRef={libraryHeadingRef}
        title={viewTitle}
        itemCount={visibleItems.length}
        searchQuery={searchQuery}
        onSearchChange={(value) => updateView({ q: value })}
        sort={view.sort}
        onSortChange={(sort) => updateView({ sort }, "push")}
        layout={browseLayout}
        onLayoutChange={(layout) => updateView({ layout }, "replace")}
        onHomeClick={() => setBackupOpen(false)}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <LibraryShell
          panelOpen={panelOpen}
          onPanelOpenChange={setPanelOpen}
          backupOpen={backupOpen}
          onBackupOpenChange={(open) => {
            setBackupOpen(open);
            if (open) {
              setPanelOpen(true);
            }
          }}
          browseCollectionId={browseCollectionId}
          browseUnsorted={browseUnsorted}
          browseType={browseType}
          browseTagId={browseTagId}
          collections={collections}
          tags={tags}
          items={items}
          dropTargetCollectionId={dropTargetCollectionId}
          newCollectionDraft={newCollectionDraft}
          collectionManageError={collectionManageError}
          dragError={dragError}
          mutationBusy={mutationBusy}
          onGoAll={() =>
            updateView(
              { collection: null, unsorted: false, type: null },
              "push",
            )
          }
          onGoUnsorted={() =>
            updateView({ unsorted: true, collection: null }, "push")
          }
          onGoCollection={(id) => updateView({ collection: id }, "push")}
          onGoTag={(id) => updateView({ tag: id }, "push")}
          onGoType={(type) => updateView({ type }, "push")}
          onCollectionDragOver={handleCollectionDragOver}
          onCollectionDragLeave={() => setDropTargetCollectionId(null)}
          onCollectionDrop={handleCollectionDrop}
          onNewCollectionDraftChange={setNewCollectionDraft}
          onCreateCollection={() => void createLibraryCollection()}
          onRenameCollection={(id, name) => void renameCollectionById(id, name)}
          onDeleteCollection={(id) => void deleteCollectionById(id)}
        />

        <main
          className="min-w-0 flex-1 overflow-auto px-4 py-4 sm:px-5"
          aria-labelledby="library-heading"
        >
          {loadState === "loading" ? (
            <p className="text-sm text-zinc-600">Loading…</p>
          ) : loadState === "error" ? (
            <p className="text-sm text-red-700" role="alert">
              {error ?? "Couldn't load items."}
            </p>
          ) : (
            <>
              {browseTagId !== null && browseTagName !== null ? (
                <div
                  className="mb-3 flex flex-wrap items-center gap-2"
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
                <p className="mb-3 text-sm text-red-700" role="alert">
                  {deleteError}
                </p>
              ) : null}
              {previewEnrichProgress?.kind === "welcome" &&
              previewEnrichProgress.done < previewEnrichProgress.total ? (
                <p
                  className="mb-3 text-sm text-zinc-600"
                  role="status"
                  aria-live="polite"
                >
                  Fetching link previews… {previewEnrichProgress.done} /{" "}
                  {previewEnrichProgress.total}
                </p>
              ) : null}
              {previewBudgetCapped ? (
                <p className="mb-3 text-sm text-zinc-600" role="status">
                  Automatic preview fetching paused for today (
                  {PREVIEW_DAILY_VIEWPORT_CAP}/day). Open a link and choose
                  Fetch preview.
                </p>
              ) : null}
              <LibraryBulkBar
                busy={mutationBusy}
                collectionDraft={bulkCollectionDraft}
                collectionSuggestions={collectionSuggestions}
                count={selectedIds.size}
                error={bulkError}
                panel={bulkPanel}
                pendingAddCollection={
                  pendingMutation?.op === "bulk-assign-collection"
                }
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
                <p className="text-sm text-zinc-600">
                  {hasActiveSearch
                    ? "No matching items."
                    : browseType !== null
                      ? "No items of this type."
                      : browseTagId !== null
                        ? "No items with this tag."
                        : browseUnsorted
                          ? "No unsorted items."
                          : browseCollectionId !== null
                            ? "No items in this collection."
                            : "No items yet."}
                </p>
              ) : (
                <ul
                  className={
                    browseLayout === "list"
                      ? "flex flex-col gap-2"
                      : "grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4"
                  }
                >
                  {visibleItems.map((item) => (
                      <LibraryItem
                        key={item.id}
                        item={item}
                        inspected={inspectId === item.id}
                        layoutMode={browseLayout}
                        onOpenInspect={() => openInspect(item.id)}
                        tagNames={resolveItemTags(item, tagsById)}
                        tagError={
                          tagErrorItemId === item.id ? tagError : null
                        }
                        collectionNames={resolveItemCollectionNames(
                          item,
                          collectionsById,
                        )}
                        collectionError={
                          collectionErrorItemId === item.id
                            ? collectionError
                            : null
                        }
                        onBrowseTag={(tagId) =>
                          updateView({ tag: tagId }, "push")
                        }
                        editing={
                          editingId === item.id && inspectId !== item.id
                        }
                        pendingDelete={
                          pendingDeleteId === item.id &&
                          inspectId !== item.id
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
                        onCancelEdit={() =>
                          clearEdit({ restoreFocus: true })
                        }
                        onConfirmDelete={() => void confirmDelete(item.id)}
                        onCancelDelete={cancelDelete}
                        onAddTag={(name: string) =>
                          void addTagToItem(item.id, name)
                        }
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
                        dragEnabled={
                          !mutationBusy &&
                          editingId !== item.id &&
                          pendingDeleteId !== item.id &&
                          inspectId !== item.id
                        }
                        isDragging={draggingIds.has(item.id)}
                        onItemDragStart={(event) =>
                          handleItemDragStart(item.id, event)
                        }
                        onItemDragEnd={handleItemDragEnd}
                        pinVisible={itemPinVisible(item)}
                        pinned={itemIsPinned(item)}
                        onTogglePin={() => void togglePinItem(item.id)}
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
                pinVisible={
                  inspectedItem !== null && itemPinVisible(inspectedItem)
                }
                pinned={
                  inspectedItem !== null ? itemIsPinned(inspectedItem) : false
                }
                pinError={pinError}
                onTogglePin={() => {
                  if (inspectedItem) {
                    void togglePinItem(inspectedItem.id);
                  }
                }}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
