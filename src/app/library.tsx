"use client";

import { prepareItemNavigation } from "./item-navigation-snapshot";
import { ScrollPanel } from "@/components/ui/scroll-panel";

import {
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CollectionValidationError,
  isItemPinnedInCollection,
  type Collection,
} from "@/domain/collection";
import { buildOrganizationPreviews } from "@/domain/organization-preview";
import {
  itemInCollection,
  resolveItemCollectionNames,
  resolveItemCollections,
  resolveItemTags,
  type Item,
} from "@/domain/item";
import {
  libraryViewHref,
  mergeLibraryViewState,
  parseLibraryViewState,
  sortLibraryItems,
  type LibraryTypeFilter,
  type LibraryViewState,
} from "@/domain/library-view";
import { itemActionLabel } from "@/domain/item-label";
import { LinkValidationError } from "@/domain/link";
import { assertLocalImageFile } from "@/domain/image";
import { NoteValidationError } from "@/domain/note";
import { normalizeSearchQuery } from "@/domain/search";
import { TagValidationError, normalizeTagName, type Tag } from "@/domain/tag";
import { orderCollectionsByPins } from "@/domain/library-preferences";
import {
  createCollection,
  deleteCollection,
  deleteCollections,
  listCollections,
  pinItemInCollection,
  renameCollection,
  unpinItemInCollection,
  type CollectionDeleteDestination,
} from "@/persistence/collections";
import {
  appendImageAssetsToItem,
  assignCollectionToItem,
  clearCollectionOnItem,
  clearCollectionsOnItems,
  assignTagToItem,
  deleteItem,
  getItem,
  listItems,
  listTrashedItems,
  replaceImageAssetAtIndex,
  unassignTagFromItem,
  updateImage,
  updateLink,
  updateNote,
  saveNoteWithImages,
} from "@/persistence/items";
import { createTag, deleteTag, deleteTags, listTags } from "@/persistence/tags";
import { updateVideoDetails } from "@/persistence/videos";
import { DocumentValidationError } from "@/domain/document";
import { getDocumentRevision, updateDocument } from "@/persistence/documents";
import {
  getLibraryPreferences,
  movePinnedCollectionBefore,
  pinCollection,
  unpinCollection,
} from "@/persistence/library-preferences";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CollectionDeleteOptions } from "./collection-delete-options";
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
import { useLibraryTrashActions } from "./library-trash-actions";
import { useDocumentSearch } from "./use-document-search";
import { LibraryShell } from "./library-shell";
import { countSidebarItems } from "./library-sidebar-counts";
import { LibraryMainGrid, type LibraryPreviewHandle } from "./library-main-grid";
import { LibraryOrganizationOverview } from "./library-organization-overview";
import { setCaptureCollectionName } from "./capture-events";
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
import { LibraryEmptyState, type LibraryEmptyStateKind } from "./library-empty-state";
import { readShellPanelOpen, writeShellPanelOpen } from "./shell-styles";
import { isShellMobileViewport } from "./use-shell-mobile";
import type { OrgNameSuggestion } from "./org-name-suggest";
import {
  decodeLibraryDragIds,
  encodeLibraryDragIds,
  LIBRARY_ITEM_DRAG_MIME,
  resolveLibraryDragIds,
} from "./library-drag";
import { ImageValidationError, clampImageSlideIndex } from "@/domain/image";
import { isPreviewEnrichPaused } from "./preview-enrich-pause";
import { itemPageHref } from "./item-page-navigation";
import type { ImageDetailsDraft, LinkDetailsDraft, NoteDetailsDraft, VideoDetailsDraft, DocumentDetailsDraft } from "./item-edit-dialog";

type RestoreFocus = { id: string; action: "edit" | "delete" };

function getEmptyStateKind(
  view: LibraryViewState,
  hasActiveSearch: boolean,
): LibraryEmptyStateKind {
  if (hasActiveSearch || view.type !== null || view.tag !== null) return "filtered";
  if (view.trash) return "trash";
  if (view.unsorted) return "unsorted";
  if (view.collection !== null) return "collection";
  return "library";
}

function getEmptyStateMessage(
  view: LibraryViewState,
  hasActiveSearch: boolean,
  collectionId: string | null,
): string {
  if (hasActiveSearch) return "No matching items.";
  if (view.type !== null) return "No items of this type.";
  if (view.tag !== null) return "No items with this tag.";
  if (view.unsorted) return "No unsorted items.";
  if (collectionId !== null) return "No items in this collection.";
  if (view.trash) return "Trash is empty.";
  return "No items yet.";
}

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
  if (browseType === "document") return "Documents";
  return "All items";
}

function subscribePanelPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const panelServerSnapshot = () => null;

export function Library() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearchKey = searchParams.toString();
  /** Local view is the source of truth so folder clicks update the sidebar immediately. */
  const [view, setView] = useState(() => parseLibraryViewState(searchParams));
  const viewRef = useRef(view);
  useLayoutEffect(() => { viewRef.current = view; }, [view]);
  /** Ignore stale Next.js URL updates from older router.push while clicking fast. */
  const ignoreUrlSyncRef = useRef(false);
  const lastWrittenSearchRef = useRef(urlSearchKey);
  const urlWriteTimerRef = useRef<number | null>(null);
  const browseIdleTimerRef = useRef<number | null>(null);
  const pendingEnrichPatchIdsRef = useRef<Set<string>>(new Set());
  const flushEnrichPatchesRef = useRef<((ids: string[]) => void) | null>(null);
  const flushSoftReloadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/items/")) return;
    if (urlSearchKey === lastWrittenSearchRef.current) {
      ignoreUrlSyncRef.current = false;
      return;
    }
    if (ignoreUrlSyncRef.current) {
      // Older navigation finished after a newer click — do not stomp local view.
      return;
    }
    setView(parseLibraryViewState(searchParams));
  }, [urlSearchKey, searchParams, pathname]);

  useEffect(() => {
    function onPopState() {
      if (window.location.pathname.startsWith("/items/")) return;
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
  const [trashedItems, setTrashedItems] = useState<Item[]>([]);
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
  const [organizationDelete, setOrganizationDelete] = useState<{
    kind: "collections" | "tags";
    ids: string[];
    hiddenCount: number;
  } | null>(null);
  const [organizationDeleteOpen, setOrganizationDeleteOpen] = useState(false);
  const [organizationDeleteError, setOrganizationDeleteError] = useState<string | null>(null);
  const [collectionDeleteDestination, setCollectionDeleteDestination] = useState<CollectionDeleteDestination>("unsorted");
  const [bulkPanel, setBulkPanel] = useState<BulkPanel>(null);
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<{ ids: string[]; hiddenCount: number } | null>(null);
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
  const [panelPreference, setPanelOpen] = useState<boolean | null>(null);
  const storedPanelPreference = useSyncExternalStore(subscribePanelPreference, readShellPanelOpen, panelServerSnapshot);
  const panelOpen = panelPreference ?? storedPanelPreference ?? true;
  const [previewEnrichProgress, setPreviewEnrichProgress] =
    useState<PreviewEnrichProgress>(null);

  const libraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const libraryGridRef = useRef<LibraryPreviewHandle>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [documentRevision, setDocumentRevision] = useState("initial");
  const prevBrowseScopeRef = useRef<string | null>(null);
  const pendingNavScopeLabelRef = useRef<string | null>(null);
  const [liveBrowseIndexes, setLiveBrowseIndexes] = useState(() => buildLibraryBrowseIndexes([]));
  const browseIndexesRef = useRef(liveBrowseIndexes);
  const [browseIndexEpoch, setBrowseIndexEpoch] = useState(0);
  const navigationGenerationRef = useRef(0);
  const [navigationGeneration, setNavigationGeneration] = useState(0);
  const firstEditFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(
    null,
  );
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<RestoreFocus | null>(null);

  useEffect(() => {
    if (panelPreference !== null) writeShellPanelOpen(panelPreference);
  }, [panelPreference]);

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
        const [nextItems, nextTags, nextCollections, preferences, nextTrash, nextDocumentRevision] = await Promise.all([
          listItems(),
          listTags(),
          listCollections(),
          getLibraryPreferences(),
          listTrashedItems(),
          getDocumentRevision(),
        ]);
        if (!cancelled) {
          const nextIndexes = buildLibraryBrowseIndexes(nextItems);
          browseIndexesRef.current = nextIndexes;
          setLiveBrowseIndexes(nextIndexes);
          setBrowseIndexEpoch((epoch) => epoch + 1);
          setItems(nextItems);
          setTrashedItems(nextTrash);
          setTags(nextTags);
          setDocumentRevision(nextDocumentRevision);
          setCollections(nextCollections);
          const currentView = viewRef.current;
          const available = new Set((currentView.collections ? nextCollections
            : currentView.tags ? nextTags
            : currentView.trash ? nextTrash : nextItems).map((entry) => entry.id));
          setSelectedIds((previous) => {
            const retained = [...previous].filter((id) => available.has(id));
            return retained.length === previous.size ? previous : new Set(retained);
          });
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

    document.querySelector<HTMLButtonElement>(
      `button[data-item-actions="${restore.id}"]`,
    )?.focus();
    restoreFocusRef.current = null;
  }, [editingId, pendingDeleteId, items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setOrganizationDeleteOpen(false);
    setOrganizationDeleteError(null);
    setBulkPanel(null);
    setBulkDeleteTarget(null);
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

  const trashActions = useLibraryTrashActions(libraryHeadingRef, (ids) => {
    const removed = new Set(ids);
    setSelectedIds((previous) => new Set([...previous].filter((id) => !removed.has(id))));
  });
  const mutationBusy =
    pendingMutation !== null || pendingCollectionPreferenceId !== null || trashActions.busy;
  const previewBusy = pendingCollectionPreferenceId !== null || trashActions.busy || (
    pendingMutation !== null && pendingMutation.op !== "assign-tag" && pendingMutation.op !== "unassign-tag" && pendingMutation.op !== "assign-collection"
  );
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
  useLayoutEffect(() => {
    setCaptureCollectionName(view.trash ? null : browseCollection?.name ?? null);
    return () => setCaptureCollectionName(null);
  }, [browseCollection, view.trash]);
  const browseTagId =
    view.tag !== null && tagsById.has(view.tag) ? view.tag : null;
  const browseTagName =
    browseTagId !== null ? (tagsById.get(browseTagId)?.name ?? null) : null;
  const browseType = view.type;
  const browseUnsorted = view.unsorted;
  const browseLayout = view.layout;
  const searchQuery = view.q;
  const trashIndexes = useMemo(() => buildLibraryBrowseIndexes(trashedItems), [trashedItems]);
  const browseItems = view.trash ? trashedItems : items;
  const documentSearch = useDocumentSearch(browseItems, tags, view.collections || view.tags ? "" : searchQuery, documentRevision);
  const resultQuery = view.collections || view.tags ? searchQuery : documentSearch.query;
  const resultView = useMemo(() => ({ ...view, q: resultQuery }), [view, resultQuery]);
  const browseIndexes = view.trash ? trashIndexes : liveBrowseIndexes;
  const typeCountIndexes = useMemo(
    () => buildLibraryBrowseIndexes(browseItems),
    [browseItems],
  );
  const sidebarCounts = useMemo(() => countSidebarItems(items), [items]);
  const typeFilterCounts = useMemo(
    () => countSidebarItems(filterAndSortLibraryItems(
      browseItems,
      tags,
      { ...resultView, type: null },
      collectionsById,
      typeCountIndexes,
      documentSearch.matches,
    )),
    [browseItems, tags, resultView, collectionsById, typeCountIndexes, documentSearch.matches],
  );
  const orderedCollections = useMemo(
    () => orderCollectionsByPins(collections, pinnedCollectionIds),
    [collections, pinnedCollectionIds],
  );
  const collectionFolders = useMemo(
    () => view.collections ? buildOrganizationPreviews(
      orderCollectionsByPins(sortLibraryItems(collections, view.sort), pinnedCollectionIds),
      items,
      "",
      "collections",
    ) : [],
    [collections, items, pinnedCollectionIds, view.collections, view.sort],
  );
  const tagCards = useMemo(
    () => view.tags ? buildOrganizationPreviews(sortLibraryItems(tags, view.sort), items, "", "tags") : [],
    [tags, items, view.tags, view.sort],
  );
  const overviewEntries = view.collections ? collectionFolders : tagCards;
  const visibleOverviewEntries = overviewEntries.filter(entry => entry.organization.name.toLowerCase().includes(normalizeSearchQuery(view.q)));
  const overviewCount = visibleOverviewEntries.length;
  const headerItemCount = useMemo(
    () =>
      filterAndSortLibraryItems(
        browseItems,
        tags,
        resultView,
        collectionsById,
        browseIndexes,
        documentSearch.matches,
      ).length,
    [browseItems, tags, resultView, collectionsById, browseIndexes, browseIndexEpoch, documentSearch.matches],
  );
  const visibleItems = useMemo(
    () =>
      filterAndSortLibraryItems(
        browseItems,
        tags,
        resultView,
        collectionsById,
        browseIndexes,
        documentSearch.matches,
      ),
    [browseItems, tags, resultView, collectionsById, browseIndexes, browseIndexEpoch, documentSearch.matches],
  );
  const browseScopeKey = `${Boolean(view.tags)}|${Boolean(view.collections)}|${Boolean(view.trash)}|${browseCollectionId ?? ""}|${browseUnsorted}|${browseType ?? ""}|${browseTagId ?? ""}`;
  const selectionEntries = view.collections || view.tags
    ? visibleOverviewEntries.map(entry => entry.organization)
    : visibleItems;
  const hasActiveSearch = normalizeSearchQuery(searchQuery).length > 0;
  const emptyStateKind = getEmptyStateKind(view, hasActiveSearch);
  const emptyStateMessage = getEmptyStateMessage(view, hasActiveSearch, browseCollectionId);
  const allVisibleSelected =
    selectionEntries.length > 0 &&
    selectionEntries.every(entry => selectedIds.has(entry.id));
  const visibleSelectionIds = new Set(selectionEntries.map((entry) => entry.id));
  const hiddenSelectedCount = [...selectedIds].filter((id) => !visibleSelectionIds.has(id)).length;

  function selectAllVisible() {
    setSelectedIds(new Set(selectionEntries.map(entry => entry.id)));
  }

  function clearHiddenSelection() {
    setSelectedIds((previous) => new Set([...previous].filter((id) => visibleSelectionIds.has(id))));
  }

  function requestOrganizationDelete(ids: string[]) {
    if (mutationBusy || ids.length === 0) return;
    setCollectionDeleteDestination("unsorted");
    setOrganizationDelete({ kind: view.collections ? "collections" : "tags", ids: [...ids], hiddenCount: ids.filter((id) => !visibleSelectionIds.has(id)).length });
    setOrganizationDeleteError(null);
    setOrganizationDeleteOpen(true);
  }

  async function confirmOrganizationDelete() {
    if (!organizationDelete || mutationBusy) return;
    setPendingMutation({ op: "bulk-delete" });
    setOrganizationDeleteError(null);
    try {
      if (organizationDelete.kind === "collections") {
        await deleteCollections(organizationDelete.ids, collectionDeleteDestination);
      } else {
        await deleteTags(organizationDelete.ids);
      }
      clearSelection();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      libraryHeadingRef.current?.focus();
    } catch (error) {
      setOrganizationDeleteError(error instanceof Error ? error.message : "Could not delete. Try again.");
    } finally {
      setPendingMutation(null);
    }
  }

  const organizationDeleteNoun = organizationDelete?.kind === "collections" ? "folders" : "tags";
  const organizationDeleteCount = organizationDelete?.ids.length ?? 0;

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
  const selectedOrganizationItems = [...selectedIds]
    .map(id => itemsById.get(id))
    .filter((item): item is Item => Boolean(item));
  const selectionTagCounts = new Map<string, number>();
  for (const item of selectedOrganizationItems) {
    for (const tagId of item.tagIds) {
      selectionTagCounts.set(tagId, (selectionTagCounts.get(tagId) ?? 0) + 1);
    }
  }
  const bulkRemoveTagSuggestions = tags
    .filter(tag => selectionTagCounts.has(tag.id))
    .map(tag => ({ id: tag.id, name: tag.name }));
  const bulkPartialTagNames = bulkRemoveTagSuggestions
    .filter(tag => selectionTagCounts.get(tag.id) !== selectedOrganizationItems.length)
    .map(tag => tag.name);
  const selectedCollectionIds = new Set(selectedOrganizationItems.map(item => item.collectionIds[0] ?? null));
  const bulkCollectionMixed = selectedCollectionIds.size > 1;
  const bulkCollectionId = bulkCollectionMixed ? null : selectedOrganizationItems[0]?.collectionIds[0];
  const bulkCollectionName = bulkCollectionId ? collectionsById.get(bulkCollectionId)?.name ?? null : null;
  const inspectId = view.item;

  const updateView = useCallback(
    (
      patch: Partial<LibraryViewState>,
      history: "replace" | "push" = "replace",
    ) => {
      const current = viewRef.current;
      const next = mergeLibraryViewState(current, patch);
      const scopeChanged =
        next.tags !== current.tags ||
        next.collections !== current.collections ||
        next.trash !== current.trash ||
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

  const clearFilters = useCallback(() => {
    document.getElementById("library-search")?.focus();
    updateView({ q: "", type: null, tag: null, item: null, slide: 0 }, "push");
  }, [updateView]);

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
    inspectId === null || view.trash
      ? null
      : (items.find((entry) => entry.id === inspectId) ?? null);

  useEffect(() => {
    if (
      browseCollectionId !== null &&
      loadState === "ready" &&
      browseCollection === null
    ) {
      let canceled = false;
      const collectionId = browseCollectionId;
      void listCollections().then((latestCollections) => {
        if (canceled) return;
        if (latestCollections.some((collection) => collection.id === collectionId)) {
          setCollections(latestCollections);
        } else {
          updateView({ collection: null }, "replace");
        }
      }).catch(() => {
        // Keep the selection if storage is temporarily unavailable.
      });
      return () => { canceled = true; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear stale collection once after load
  }, [browseCollectionId, browseCollection, loadState]);

  useEffect(() => {
    if (view.tag !== null && loadState === "ready" && !tagsById.has(view.tag)) {
      updateView({ tag: null }, "replace");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear stale tag once after load
  }, [view.tag, tagsById, loadState]);

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
      if (event.key !== "Escape" || event.defaultPrevented || trashActions.confirming || pendingMutation) {
        return;
      }
      if (inspectId !== null) {
        return;
      }
      if (bulkPanel) {
        return;
      }
      if (panelOpen && isShellMobileViewport()) {
        return;
      }
      if (selectedIds.size > 0) {
        clearSelection();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bulkPanel, clearSelection, inspectId, panelOpen, pendingMutation, selectedIds.size, trashActions.confirming]);

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
    prepareItemNavigation({ item, tags, collections, animate: false });
    if (item.type === "image" || item.type === "note" || item.type === "video" || item.type === "document") {
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
      setDeleteError("Couldn't move item to Trash.");
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
      if (draft?.images?.length) {
        await saveNoteWithImages(id, { content: draft.content, format: draft.format }, draft.images);
      } else {
        await updateNote(id, { content: draft?.content ?? editDraft, format: draft?.format ?? noteFormatDraft });
      }
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

  async function saveDocumentEdit(id: string, draft: DocumentDetailsDraft) {
    if (pendingMutation) return;
    setPendingMutation({ op: "save-document", id });
    setEditError(null);
    try {
      await updateDocument(id, draft);
      clearEdit();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) { setEditError(caught instanceof DocumentValidationError ? caught.message : "Couldn't save document. Try again."); }
    finally { setPendingMutation(null); }
  }

  async function addImagesToItem(itemId: string, files: File[]) {
    if (pendingMutation || files.length === 0) {
      return;
    }

    setPendingMutation({ op: "append-image", id: itemId });
    setGalleryError(null);

    try {
      const uploads = [];
      for (const file of files) {
        assertLocalImageFile(file);
        const bytes = new Uint8Array(await file.arrayBuffer());
        uploads.push({
          bytes,
          mimeType: file.type || "application/octet-stream",
        });
      }
      const updated = await appendImageAssetsToItem(itemId, uploads);
      setItems((previous) =>
        previous.map((entry) => (entry.id === itemId ? updated : entry)),
      );
      updateView({ item: itemId, slide: updated.assetIds.length - 1 });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof ImageValidationError) {
        setGalleryError(`${caught.message} No images were added.`);
      } else {
        setGalleryError("Couldn't add images. No images were added.");
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

  async function clearItemCollection(itemId: string) {
    if (pendingMutation) return;
    setPendingMutation({ op: "assign-collection", id: itemId });
    setCollectionErrorItemId(null);
    setCollectionError(null);
    try {
      await clearCollectionOnItem(itemId);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setCollectionErrorItemId(itemId);
      setCollectionError("Couldn't move to Unsorted.");
    } finally {
      setPendingMutation(null);
    }
  }

  async function bulkDeleteSelected() {
    const ids = bulkDeleteTarget?.ids ?? [];
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
      setBulkError("Couldn't move all items to Trash.");
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

  async function bulkClearCollection() {
    const ids = [...selectedIds];
    if (ids.length === 0 || pendingMutation) return;
    setPendingMutation({ op: "bulk-clear-collection" });
    setBulkError(null);
    try {
      await clearCollectionsOnItems(ids);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setBulkError("Couldn't move the selection to Unsorted.");
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
      await deleteCollection(id, collectionDeleteDestination);
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

  const viewTitle = view.collections ? "Collections" : view.tags ? "Tags" : view.trash ? "Trash" : libraryViewTitle(
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
        trashActions={view.trash ? { onRestore: () => trashActions.restore(item), onDelete: () => trashActions.requestDelete(item) } : undefined}
        searchQuery={resultQuery}
        searchExcerpt={documentSearch.matches?.get(item.id)?.excerpt}
        inspected={!view.trash && inspectId === item.id}
        layoutMode={browseLayout}
        openHref={
          item.type === "image" || item.type === "note" || item.type === "link" || item.type === "video" || item.type === "document"
            ? itemPageHref(
                item.id,
                libraryViewHref(
                  pathname,
                  mergeLibraryViewState(view, { item: null, slide: 0 }),
                ),
              )
            : undefined
        }
        onPrepareOpen={animate => prepareItemNavigation({ item, tags, collections, animate })}
        onOpenInspect={() => openInspect(item)}
        onPreview={!view.trash ? () => libraryGridRef.current?.openPreview(item.id) : undefined}
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
        onSaveDocument={(draft) => void saveDocumentEdit(item.id, draft)}
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
          !view.trash && !mutationBusy &&
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
        onClearCollection={() => void clearItemCollection(item.id)}
      />
    );
  }

  const topBar = (
      <LibraryTopBar
        headingRef={libraryHeadingRef}
        title={viewTitle}
        itemCount={view.collections || view.tags ? overviewCount : headerItemCount}
        searchQuery={searchQuery}
        searchPending={documentSearch.pending}
        onSearchChange={(value) => updateView({ q: value })}
        searchPlaceholder={view.trash ? "Search Trash…" : browseCollection ? `Search in ${browseCollection.name}…` : browseUnsorted ? "Search Unsorted…" : "Search your library…"}
        sort={view.sort}
        onSortChange={(sort) => updateView({ sort }, "push")}
        layout={browseLayout}
        onLayoutChange={(layout) => updateView({ layout }, "replace")}
        listColumns={view.listColumns ?? "auto"}
        onListColumnsChange={(listColumns) => updateView({ listColumns }, "replace")}
        onPreview={() => libraryGridRef.current?.openPreview()}
        previewDisabled={previewBusy || loadState !== "ready" || visibleItems.length === 0}
        collectionsView={Boolean(view.collections)}
        tagsView={Boolean(view.tags)}
        typeFilter={browseType}
        typeCounts={typeFilterCounts}
        trash={Boolean(view.trash)}
        trashEmptyDisabled={mutationBusy || loadState !== "ready" || trashedItems.length === 0}
        onEmptyTrash={() => trashActions.requestEmpty(trashedItems)}
        onTypeFilterChange={(type) => updateView({ type }, "push")}
        tagFilterName={browseTagName}
        typeFilterName={browseType === "link" ? "Links" : browseType === "note" ? "Notes" : browseType === "image" ? "Images" : browseType === "video" ? "Videos" : browseType === "document" ? "Documents" : null}
        onClearSearchFilter={() => updateView({ q: "" }, "push")}
        onClearTypeFilter={() => updateView({ type: null }, "push")}
        onClearTagFilter={() => updateView({ tag: null }, "push")}
        onClearFilters={clearFilters}
        panelOpen={panelOpen}
        onPanelOpenChange={setPanelOpen}
        libraryLoading={loadState === "loading"}
        selection={view.collections || view.tags ? {
          count: selectedIds.size,
          hiddenCount: hiddenSelectedCount,
          allVisibleSelected,
          busy: mutationBusy,
          onClearSelection: clearSelection,
          onClearHidden: clearHiddenSelection,
          onSelectAllVisible: selectAllVisible,
          onDelete: () => requestOrganizationDelete([...selectedIds]),
          deleteLabel: view.collections ? "Delete folders" : "Delete tags",
        } : undefined}
        bulk={{
          allVisibleSelected,
          busy: mutationBusy,
          collectionDraft: bulkCollectionDraft,
          collectionName: bulkCollectionName,
          collectionMixed: bulkCollectionMixed,
          partialTagNames: bulkPartialTagNames,
          collectionSuggestions,
          count: selectedIds.size,
          hiddenCount: hiddenSelectedCount,
          panelCount: bulkPanel === "delete" ? bulkDeleteTarget?.ids.length : undefined,
          panelHiddenCount: bulkPanel === "delete" ? bulkDeleteTarget?.hiddenCount : undefined,
          error: bulkError,
          panel: bulkPanel,
          pendingAddCollection:
            pendingMutation?.op === "bulk-assign-collection",
          pendingClearCollection: pendingMutation?.op === "bulk-clear-collection",
          pendingAddTag: pendingMutation?.op === "bulk-assign-tag",
          pendingDelete: pendingMutation?.op === "bulk-delete",
          pendingRemoveTag: pendingMutation?.op === "bulk-unassign-tag",
          removeTagSuggestions: bulkRemoveTagSuggestions,
          tagDraft: bulkTagDraft,
          tagSuggestions,
          visibleCount: headerItemCount,
          onBulkClearCollection: () => void bulkClearCollection(),
          onBulkAddCollection: (name) => void bulkAddCollection(name),
          onBulkAddTag: (name) => void bulkAddTag(name),
          onBulkRemoveTag: (name) => void bulkRemoveTag(name),
          onBulkRemoveAllTags: () => void bulkRemoveAllTags(),
          onClearSelection: clearSelection,
          onClearHidden: clearHiddenSelection,
          onSelectAllVisible: selectAllVisible,
          onClosePanel: () => {
            setBulkPanel(null);
            setBulkDeleteTarget(null);
            setBulkError(null);
          },
          onCollectionDraftChange: setBulkCollectionDraft,
          onConfirmDelete: () => void bulkDeleteSelected(),
          onRestoreSelected: view.trash ? () => trashActions.restoreSelected([...selectedIds]) : undefined,
          onDeletePermanently: view.trash ? () => {
            const ids = trashedItems.filter((item) => selectedIds.has(item.id)).map((item) => item.id);
            trashActions.requestDeleteSelected(ids, ids.filter((id) => !visibleSelectionIds.has(id)).length);
          } : undefined,
          onOpenPanel: (panel) => {
            setBulkError(null);
            setBulkDeleteTarget(panel === "delete" ? { ids: [...selectedIds], hiddenCount: hiddenSelectedCount } : null);
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
          previewOpen={previewOpen || pathname.startsWith("/items/")}
          panelReady={panelPreference !== null || storedPanelPreference !== null}
          onPanelOpenChange={setPanelOpen}
          browseCollectionId={browseCollectionId}
          browseUnsorted={browseUnsorted}
          browseTrash={Boolean(view.trash)}
          trashCount={trashedItems.length}
          onGoTrash={() => updateView({ trash: true, collection: null, tag: null, type: null, unsorted: false, item: null, slide: 0, q: "" }, "push")}
          onEmptyTrash={() => trashActions.requestEmpty(trashedItems)}
          browseType={browseType}
          browseTagId={browseTagId}
          collectionsView={Boolean(view.collections)}
          tagsView={Boolean(view.tags)}
          onGoCollections={() => updateView({ collections: true, tags: false, collection: null, unsorted: false, type: null, tag: null, trash: false, item: null, slide: 0, q: "" }, "push")}
          onGoTags={() => updateView({ tags: true, collections: false, collection: null, unsorted: false, type: null, tag: null, trash: false, item: null, slide: 0, q: "" }, "push")}
          collections={orderedCollections}
          pinnedCollectionIds={pinnedCollectionIds}
          tags={tags}
          sidebarCounts={sidebarCounts}
          dropTargetCollectionId={dropTargetCollectionId}
          collectionManageError={collectionManageError}
          dragError={dragError}
          mutationBusy={mutationBusy}
          libraryLoading={loadState === "loading"}
          onGoHome={() =>
            updateView(
              { collections: false, tags: false, trash: false, collection: null, unsorted: false, type: null, tag: null, q: "", item: null, slide: 0 },
              "push",
            )
          }
          onGoAll={() =>
            updateView(
              { collections: false, tags: false, trash: false, collection: null, unsorted: false, type: null },
              "push",
            )
          }
          onGoUnsorted={() =>
            updateView({ trash: false, unsorted: true, collection: null }, "push")
          }
          onGoCollection={(id) => updateView({ trash: false, collection: id }, "push")}
          onGoTag={(id) => updateView({ trash: false, tag: id }, "push")}
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
            setCollectionDeleteDestination("unsorted");
            setPendingCollectionDeleteId(id);
          }}
          onDeleteTag={(id) => {
            setTagManageError(null);
            setPendingTagDeleteId(id);
          }}
        />

        <div data-library-panel className="library-panel squircle-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-panel bg-bg-canvas shadow-panel">
        {topBar}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col" aria-labelledby="library-heading" aria-busy={documentSearch.pending}>
        <ScrollPanel className="min-h-0 min-w-0 flex-1" viewportRef={mainScrollRef}
          viewportClassName="scroll-fade px-3 pb-6 sm:px-6 [--scroll-fade-edge-opacity:0.35]">

          {loadState === "loading" ? (
            <p className="text-sm text-text-secondary">Loading…</p>
          ) : loadState === "error" ? (
            <p className="text-sm text-text-danger" role="alert">
              {error ?? "Couldn't load items."}
            </p>
          ) : (
            <>
              {documentSearch.error || documentSearch.unavailable > 0 ? <p role="status" className="mb-3 text-sm text-text-secondary">
                {documentSearch.error ? "Couldn't search file contents. Titles, tags, and personal notes are still searchable." : `${documentSearch.unavailable} file${documentSearch.unavailable === 1 ? " couldn't" : "s couldn't"} be searched. Try again or restore missing files from a backup.`}
                {" "}<button type="button" className="ui-control inline-flex min-h-8 items-center px-2 text-sm" onClick={documentSearch.retry}>Retry search</button>
              </p> : null}
              {trashActions.notice ? <p role="status" className="mb-3 text-sm text-text-secondary">{trashActions.notice}</p> : null}
              {trashActions.error ? <p role="alert" className="mb-3 text-sm text-text-danger">{trashActions.error}</p> : null}
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
              {view.collections || view.tags ? (
                <LibraryOrganizationOverview
                  key={view.collections ? "collections" : "tags"}
                  entries={overviewEntries}
                  layout={browseLayout}
                  kind={view.collections ? "collections" : "tags"}
                  query={searchQuery}
                  selectedIds={selectedIds}
                  busy={mutationBusy}
                  onToggleSelect={toggleItemSelected}
                  onDelete={requestOrganizationDelete}
                  hrefFor={(id) => libraryViewHref(pathname, mergeLibraryViewState(view, view.collections ? { collection: id, q: "", item: null, slide: 0 } : { tag: id, q: "", item: null, slide: 0 }))}
                  onOpen={(id) => updateView(view.collections ? { collection: id, q: "" } : { tag: id, q: "" }, "push")}
                />
              ) : visibleItems.length === 0 && documentSearch.pending ? null : visibleItems.length === 0 ? (
                <LibraryEmptyState
                  kind={emptyStateKind}
                  message={emptyStateMessage}
                  onClearFilters={clearFilters}
                />
              ) : (
                <LibraryMainGrid
                  ref={libraryGridRef}
                  onPreviewOpenChange={setPreviewOpen}
                  visibleItems={visibleItems}
                  scopeKey={browseScopeKey}
                  layout={browseLayout}
                  scrollRef={mainScrollRef}
                  listColumns={view.listColumns ?? "auto"}
                  renderItem={renderLibraryItem}
                  selectedIds={selectedIds}
                  onSelectIds={setSelectedIds}
                  keyboardDisabled={previewBusy}
                  previewEnabled={!view.trash}
                  onOpenItem={item => openInspect(item)}
                  empty={
                    <LibraryEmptyState
                      kind={emptyStateKind}
                      message={emptyStateMessage}
                      onClearFilters={clearFilters}
                    />
                  }
                />
              )}
            </>
          )}
        </ScrollPanel>
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
                onClearCollection={() => {
                  if (inspectedItem) void clearItemCollection(inspectedItem.id);
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
        {trashActions.dialog}
        <ConfirmDialog
          open={organizationDeleteOpen}
          title={`Delete ${organizationDeleteCount} ${organizationDeleteNoun}?`}
          description={organizationDelete?.kind === "collections"
            ? `${organizationDelete.hiddenCount > 0 ? `${organizationDelete.hiddenCount} selected folder${organizationDelete.hiddenCount === 1 ? " is" : "s are"} hidden by search or filters. ` : ""}Choose where to move the contents before deleting these folders.`
            : `${organizationDelete?.hiddenCount ? `${organizationDelete.hiddenCount} selected tag${organizationDelete.hiddenCount === 1 ? " is" : "s are"} hidden by search or filters. ` : ""}These tags will be removed from every item. Items stay in your library.`}
          confirmLabel={`Delete ${organizationDeleteNoun}`}
          pendingLabel="Deleting…"
          busy={pendingMutation?.op === "bulk-delete"}
          error={organizationDeleteError}
          onConfirm={() => void confirmOrganizationDelete()}
          onOpenChange={open => {
            setOrganizationDeleteOpen(open);
            if (!open) setOrganizationDeleteError(null);
          }}
        >
          {organizationDelete?.kind === "collections" ? <CollectionDeleteOptions value={collectionDeleteDestination} busy={pendingMutation?.op === "bulk-delete"} onChange={setCollectionDeleteDestination} /> : null}
        </ConfirmDialog>
        <ConfirmDialog
          open={deleteItemTarget !== null}
          title="Move this item to Trash?"
          description={deleteItemTarget ? `Move “${itemActionLabel(deleteItemTarget)}” to Trash? You can restore it later.` : ""}
          confirmLabel="Move to Trash"
          pendingLabel="Moving…"
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
          description={deleteCollectionTarget ? `Delete “${deleteCollectionTarget.name}”? Choose where to move its contents.` : ""}
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
        >
          <CollectionDeleteOptions value={collectionDeleteDestination} busy={pendingMutation?.op === "delete-collection"} onChange={setCollectionDeleteDestination} />
        </ConfirmDialog>
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
