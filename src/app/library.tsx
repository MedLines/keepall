"use client";

import {
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
  itemInCollection,
  itemListTitle,
  resolveItemCollectionNames,
  resolveItemCollections,
  resolveItemTags,
  type Item,
} from "@/domain/item";
import {
  libraryViewHref,
  mergeLibraryViewState,
  parseLibraryViewState,
  type LibraryTypeFilter,
  type LibraryViewState,
} from "@/domain/library-view";
import { LinkValidationError } from "@/domain/link";
import { assertLocalImageFile } from "@/domain/image";
import { NoteValidationError } from "@/domain/note";
import { matchesSearchQuery, normalizeSearchQuery } from "@/domain/search";
import { TagValidationError, normalizeTagName, type Tag } from "@/domain/tag";
import { orderCollectionsByPins } from "@/domain/library-preferences";
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
  getItem,
  listItems,
  replaceImageAssetAtIndex,
  unassignTagFromItem,
  updateImage,
  updateLink,
  updateNote,
} from "@/persistence/items";
import { createTag, deleteTag, listTags } from "@/persistence/tags";
import { updateVideoDetails } from "@/persistence/videos";
import {
  getLibraryPreferences,
  movePinnedCollectionBefore,
  pinCollection,
  unpinCollection,
} from "@/persistence/library-preferences";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ITEMS_CHANGED_EVENT, enrichChangedItemId, isEnrichItemsChanged, PREVIEW_WELCOME_EVENT, type PreviewWelcomeDetail } from "./items-events";
import { enrichLinkPreview } from "./enrich-link-preview";
import {
  buildLibraryBrowseIndexes,
  filterAndSortLibraryItems,
  replaceItemInBrowseIndexes,
} from "./library-browse-index";
import {
  markLibraryNavScopeChange,
  measureLibraryNavScopeCommit,
} from "./library-nav-profile";
import {
  LibraryNavigationProvider,
} from "./library-navigation";
import { LibraryShell } from "./library-shell";
import { countSidebarItems } from "./library-sidebar-counts";
import { LibraryMainGrid } from "./library-main-grid";
import type { MasonryPlacement } from "./library-masonry";
import {
  pausePreviewEnrichForNavigation,
  resumePreviewWelcomeBatch,
  setViewportPreviewEnrichEnabled,
  startPreviewWelcomeBatch,
  subscribePreviewEnrichProgress,
  type PreviewEnrichProgress,
} from "./preview-enrich-coordinator";
import { wakeLinkPreviewRetries } from "./wake-link-preview-retries";
import { LibraryItem, type PendingMutation } from "./library-item";
import { LibraryInspect } from "./library-inspect";
import { type BulkPanel } from "./library-bulk-bar";
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
import { isPreviewEnrichPaused } from "./preview-enrich-pause";
import { itemPageHref } from "./item-page-navigation";
import type { ImageDetailsDraft, LinkDetailsDraft, NoteDetailsDraft, VideoDetailsDraft } from "./item-edit-dialog";

type RestoreFocus = { id: string; action: "edit" | "delete" };

/** Resume enrich + flush deferred enrich reloads after folder clicks stop. */
const BROWSE_IDLE_MS = 2500;

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
  if (browseType === "image") return "Images";
  if (browseType === "video") return "Videos";
  return "All items";
}

export function Library() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearchKey = searchParams.toString();
  /** Local view is the source of truth so folder clicks update the sidebar immediately. */
  const [view, setView] = useState(() => parseLibraryViewState(searchParams));
  const viewRef = useRef(view);
  viewRef.current = view;
  /** Ignore stale Next.js URL updates from older router.push while clicking fast. */
  const ignoreUrlSyncRef = useRef(false);
  const lastWrittenSearchRef = useRef(urlSearchKey);
  const urlWriteTimerRef = useRef<number | null>(null);
  const browseIdleTimerRef = useRef<number | null>(null);
  const pendingEnrichPatchIdsRef = useRef<Set<string>>(new Set());
  const flushEnrichPatchesRef = useRef<((ids: string[]) => void) | null>(null);
  const flushSoftReloadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (urlSearchKey === lastWrittenSearchRef.current) {
      ignoreUrlSyncRef.current = false;
      return;
    }
    if (ignoreUrlSyncRef.current) {
      // Older navigation finished after a newer click — do not stomp local view.
      return;
    }
    setView(parseLibraryViewState(searchParams));
  }, [urlSearchKey, searchParams]);

  useEffect(() => {
    function onPopState() {
      ignoreUrlSyncRef.current = false;
      const params = new URLSearchParams(window.location.search);
      lastWrittenSearchRef.current = params.toString();
      setView(parseLibraryViewState(params));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    return () => {
      if (urlWriteTimerRef.current !== null) {
        window.clearTimeout(urlWriteTimerRef.current);
      }
      if (browseIdleTimerRef.current !== null) {
        window.clearTimeout(browseIdleTimerRef.current);
      }
    };
  }, []);

  const scheduleBrowseIdle = useCallback(() => {
    pausePreviewEnrichForNavigation();
    if (browseIdleTimerRef.current !== null) {
      window.clearTimeout(browseIdleTimerRef.current);
    }
    browseIdleTimerRef.current = window.setTimeout(() => {
      browseIdleTimerRef.current = null;
      setViewportPreviewEnrichEnabled(true);
      if (pendingEnrichPatchIdsRef.current.size > 0) {
        const ids = [...pendingEnrichPatchIdsRef.current];
        pendingEnrichPatchIdsRef.current.clear();
        flushEnrichPatchesRef.current?.(ids);
      }
    }, BROWSE_IDLE_MS);
  }, []);

  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [pinnedCollectionIds, setPinnedCollectionIds] = useState<string[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [noteFormatDraft, setNoteFormatDraft] = useState<"plain" | "markdown">("plain");
  const [linkNoteDraft, setLinkNoteDraft] = useState("");
  const [editTitleDraft, setEditTitleDraft] = useState("");
  const [editImageTitleDraft, setEditImageTitleDraft] = useState("");
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
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(
    null,
  );
  const [pendingCollectionPreferenceId, setPendingCollectionPreferenceId] =
    useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkPanel, setBulkPanel] = useState<BulkPanel>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkTagDraft, setBulkTagDraft] = useState("");
  const [bulkCollectionDraft, setBulkCollectionDraft] = useState("");
  const [pendingCollectionDeleteId, setPendingCollectionDeleteId] = useState<string | null>(null);
  const [pendingTagDeleteId, setPendingTagDeleteId] = useState<string | null>(null);
  const [tagManageError, setTagManageError] = useState<string | null>(null);
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set());
  const [dropTargetCollectionId, setDropTargetCollectionId] = useState<
    string | null
  >(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [previewEnrichProgress, setPreviewEnrichProgress] =
    useState<PreviewEnrichProgress>(null);

  const libraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const prevBrowseScopeRef = useRef<string | null>(null);
  const pendingNavScopeLabelRef = useRef<string | null>(null);
  const browseIndexesRef = useRef(buildLibraryBrowseIndexes([]));
  const [browseIndexEpoch, setBrowseIndexEpoch] = useState(0);
  const navigationGenerationRef = useRef(0);
  const [navigationGeneration, setNavigationGeneration] = useState(0);
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
    let softReloadTimer: number | null = null;

    async function reload(options?: { soft?: boolean }) {
      const soft = options?.soft === true;
      if (!soft) {
        setLoadState("loading");
      }
      setError(null);

      try {
        const [nextItems, nextTags, nextCollections, preferences] = await Promise.all([
          listItems(),
          listTags(),
          listCollections(),
          getLibraryPreferences(),
        ]);
        if (!cancelled) {
          browseIndexesRef.current = buildLibraryBrowseIndexes(nextItems);
          setBrowseIndexEpoch((epoch) => epoch + 1);
          setItems(nextItems);
          setTags(nextTags);
          setCollections(nextCollections);
          setPinnedCollectionIds(preferences.pinnedCollectionIds);
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
    function scheduleSoftReload() {
      if (softReloadTimer !== null) {
        window.clearTimeout(softReloadTimer);
      }
      softReloadTimer = window.setTimeout(() => {
        softReloadTimer = null;
        void reload({ soft: true });
      }, 150);
    }
    flushSoftReloadRef.current = scheduleSoftReload;

    async function patchEnrichItems(ids: string[]) {
      if (ids.length === 0) {
        return;
      }
      try {
        const rows = await Promise.all(ids.map((id) => getItem(id)));
        if (cancelled) {
          return;
        }
        const patches = rows.filter((item): item is Item => item !== null);
        if (patches.length === 0) {
          return;
        }
        setItems((prev) => {
            let next: Item[] | null = null;
            let indexChanged = false;
            for (const item of patches) {
              const index = prev.findIndex((row) => row.id === item.id);
              if (index === -1) {
                continue;
              }
              if (prev[index] === item) {
                continue;
              }
              if (
                replaceItemInBrowseIndexes(
                  browseIndexesRef.current,
                  item.id,
                  item,
                )
              ) {
                indexChanged = true;
              }
              if (!next) {
                next = prev.slice();
              }
              next[index] = item;
            }
            if (indexChanged) {
              setBrowseIndexEpoch((epoch) => epoch + 1);
            }
            return next ?? prev;
          });
      } catch {
        // ignore — user actions still trigger a full reload
      }
    }
    flushEnrichPatchesRef.current = (ids) => {
      void patchEnrichItems(ids);
    };

    function scheduleEnrichItemPatch(itemId: string) {
      if (isPreviewEnrichPaused() || browseIdleTimerRef.current !== null) {
        pendingEnrichPatchIdsRef.current.add(itemId);
        return;
      }
      void patchEnrichItems([itemId]);
    }

    function onItemsChanged(event: Event) {
      if (isEnrichItemsChanged(event)) {
        const itemId = enrichChangedItemId(event);
        if (itemId) {
          scheduleEnrichItemPatch(itemId);
          return;
        }
      }
      scheduleSoftReload();
    }
    function onVisible() {
      if (document.visibilityState === "visible") scheduleSoftReload();
    }
    window.addEventListener(ITEMS_CHANGED_EVENT, onItemsChanged);
    window.addEventListener("focus", scheduleSoftReload);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      flushSoftReloadRef.current = null;
      flushEnrichPatchesRef.current = null;
      if (softReloadTimer !== null) {
        window.clearTimeout(softReloadTimer);
      }
      window.removeEventListener(ITEMS_CHANGED_EVENT, onItemsChanged);
      window.removeEventListener("focus", scheduleSoftReload);
      document.removeEventListener("visibilitychange", onVisible);
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
    return subscribePreviewEnrichProgress(setPreviewEnrichProgress);
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
    const actions = button?.closest("details");
    if (actions) actions.open = true;
    button?.focus();
    restoreFocusRef.current = null;
  }, [editingId, pendingDeleteId, items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkPanel(null);
    setBulkError(null);
    setBulkTagDraft("");
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

  const mutationBusy =
    pendingMutation !== null || pendingCollectionPreferenceId !== null;
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const collectionsById = useMemo(
    () => new Map(collections.map((collection) => [collection.id, collection])),
    [collections],
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
  const browseIndexes = browseIndexesRef.current;
  const sidebarCounts = useMemo(() => countSidebarItems(items), [items]);
  const orderedCollections = useMemo(
    () => orderCollectionsByPins(collections, pinnedCollectionIds),
    [collections, pinnedCollectionIds],
  );
  const headerItemCount = useMemo(
    () =>
      filterAndSortLibraryItems(
        items,
        tags,
        view,
        collectionsById,
        browseIndexes,
      ).length,
    [items, tags, view, collectionsById, browseIndexEpoch],
  );
  const visibleItems = useMemo(
    () =>
      filterAndSortLibraryItems(
        items,
        tags,
        view,
        collectionsById,
        browseIndexes,
      ),
    [items, tags, view, collectionsById, browseIndexEpoch],
  );
  const browseScopeKey = `${browseCollectionId ?? ""}|${browseUnsorted}|${browseType ?? ""}|${browseTagId ?? ""}`;
  const hasActiveSearch = normalizeSearchQuery(searchQuery).length > 0;
  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every((item) => selectedIds.has(item.id));

  function selectAllVisible() {
    setSelectedIds(new Set(visibleItems.map((item) => item.id)));
  }

  const selectionActive = selectedIds.size > 0;
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const deleteItemTarget = pendingDeleteId ? itemsById.get(pendingDeleteId) ?? null : null;
  const deleteCollectionTarget = pendingCollectionDeleteId
    ? collections.find((entry) => entry.id === pendingCollectionDeleteId) ?? null
    : null;
  const deleteTagTarget = pendingTagDeleteId
    ? tags.find((entry) => entry.id === pendingTagDeleteId) ?? null
    : null;
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

  const updateView = useCallback(
    (
      patch: Partial<LibraryViewState>,
      history: "replace" | "push" = "replace",
    ) => {
      const current = viewRef.current;
      const next = mergeLibraryViewState(current, patch);
      const scopeChanged =
        next.collection !== current.collection ||
        next.unsorted !== current.unsorted ||
        next.type !== current.type ||
        next.tag !== current.tag;
      if (scopeChanged) {
        scheduleBrowseIdle();
        navigationGenerationRef.current += 1;
        setNavigationGeneration(navigationGenerationRef.current);
        const scopeLabel = `${next.collection ?? "all"}|${next.unsorted}|${next.type ?? ""}|${next.tag ?? ""}`;
        pendingNavScopeLabelRef.current = scopeLabel;
        markLibraryNavScopeChange(scopeLabel);
      }
      setView(next);
      viewRef.current = next;

      const href = libraryViewHref(pathname, next);
      const search = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
      lastWrittenSearchRef.current = search;
      ignoreUrlSyncRef.current = true;

      if (process.env.NODE_ENV === "test") {
        if (history === "push") {
          router.push(href, { scroll: false });
        } else {
          router.replace(href, { scroll: false });
        }
        return;
      }

      if (urlWriteTimerRef.current !== null) {
        window.clearTimeout(urlWriteTimerRef.current);
      }
      urlWriteTimerRef.current = window.setTimeout(() => {
        urlWriteTimerRef.current = null;
        if (history === "push") {
          window.history.pushState(window.history.state, "", href);
        } else {
          window.history.replaceState(window.history.state, "", href);
        }
      }, 100);
    },
    [pathname, router, scheduleBrowseIdle],
  );

  useLayoutEffect(() => {
    if (pendingNavScopeLabelRef.current !== null) {
      measureLibraryNavScopeCommit(pendingNavScopeLabelRef.current);
      pendingNavScopeLabelRef.current = null;
    }
    if (prevBrowseScopeRef.current === browseScopeKey) {
      return;
    }
    if (prevBrowseScopeRef.current !== null) {
      clearSelection();
      const main = mainScrollRef.current;
      if (main) {
        main.scrollTop = 0;
      }
    }
    prevBrowseScopeRef.current = browseScopeKey;
  }, [browseScopeKey, clearSelection]);

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
    setNoteFormatDraft("plain");
    setEditTitleDraft("");
    setEditImageTitleDraft("");
    setEditError(null);
  }

  function closeInspect() {
    updateView({ item: null, slide: 0 }, "push");
    clearEdit();
    setPendingDeleteId(null);
    setGalleryError(null);
  }

  function openInspect(item: Item) {
    if (item.type === "image" || item.type === "note" || item.type === "video") {
      const returnView = mergeLibraryViewState(viewRef.current, {
        item: null,
        slide: 0,
      });
      router.push(itemPageHref(item.id, libraryViewHref(pathname, returnView)));
      return;
    }
    updateView({ item: item.id, slide: 0 }, "push");
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

  async function saveNoteEdit(id: string, draft?: NoteDetailsDraft) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "save-note", id });
    setEditError(null);

    try {
      await updateNote(id, draft ?? { content: editDraft, format: noteFormatDraft });
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

  async function saveLinkEdit(id: string, draft?: LinkDetailsDraft) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "save-link", id });
    setEditError(null);

    try {
      const previous = items.find((item) => item.id === id);
      const previousUrl =
        previous?.type === "link" ? previous.url : undefined;
      const updated = await updateLink(id, draft ?? {
        url: editDraft,
        title: editTitleDraft,
        noteContent: linkNoteDraft,
        noteFormat: noteFormatDraft,
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

  async function saveImageEdit(id: string, draft?: ImageDetailsDraft) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "save-image", id });
    setEditError(null);

    try {
      await updateImage(
        id,
        draft ?? {
          title: editImageTitleDraft,
          caption: editDraft,
          sourceUrl: editTitleDraft,
        },
      );
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

  async function saveVideoEdit(id: string, draft: VideoDetailsDraft) {
    if (pendingMutation) return;
    setPendingMutation({ op: "save-video", id });
    setEditError(null);
    try {
      await updateVideoDetails(id, draft);
      clearEdit();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setEditError("Couldn't save video details. Check the title and try again.");
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
        assertLocalImageFile(file);
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
      assertLocalImageFile(file);
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
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setBulkError("Couldn't remove tag from all items.");
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } finally {
      setPendingMutation(null);
    }
  }

  async function bulkRemoveAllTags() {
    const selected = [...selectedIds]
      .map((id) => itemsById.get(id))
      .filter((item): item is Item => Boolean(item));
    if (selected.length === 0 || pendingMutation) {
      return;
    }

    setPendingMutation({ op: "bulk-unassign-tag" });
    setBulkError(null);

    try {
      for (const item of selected) {
        for (const tagId of item.tagIds) {
          await unassignTagFromItem(item.id, tagId);
        }
      }
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setBulkError("Couldn't remove all tags from the selection.");
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
      setPendingCollectionDeleteId(null);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setCollectionManageError("Couldn't delete collection.");
    } finally {
      setPendingMutation(null);
    }
  }

  async function togglePinnedCollection(id: string) {
    if (mutationBusy) {
      return;
    }
    const pinned = pinnedCollectionIds.includes(id);
    setPendingCollectionPreferenceId(id);
    setCollectionManageError(null);

    try {
      const preferences = pinned
        ? await unpinCollection(id)
        : await pinCollection(id);
      setPinnedCollectionIds(preferences.pinnedCollectionIds);
    } catch {
      setCollectionManageError("Couldn't update collection pin.");
    } finally {
      setPendingCollectionPreferenceId(null);
    }
  }

  async function reorderPinnedCollection(sourceId: string, targetId: string) {
    if (mutationBusy || sourceId === targetId) {
      return;
    }
    setPendingCollectionPreferenceId(sourceId);
    setCollectionManageError(null);

    try {
      const preferences = await movePinnedCollectionBefore(sourceId, targetId);
      setPinnedCollectionIds(preferences.pinnedCollectionIds);
    } catch {
      setCollectionManageError("Couldn't reorder pinned collections.");
    } finally {
      setPendingCollectionPreferenceId(null);
    }
  }

  async function deleteTagById(id: string) {
    const tag = tags.find((entry) => entry.id === id);
    if (!tag || pendingMutation) {
      return;
    }

    setPendingMutation({ op: "delete-tag", id });
    setTagManageError(null);

    try {
      await deleteTag(id);
      if (browseTagId === id) {
        updateView({ tag: null }, "push");
      }
      setPendingTagDeleteId(null);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setTagManageError("Couldn't delete tag.");
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

  function renderLibraryItem(item: Item, placement?: MasonryPlacement) {
    return (
      <LibraryItem
        key={item.id}
        placement={placement}
        item={item}
        inspected={inspectId === item.id}
        layoutMode={browseLayout}
        openHref={
          item.type === "image" || item.type === "note" || item.type === "link" || item.type === "video"
            ? itemPageHref(
                item.id,
                libraryViewHref(
                  pathname,
                  mergeLibraryViewState(view, { item: null, slide: 0 }),
                ),
              )
            : undefined
        }
        onOpenInspect={() => openInspect(item)}
        tagNames={resolveItemTags(item, tagsById)}
        tagError={tagErrorItemId === item.id ? tagError : null}
        collections={
          browseCollectionId
            ? []
            : resolveItemCollections(item, collectionsById)
        }
        collectionError={
          collectionErrorItemId === item.id ? collectionError : null
        }
        onBrowseCollection={(collectionId) =>
          updateView({ collection: collectionId }, "push")
        }
        onBrowseTag={(tagId) => updateView({ tag: tagId }, "push")}
        onRemoveTag={(tagId: string) => void removeTagFromItem(item.id, tagId)}
        editing={editingId === item.id && inspectId !== item.id}
        pendingDelete={false}
        mutationBusy={mutationBusy}
        pendingMutation={pendingMutation}
        editError={editError}
        onSaveNote={(draft) => void saveNoteEdit(item.id, draft)}
        onSaveLink={(draft) => void saveLinkEdit(item.id, draft)}
        onSaveImage={(draft) => void saveImageEdit(item.id, draft)}
        onSaveVideo={(draft) => void saveVideoEdit(item.id, draft)}
        onCancelEdit={() => clearEdit({ restoreFocus: true })}
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
            setNoteFormatDraft(item.format === "markdown" ? "markdown" : "plain");
            setEditTitleDraft("");
          } else if (item.type === "image") {
            setEditDraft(item.caption);
            setEditImageTitleDraft(item.title);
            setEditTitleDraft(item.sourceUrl);
          } else if (item.type === "link") {
            setEditDraft(item.url);
            setEditTitleDraft(item.title);
            setLinkNoteDraft(item.noteContent ?? "");
            setNoteFormatDraft(item.noteFormat === "markdown" ? "markdown" : "plain");
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
        onItemDragStart={(event) => handleItemDragStart(item.id, event)}
        onItemDragEnd={handleItemDragEnd}
        pinVisible={itemPinVisible(item)}
        pinned={itemIsPinned(item)}
        onTogglePin={() => void togglePinItem(item.id)}
      />
    );
  }

  const topBar = (
      <LibraryTopBar
        headingRef={libraryHeadingRef}
        title={viewTitle}
        itemCount={headerItemCount}
        searchQuery={searchQuery}
        onSearchChange={(value) => updateView({ q: value })}
        sort={view.sort}
        onSortChange={(sort) => updateView({ sort }, "push")}
        layout={browseLayout}
        onLayoutChange={(layout) => updateView({ layout }, "replace")}
        typeFilter={browseType}
        sidebarCounts={sidebarCounts}
        onTypeFilterChange={(type) => updateView({ type }, "push")}
        tagFilterName={browseTagName}
        onClearTagFilter={() => updateView({ tag: null }, "push")}
        panelOpen={panelOpen}
        onPanelOpenChange={setPanelOpen}
        libraryLoading={loadState === "loading"}
        bulk={{
          allVisibleSelected,
          busy: mutationBusy,
          collectionDraft: bulkCollectionDraft,
          collectionSuggestions,
          count: selectedIds.size,
          error: bulkError,
          panel: bulkPanel,
          pendingAddCollection:
            pendingMutation?.op === "bulk-assign-collection",
          pendingAddTag: pendingMutation?.op === "bulk-assign-tag",
          pendingDelete: pendingMutation?.op === "bulk-delete",
          pendingRemoveTag: pendingMutation?.op === "bulk-unassign-tag",
          removeTagSuggestions: bulkRemoveTagSuggestions,
          tagDraft: bulkTagDraft,
          tagSuggestions,
          visibleCount: headerItemCount,
          onBulkAddCollection: (name) => void bulkAddCollection(name),
          onBulkAddTag: (name) => void bulkAddTag(name),
          onBulkRemoveTag: (name) => void bulkRemoveTag(name),
          onBulkRemoveAllTags: () => void bulkRemoveAllTags(),
          onClearSelection: clearSelection,
          onSelectAllVisible: selectAllVisible,
          onClosePanel: () => {
            setBulkPanel(null);
            setBulkError(null);
          },
          onCollectionDraftChange: setBulkCollectionDraft,
          onConfirmDelete: () => void bulkDeleteSelected(),
          onOpenPanel: (panel) => {
            setBulkError(null);
            setBulkPanel(panel);
          },
          onTagDraftChange: setBulkTagDraft,
        }}
      />
  );

  return (
    <LibraryNavigationProvider
      generation={navigationGeneration}
      generationRef={navigationGenerationRef}
    >
      <div className="relative flex h-full min-h-0 overflow-hidden bg-bg-shell py-2.5 pr-2.5">
        <LibraryShell
          panelOpen={panelOpen}
          onPanelOpenChange={setPanelOpen}
          browseCollectionId={browseCollectionId}
          browseUnsorted={browseUnsorted}
          browseType={browseType}
          browseTagId={browseTagId}
          collections={orderedCollections}
          pinnedCollectionIds={pinnedCollectionIds}
          tags={tags}
          sidebarCounts={sidebarCounts}
          dropTargetCollectionId={dropTargetCollectionId}
          collectionManageError={collectionManageError}
          dragError={dragError}
          mutationBusy={mutationBusy}
          libraryLoading={loadState === "loading"}
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
          onCollectionDragOver={handleCollectionDragOver}
          onCollectionDragLeave={() => setDropTargetCollectionId(null)}
          onCollectionDrop={handleCollectionDrop}
          onRenameCollection={(id, name) => void renameCollectionById(id, name)}
          onTogglePinnedCollection={(id) => void togglePinnedCollection(id)}
          onMovePinnedCollection={(sourceId, targetId) =>
            void reorderPinnedCollection(sourceId, targetId)
          }
          onDeleteCollection={(id) => {
            setCollectionManageError(null);
            setPendingCollectionDeleteId(id);
          }}
          onDeleteTag={(id) => {
            setTagManageError(null);
            setPendingTagDeleteId(id);
          }}
        />

        <div className="library-panel squircle-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-panel bg-bg-canvas shadow-panel">
        {topBar}
        <main
          ref={mainScrollRef}
          className="scroll-fade min-h-0 min-w-0 flex-1 overflow-auto px-3 pb-6 sm:px-6 [--scroll-fade-edge-opacity:0.35]"
          aria-labelledby="library-heading"
        >
          {loadState === "loading" ? (
            <p className="text-sm text-text-secondary">Loading…</p>
          ) : loadState === "error" ? (
            <p className="text-sm text-text-danger" role="alert">
              {error ?? "Couldn't load items."}
            </p>
          ) : (
            <>
              {deleteError ? (
                <p className="mb-3 text-sm text-text-danger" role="alert">
                  {deleteError}
                </p>
              ) : null}
              {previewEnrichProgress?.kind === "welcome" &&
              previewEnrichProgress.done < previewEnrichProgress.total ? (
                <p
                  className="mb-3 text-sm text-text-secondary"
                  role="status"
                  aria-live="polite"
                >
                  Fetching link previews… {previewEnrichProgress.done} /{" "}
                  {previewEnrichProgress.total}
                </p>
              ) : null}
              {visibleItems.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  {normalizeSearchQuery(view.q).length > 0
                    ? "No matching items."
                    : view.type !== null
                      ? "No items of this type."
                      : view.tag !== null
                        ? "No items with this tag."
                        : view.unsorted
                          ? "No unsorted items."
                          : browseCollectionId !== null
                            ? "No items in this collection."
                            : "No items yet."}
                </p>
              ) : (
                <LibraryMainGrid
                  visibleItems={visibleItems}
                  scopeKey={browseScopeKey}
                  layout={browseLayout}
                  scrollRef={mainScrollRef}
                  renderItem={renderLibraryItem}
                  empty={
                    <p className="text-sm text-text-secondary">
                      {normalizeSearchQuery(view.q).length > 0
                        ? "No matching items."
                        : view.type !== null
                          ? "No items of this type."
                          : view.tag !== null
                            ? "No items with this tag."
                            : view.unsorted
                              ? "No unsorted items."
                              : browseCollectionId !== null
                                ? "No items in this collection."
                                : "No items yet."}
                    </p>
                  }
                />
              )}
            </>
          )}
        </main>
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
                pendingDelete={false}
                mutationBusy={mutationBusy}
                pendingMutation={pendingMutation}
                editDraft={editDraft}
                noteFormatDraft={noteFormatDraft}
                linkNoteDraft={linkNoteDraft}
                editTitleDraft={editTitleDraft}
                editImageTitleDraft={editImageTitleDraft}
                editError={editError}
                setFirstEditField={(node) => {
                  firstEditFieldRef.current = node;
                }}
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
                onNoteFormatChange={setNoteFormatDraft}
                onLinkNoteChange={setLinkNoteDraft}
                onEditTitleChange={setEditTitleDraft}
                onEditImageTitleChange={setEditImageTitleDraft}
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
                    setNoteFormatDraft(target.format === "markdown" ? "markdown" : "plain");
                    setEditTitleDraft("");
                  } else if (target.type === "image") {
                    setEditDraft(target.caption);
                    setEditImageTitleDraft(target.title);
                    setEditTitleDraft(target.sourceUrl);
                  } else if (target.type === "link") {
                    setEditDraft(target.url);
                    setEditTitleDraft(target.title);
                    setLinkNoteDraft(target.noteContent ?? "");
                    setNoteFormatDraft(target.noteFormat === "markdown" ? "markdown" : "plain");
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
        </div>
        <ConfirmDialog
          open={deleteItemTarget !== null}
          title="Delete this item?"
          description={deleteItemTarget ? `Delete “${itemListTitle(deleteItemTarget)}”? This cannot be undone.` : ""}
          confirmLabel="Confirm delete"
          pendingLabel="Deleting…"
          busy={pendingMutation?.op === "delete"}
          error={deleteError}
          confirmRef={confirmDeleteRef}
          onConfirm={() => {
            if (deleteItemTarget) void confirmDelete(deleteItemTarget.id);
          }}
          onOpenChange={(open) => {
            if (!open) cancelDelete();
          }}
        />
        <ConfirmDialog
          open={deleteCollectionTarget !== null}
          title="Delete collection?"
          description={deleteCollectionTarget ? `Delete “${deleteCollectionTarget.name}”? Its items stay in your library.` : ""}
          confirmLabel="Delete collection"
          pendingLabel="Deleting…"
          busy={pendingMutation?.op === "delete-collection"}
          error={collectionManageError}
          onConfirm={() => {
            if (deleteCollectionTarget) void deleteCollectionById(deleteCollectionTarget.id);
          }}
          onOpenChange={(open) => {
            if (!open) {
              setPendingCollectionDeleteId(null);
              setCollectionManageError(null);
            }
          }}
        />
        <ConfirmDialog
          open={deleteTagTarget !== null}
          title="Delete tag?"
          description={deleteTagTarget ? `Delete “${deleteTagTarget.name}”? It will be removed from every item.` : ""}
          confirmLabel="Delete tag"
          pendingLabel="Deleting…"
          busy={pendingMutation?.op === "delete-tag"}
          error={tagManageError}
          onConfirm={() => {
            if (deleteTagTarget) void deleteTagById(deleteTagTarget.id);
          }}
          onOpenChange={(open) => {
            if (!open) {
              setPendingTagDeleteId(null);
              setTagManageError(null);
            }
          }}
        />
      </div>
    </LibraryNavigationProvider>
  );
}
