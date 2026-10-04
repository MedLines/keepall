"use client";

import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { RowActionMenu } from "./row-action-menu";
import {
  type DragEvent,
  type ReactNode,
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Collection } from "@/domain/collection";
import type { LibraryTypeFilter } from "@/domain/library-view";
import type { Tag } from "@/domain/tag";
import type { LibrarySidebarCounts } from "./library-sidebar-counts";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  DeleteIcon,
  CollectionIcon,
  HashIcon,
  HelpIcon,
  InboxIcon,
  LibraryIcon,
  LogoIcon,
  MoreIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
} from "./shell-icons";
import {
  readShellCollectionsOpen,
  readShellTagsOpen,
  SHELL_ASIDE,
  SHELL_NAV_GUTTER,
  SHELL_NAV_ITEM,
  SHELL_NAV_ITEM_ACTIVE,
  SHELL_NAV_ITEM_IDLE,
  SHELL_NAV_SURFACE,
  SHELL_SIDEBAR_COLLAPSED,
  SHELL_SIDEBAR_EXPANDED,
  writeShellCollectionsOpen,
  writeShellTagsOpen,
} from "./shell-styles";
import { useShellMobile } from "./use-shell-mobile";
import { ShellPanelIcon } from "./shell-panel-icon";
import { collectionMarkerStyle } from "./collection-marker";
import { LogoContextMenu } from "./logo-context-menu";
import { SidebarResizeHandle } from "./sidebar-resize-handle";

const COLLECTION_REORDER_MIME = "application/x-keepall-pinned-collection";

type SidebarRailAction = {
  label: string;
  active: boolean;
  onExpand: () => void;
};

type Props = {
  panelOpen: boolean;
  panelReady: boolean;
  previewOpen?: boolean;
  onPanelOpenChange: (open: boolean) => void;
  browseCollectionId: string | null;
  browseUnsorted: boolean;
  browseTrash?: boolean;
  trashCount?: number;
  onGoTrash?: () => void;
  onEmptyTrash?: () => void;
  browseType: LibraryTypeFilter | null;
  browseTagId: string | null;
  collectionsView?: boolean;
  tagsView?: boolean;
  onGoCollections?: () => void;
  onGoTags?: () => void;
  collections: Collection[];
  pinnedCollectionIds: string[];
  tags: Tag[];
  sidebarCounts: LibrarySidebarCounts;
  dropTargetCollectionId: string | null;
  collectionManageError: string | null;
  dragError: string | null;
  mutationBusy: boolean;
  libraryLoading?: boolean;
  onGoHome: () => void;
  onGoAll: () => void;
  onGoUnsorted: () => void;
  onGoCollection: (id: string) => void;
  onGoTag: (id: string) => void;
  onCollectionDragOver: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onCollectionDragLeave: () => void;
  onCollectionDrop: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onRenameCollection: (id: string, name: string) => void;
  onTogglePinnedCollection: (id: string) => void;
  onMovePinnedCollection: (sourceId: string, targetId: string) => void;
  onDeleteCollection: (id: string) => void;
  onDeleteTag: (id: string) => void;
};

export function LibraryShell({
  panelOpen: expanded,
  panelReady,
  previewOpen = false,
  onPanelOpenChange,
  browseCollectionId,
  browseUnsorted,
  browseTrash = false, trashCount = 0, onGoTrash, onEmptyTrash,
  browseType,
  browseTagId,
  collectionsView = false, tagsView = false, onGoCollections, onGoTags,
  collections,
  pinnedCollectionIds,
  tags,
  sidebarCounts: counts,
  dropTargetCollectionId,
  collectionManageError,
  dragError,
  mutationBusy,
  libraryLoading = false,
  onGoHome,
  onGoAll,
  onGoUnsorted,
  onGoCollection,
  onGoTag,
  onCollectionDragOver,
  onCollectionDragLeave,
  onCollectionDrop,
  onRenameCollection,
  onTogglePinnedCollection,
  onMovePinnedCollection,
  onDeleteCollection,
  onDeleteTag,
}: Props) {
  const [collectionFilter, setCollectionFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const isMobile = useShellMobile();
  const mobileSidebarOpen = isMobile && expanded && !previewOpen;
  useEffect(() => {
    if (isMobile && expanded && previewOpen) onPanelOpenChange(false);
  }, [isMobile, expanded, previewOpen, onPanelOpenChange]);
  const mobileOpener = useRef<HTMLElement | null>(null);
  const mobileOpenerAnchor = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!mobileSidebarOpen) {
      return;
    }
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.matches('button[aria-controls="library-sidebar"]')) {
      mobileOpener.current = focused;
      mobileOpenerAnchor.current = null;
    }
  }, [mobileSidebarOpen]);

  useLayoutEffect(() => {
    // Match the server during hydration, then restore browser-only preferences
    // before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollectionsOpen(readShellCollectionsOpen());
    setTagsOpen(readShellTagsOpen());
  }, []);

  const collectionQuery = collectionFilter.trim().toLowerCase();
  const filteredCollections = useMemo(() => {
    if (!collectionQuery) {
      return collections;
    }
    return collections.filter((collection) =>
      collection.name.toLowerCase().includes(collectionQuery),
    );
  }, [collections, collectionQuery]);

  const tagQuery = tagFilter.trim().toLowerCase();
  const filteredTags = useMemo(() => {
    if (!tagQuery) {
      return tags;
    }
    return tags.filter((tag) => tag.name.toLowerCase().includes(tagQuery));
  }, [tags, tagQuery]);

  const closeOnMobile = useCallback(() => {
    if (isMobile) {
      onPanelOpenChange(false);
    }
  }, [isMobile, onPanelOpenChange]);

  const allItemsActive =
    browseCollectionId === null &&
    !browseUnsorted && !browseTrash && !collectionsView && !tagsView &&
    browseTagId === null &&
    browseType === null;

  const unsortedActive = browseUnsorted;

  const collectionsCollapsedLabel =
    collections.find((collection) => collection.id === browseCollectionId)
      ?.name ?? "Collections";
  const tagsCollapsedLabel =
    tags.find((tag) => tag.id === browseTagId)?.name ?? "Tags";

  const renderPrimaryNav = (contentExpanded: boolean) => (
    <>
      <ShellNavItem
        expanded={contentExpanded}
        active={allItemsActive}
        label="All items"
        count={libraryLoading ? undefined : counts.all}
        icon={<LibraryIcon className="size-[18px] shrink-0 text-text-secondary" />}
        onClick={() => {
          onGoAll();
          closeOnMobile();
        }}
      />
      <ShellNavItem
        expanded={contentExpanded}
        active={unsortedActive}
        label="Unsorted"
        count={libraryLoading ? undefined : counts.unsorted}
        icon={<InboxIcon className="size-[18px] shrink-0 text-text-secondary" />}
        onClick={() => {
          onGoUnsorted();
          closeOnMobile();
        }}
      />
    </>
  );

  const sidebarBody = (contentExpanded: boolean, mobileSidebarOpen: boolean) => (
    <>
      <SidebarBrand
        expanded={contentExpanded}
        mobileSidebarOpen={mobileSidebarOpen}
        onClose={() => onPanelOpenChange(false)}
        onGoHome={() => {
          onGoHome();
          closeOnMobile();
        }}
      />
      <nav
          data-sidebar-nav
          aria-label="Sidebar navigation"
          className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-5 overflow-hidden pb-[18px] ${contentExpanded ? SHELL_NAV_GUTTER : "px-2"}`}
        >
          <div className={`flex min-h-0 flex-col gap-1 ${contentExpanded ? "overflow-hidden" : "scroll-fade overflow-y-auto overscroll-contain"}`}>
            <div className={`flex shrink-0 flex-col gap-1 ${contentExpanded ? "library-sidebar-primary-nav overflow-hidden" : ""}`}>
              {renderPrimaryNav(contentExpanded)}
            </div>

            {contentExpanded ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <CollectionsSection
                  onSeeAll={onGoCollections ? () => { onGoCollections(); closeOnMobile(); } : undefined}
                  overviewActive={collectionsView}
                  rail={!isMobile && !expanded ? {
                    label: collectionsCollapsedLabel,
                    active: browseCollectionId !== null || collectionsView,
                    onExpand: () => onPanelOpenChange(true),
                  } : undefined}
                  collectionsOpen={collectionsOpen}
                  onCollectionsOpenChange={(open) => {
                    setCollectionsOpen(open);
                    writeShellCollectionsOpen(open);
                  }}
                  collectionFilter={collectionFilter}
                  onCollectionFilterChange={setCollectionFilter}
                  filteredCollections={filteredCollections}
                  collections={collections}
                  pinnedCollectionIds={pinnedCollectionIds}
                  browseCollectionId={browseCollectionId}
                  counts={counts.byCollectionId}
                  dropTargetCollectionId={dropTargetCollectionId}
                  collectionManageError={collectionManageError}
                  dragError={dragError}
                  mutationBusy={mutationBusy}
                  libraryLoading={libraryLoading}
                  onGoCollection={(id) => {
                    onGoCollection(id);
                    closeOnMobile();
                  }}
                  onCollectionDragOver={onCollectionDragOver}
                  onCollectionDragLeave={onCollectionDragLeave}
                  onCollectionDrop={onCollectionDrop}
                  onRenameCollection={onRenameCollection}
                  onTogglePinnedCollection={onTogglePinnedCollection}
                  onMovePinnedCollection={onMovePinnedCollection}
                  onDeleteCollection={onDeleteCollection}
                />

                <TagsSection
                  onSeeAll={onGoTags ? () => { onGoTags(); closeOnMobile(); } : undefined}
                  overviewActive={tagsView}
                  rail={!isMobile && !expanded ? {
                    label: tagsCollapsedLabel,
                    active: browseTagId !== null || tagsView,
                    onExpand: () => onPanelOpenChange(true),
                  } : undefined}
                  tagsOpen={tagsOpen}
                  onTagsOpenChange={(open) => {
                    setTagsOpen(open);
                    writeShellTagsOpen(open);
                  }}
                  tagFilter={tagFilter}
                  onTagFilterChange={setTagFilter}
                  filteredTags={filteredTags}
                  tags={tags}
                  browseTagId={browseTagId}
                  counts={counts.byTagId}
                  libraryLoading={libraryLoading}
                  onGoTag={(id) => {
                    onGoTag(id);
                    closeOnMobile();
                  }}
                  mutationBusy={mutationBusy}
                  onDeleteTag={onDeleteTag}
                />
              </div>
            ) : (
              <div className="flex shrink-0 flex-col gap-1">
                <ShellNavItem
                  expanded={false}
                  active={browseCollectionId !== null}
                  label={collectionsCollapsedLabel}
                  icon={
                    <CollectionIcon className="size-4 shrink-0 text-text-secondary" />
                  }
                  onClick={() => {
                    onPanelOpenChange(true);
                    setCollectionsOpen(true);
                    writeShellCollectionsOpen(true);
                  }}
                />
                <ShellNavItem
                  expanded={false}
                  active={browseTagId !== null}
                  label={tagsCollapsedLabel}
                  icon={
                    <HashIcon className="size-4 shrink-0 text-text-secondary" />
                  }
                  onClick={() => {
                    onPanelOpenChange(true);
                    setTagsOpen(true);
                    writeShellTagsOpen(true);
                  }}
                />
              </div>
            )}
          </div>

          <div className={`flex flex-col gap-1 ${contentExpanded ? "library-sidebar-footer-nav overflow-hidden" : ""}`}>
            <SidebarRowMenu label="Trash" mutationBusy={mutationBusy || libraryLoading} deleteLabel="Empty Trash" deleteDisabled={trashCount === 0} onDelete={() => onEmptyTrash?.()}>
              {(trigger) => contentExpanded ? (
                <div className={`group ${SHELL_NAV_SURFACE} min-h-10 w-full text-sm ${browseTrash ? SHELL_NAV_ITEM_ACTIVE : `${SHELL_NAV_ITEM_IDLE} focus-within:bg-bg-raised`}`}>
                  <button type="button" aria-label="Trash" aria-current={browseTrash ? "page" : undefined} data-sidebar-anchor="Trash"
                    className="flex min-h-10 min-w-0 flex-1 self-stretch items-center gap-2.5 rounded-control-md px-3 py-2 text-left transition-transform active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
                    onClick={() => { onGoTrash?.(); closeOnMobile(); }}>
                    <span data-sidebar-icon className="flex size-[18px] shrink-0 items-center justify-center"><DeleteIcon className="size-[18px]" /></span>
                    <span className="min-w-0 flex-1 truncate">Trash</span>
                    {!libraryLoading ? <NavCount value={trashCount} /> : null}
                  </button>
                  {trigger}
                </div>
              ) : (
                <ShellNavItem expanded={false} active={browseTrash} label="Trash" icon={<DeleteIcon className="size-[18px] shrink-0" />} onClick={() => { onGoTrash?.(); closeOnMobile(); }} />
              )}
            </SidebarRowMenu>
            <ShellNavLink
              expanded={contentExpanded}
              label="Help"
              href="/help"
              icon={<HelpIcon className="size-[18px] shrink-0 text-text-secondary" />}
            />
            <ShellNavLink
              expanded={contentExpanded}
              label="Settings"
              href="/settings"
              icon={
                <SettingsIcon className="size-[18px] shrink-0 text-text-secondary" />
              }
            />
          </div>
        </nav>
    </>
  );

  return (
    <>
      {isMobile ? (
        <>
          {mobileSidebarOpen ? <div className="w-14 shrink-0" aria-hidden="true" /> : (
            <aside
              id="library-sidebar"
              aria-label="Sidebar"
              className={`${SHELL_ASIDE} ${SHELL_SIDEBAR_COLLAPSED} relative z-30`}
              onClickCapture={(event) => {
                const opener = (event.target as HTMLElement).closest<HTMLElement>("button[data-sidebar-anchor]");
                if (opener) {
                  mobileOpener.current = opener;
                  mobileOpenerAnchor.current = opener.dataset.sidebarAnchor ?? null;
                }
              }}
            >
              {sidebarBody(false, false)}
            </aside>
          )}
          <Dialog.Root open={mobileSidebarOpen} onOpenChange={onPanelOpenChange}>
            <Dialog.Portal>
              <Dialog.Backdrop className="ui-backdrop fixed inset-0 z-50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
              <Dialog.Viewport className="fixed inset-0 z-50 flex overflow-hidden">
                <Dialog.Popup
                  className={`${SHELL_ASIDE} ${SHELL_SIDEBAR_EXPANDED} border-r border-border-control shadow-menu outline-none transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full motion-reduce:transition-none`}
                  initialFocus={() => document.querySelector<HTMLElement>('#library-sidebar [data-sidebar-anchor="All items"]')}
                  finalFocus={() => {
                    if (mobileOpener.current?.isConnected) return mobileOpener.current;
                    const anchor = mobileOpenerAnchor.current;
                    if (anchor) {
                      const returnedRailControl = document.querySelector<HTMLElement>(`#library-sidebar [data-sidebar-anchor="${CSS.escape(anchor)}"]`);
                      if (returnedRailControl) return returnedRailControl;
                    }
                    return document.querySelector<HTMLElement>('button[aria-controls="library-sidebar"]');
                  }}
                >
                  <Dialog.Title className="sr-only">Sidebar navigation</Dialog.Title>
                  <aside id={mobileSidebarOpen ? "library-sidebar" : undefined} aria-label="Sidebar" className="flex min-h-0 flex-1 flex-col">
                    {sidebarBody(true, true)}
                  </aside>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ) : (
        <aside
          id="library-sidebar"
          aria-label="Sidebar"
          data-state={expanded ? "open" : "closed"}
          data-ready={panelReady}
          className="library-sidebar-desktop relative z-50 h-full max-h-full min-h-0 shrink-0 overflow-visible"
        >
          <div
            className={`${SHELL_ASIDE} library-sidebar-panel absolute inset-y-0 left-0 z-10 shadow-menu`}
            data-sidebar-panel
            data-state={expanded ? "open" : "closed"}
          >
            {sidebarBody(true, false)}
          </div>
          <SidebarResizeHandle expanded={expanded} onExpandedChange={onPanelOpenChange} />
        </aside>
      )}
    </>
  );
}

function SidebarBrand({ expanded, mobileSidebarOpen, onClose, onGoHome }: {
  expanded: boolean;
  mobileSidebarOpen: boolean;
  onClose: () => void;
  onGoHome: () => void;
}) {
  return (
    <div data-sidebar-brand className={`mb-5 mt-[18px] flex h-10 shrink-0 items-center ${expanded ? "mx-4" : "mx-2"}`}>
      <LogoContextMenu>
        <Link
          href="/"
          onNavigate={(event) => {
            event.preventDefault();
            onGoHome();
          }}
          aria-label="Keepall home"
          data-sidebar-anchor="logo"
          className={`keepall-logo-link flex h-10 min-w-0 items-center gap-0 rounded-control text-text-primary ${expanded ? "w-fit px-3" : "w-10 justify-center"}`}
        >
          <span data-sidebar-icon className="flex shrink-0 items-center justify-center"><LogoIcon className="size-9" /></span>
          {expanded ? <span data-sidebar-copy className="shrink-0 text-xl font-medium leading-7">keepall</span> : null}
        </Link>
      </LogoContextMenu>
      {mobileSidebarOpen ? (
        <button type="button" aria-label="Close navigation" title="Close sidebar" className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-control hover:bg-bg-raised" onClick={onClose}>
          <ShellPanelIcon open />
        </button>
      ) : null}
    </div>
  );
}

function ShellNavLink({ expanded, label, href, icon }: {
  expanded: boolean;
  label: string;
  href: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${SHELL_NAV_ITEM} ${SHELL_NAV_ITEM_IDLE} ${
        expanded
          ? "min-h-10 w-full gap-2.5 px-3 py-2 text-left text-sm"
          : "mx-auto size-10 justify-center px-0"
      }`}
      aria-label={label}
      data-sidebar-anchor={label}
      title={!expanded ? label : undefined}
    >
      <span data-sidebar-icon className="flex size-[18px] shrink-0 items-center justify-center">
        {icon}
      </span>
      {expanded ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
    </Link>
  );
}

function CollectionsSection({
  rail,
  onSeeAll, overviewActive = false,
  collectionsOpen,
  onCollectionsOpenChange,
  collectionFilter,
  onCollectionFilterChange,
  filteredCollections,
  collections,
  pinnedCollectionIds,
  browseCollectionId,
  counts,
  dropTargetCollectionId,
  collectionManageError,
  dragError,
  mutationBusy,
  libraryLoading = false,
  onGoCollection,
  onCollectionDragOver,
  onCollectionDragLeave,
  onCollectionDrop,
  onRenameCollection,
  onTogglePinnedCollection,
  onMovePinnedCollection,
  onDeleteCollection,
}: {
  rail?: SidebarRailAction;
  onSeeAll?: () => void;
  overviewActive?: boolean;
  collectionsOpen: boolean;
  onCollectionsOpenChange: (open: boolean) => void;
  collectionFilter: string;
  onCollectionFilterChange: (value: string) => void;
  filteredCollections: Collection[];
  collections: Collection[];
  pinnedCollectionIds: string[];
  browseCollectionId: string | null;
  counts: Record<string, number>;
  dropTargetCollectionId: string | null;
  collectionManageError: string | null;
  dragError: string | null;
  mutationBusy: boolean;
  libraryLoading?: boolean;
  onGoCollection: (id: string) => void;
  onCollectionDragOver: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onCollectionDragLeave: () => void;
  onCollectionDrop: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onRenameCollection: (id: string, name: string) => void;
  onTogglePinnedCollection: (id: string) => void;
  onMovePinnedCollection: (sourceId: string, targetId: string) => void;
  onDeleteCollection: (id: string) => void;
}) {
  const [renamingCollectionId, setRenamingCollectionId] = useState<
    string | null
  >(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [reorderTargetId, setReorderTargetId] = useState<string | null>(null);
  const pinnedPositions = useMemo(
    () => new Map(pinnedCollectionIds.map((id, index) => [id, index])),
    [pinnedCollectionIds],
  );

  return (
    <CollapsibleSection
      rail={rail}
      onSeeAll={onSeeAll}
      overviewActive={overviewActive}
      overviewLabel="All collections"
      title="Collections"
      icon={<CollectionIcon />}
      open={collectionsOpen}
      onOpenChange={onCollectionsOpenChange}
    >
      <SidebarSearch
        label="Search collections"
        value={collectionFilter}
        onChange={onCollectionFilterChange}
      />

      <SidebarSectionScroll activeId={browseCollectionId} filter={collectionFilter} itemCount={filteredCollections.length}>
        <div className="flex flex-col gap-1">
          {filteredCollections.length === 0 ? (
            <p className="pb-2 pl-12 text-pretty text-xs text-text-secondary">
              {libraryLoading
                ? "Loading…"
                : collections.length === 0
                  ? "No collections yet."
                  : "No matches."}
            </p>
          ) : (
            filteredCollections.map((collection) => {
              const pinnedIndex = pinnedPositions.get(collection.id) ?? -1;
              const pinned = pinnedIndex >= 0;
              const previousPinnedId =
                pinnedIndex > 0 ? pinnedCollectionIds[pinnedIndex - 1] : null;
              const nextPinnedId =
                pinnedIndex >= 0 && pinnedIndex < pinnedCollectionIds.length - 1
                  ? pinnedCollectionIds[pinnedIndex + 1]
                  : null;

              return <CollectionNavRow
                key={collection.id}
                collection={collection}
                pinned={pinned}
                count={libraryLoading ? undefined : (counts[collection.id] ?? 0)}
                active={browseCollectionId === collection.id}
                dropHighlight={
                  dropTargetCollectionId === collection.id ||
                  reorderTargetId === collection.id
                }
                renaming={renamingCollectionId === collection.id}
                renameDraft={renameDraft}
                mutationBusy={mutationBusy}
                onNavigate={() => onGoCollection(collection.id)}
                onDragOver={(event) => onCollectionDragOver(collection.id, event)}
                onDragLeave={onCollectionDragLeave}
                onDrop={(event) => onCollectionDrop(collection.id, event)}
                onReorderDragStart={(event) => {
                  event.dataTransfer.setData(
                    COLLECTION_REORDER_MIME,
                    collection.id,
                  );
                  event.dataTransfer.effectAllowed = "move";
                }}
                onReorderDragOver={(event) => {
                  if (
                    !event.dataTransfer.types.includes(COLLECTION_REORDER_MIME)
                  ) {
                    return false;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setReorderTargetId(collection.id);
                  return true;
                }}
                onReorderDrop={(event) => {
                  const sourceId = event.dataTransfer.getData(
                    COLLECTION_REORDER_MIME,
                  );
                  if (!sourceId) {
                    return false;
                  }
                  event.preventDefault();
                  setReorderTargetId(null);
                  onMovePinnedCollection(sourceId, collection.id);
                  return true;
                }}
                onReorderDragEnd={() => setReorderTargetId(null)}
                onStartRename={() => {
                  setRenamingCollectionId(collection.id);
                  setRenameDraft(collection.name);
                }}
                onRenameDraftChange={setRenameDraft}
                onCancelRename={() => {
                  setRenamingCollectionId(null);
                  setRenameDraft("");
                }}
                onSubmitRename={() => {
                  const trimmed = renameDraft.trim();
                  if (
                    !trimmed ||
                    trimmed === collection.name.trim() ||
                    mutationBusy
                  ) {
                    setRenamingCollectionId(null);
                    setRenameDraft("");
                    return;
                  }
                  onRenameCollection(collection.id, trimmed);
                  setRenamingCollectionId(null);
                  setRenameDraft("");
                }}
                onTogglePin={() => onTogglePinnedCollection(collection.id)}
                onMoveUp={
                  previousPinnedId
                    ? () =>
                        onMovePinnedCollection(collection.id, previousPinnedId)
                    : undefined
                }
                onMoveDown={
                  nextPinnedId
                    ? () =>
                        onMovePinnedCollection(nextPinnedId, collection.id)
                    : undefined
                }
                onDelete={() => onDeleteCollection(collection.id)}
              />;
            })
          )}

          {dragError ? (
            <p className="mt-2 pl-12 text-pretty text-xs text-text-danger" role="alert">
              {dragError}
            </p>
          ) : null}

          {collectionManageError ? (
            <p className="mt-2 pl-12 text-pretty text-xs text-text-danger" role="alert">
              {collectionManageError}
            </p>
          ) : null}
        </div>
      </SidebarSectionScroll>
    </CollapsibleSection>
  );
}

function TagsSection({
  rail,
  onSeeAll, overviewActive = false,
  tagsOpen,
  onTagsOpenChange,
  tagFilter,
  onTagFilterChange,
  filteredTags,
  tags,
  browseTagId,
  counts,
  libraryLoading = false,
  onGoTag,
  mutationBusy,
  onDeleteTag,
}: {
  rail?: SidebarRailAction;
  onSeeAll?: () => void;
  overviewActive?: boolean;
  tagsOpen: boolean;
  onTagsOpenChange: (open: boolean) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  filteredTags: Tag[];
  tags: Tag[];
  browseTagId: string | null;
  counts: Record<string, number>;
  libraryLoading?: boolean;
  onGoTag: (id: string) => void;
  mutationBusy: boolean;
  onDeleteTag: (id: string) => void;
}) {
  return (
    <CollapsibleSection
      rail={rail}
      onSeeAll={onSeeAll}
      overviewActive={overviewActive}
      overviewLabel="All tags"
      icon={<HashIcon />}
      title={
        libraryLoading
          ? "Tags"
          : tags.length > 0
            ? `Tags (${tags.length})`
            : "Tags"
      }
      open={tagsOpen}
      onOpenChange={onTagsOpenChange}
    >
      <SidebarSearch
        label="Search tags"
        value={tagFilter}
        onChange={onTagFilterChange}
      />

      <SidebarSectionScroll activeId={browseTagId} filter={tagFilter} itemCount={filteredTags.length}>
        <div className="flex flex-col gap-1">
          {filteredTags.length === 0 ? (
            <p className="pb-2 pl-12 text-pretty text-xs text-text-secondary">
              {libraryLoading
                ? "Loading…"
                : tags.length === 0
                  ? "No tags yet."
                  : "No matches."}
            </p>
          ) : (
            filteredTags.map((tag) => (
              <TagNavRow
                key={tag.id}
                tag={tag}
                active={browseTagId === tag.id}
                count={libraryLoading ? undefined : (counts[tag.id] ?? 0)}
                mutationBusy={mutationBusy}
                onNavigate={() => onGoTag(tag.id)}
                onDelete={() => onDeleteTag(tag.id)}
              />
            ))
          )}
        </div>
      </SidebarSectionScroll>
    </CollapsibleSection>
  );
}

function SidebarSectionScroll({ activeId, filter, itemCount, children }: {
  activeId: string | null;
  filter: string;
  itemCount: number;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const revealSelected = useCallback(() => {
    const container = scrollRef.current;
    const selected = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !selected) return;

    const bounds = container.getBoundingClientRect();
    const row = selected.getBoundingClientRect();
    // Clear the scroll-fade's min(12%, 40px) band plus a little breathing room.
    const inset = Math.min(
      Math.min(container.clientHeight * 0.12, 40) + 8,
      Math.max(0, (bounds.height - row.height) / 2),
    );
    const top = bounds.top + inset;
    const bottom = bounds.bottom - inset;
    if (row.top < top) container.scrollTop += row.top - top;
    else if (row.bottom > bottom) container.scrollTop += row.bottom - bottom;
  }, []);

  useEffect(() => {
    revealSelected();
  }, [activeId, filter, itemCount, revealSelected]);

  return (
    <div
      ref={scrollRef}
      className="library-sidebar-section-scroll scroll-fade min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
      onClick={(event) => {
        if ((event.target as Element).closest('[aria-current="page"]')) revealSelected();
      }}
    >
      {children}
    </div>
  );
}

function TagNavRow({
  tag,
  count,
  active,
  mutationBusy,
  onNavigate,
  onDelete,
}: {
  tag: Tag;
  count?: number;
  active: boolean;
  mutationBusy: boolean;
  onNavigate: () => void;
  onDelete: () => void;
}) {
  return (
    <SidebarRowMenu
      label={tag.name}
      mutationBusy={mutationBusy}
      onDelete={onDelete}
    >
      {(trigger) => (
        <div className={`group ${SHELL_NAV_SURFACE} flex min-w-0 w-full items-center pr-2 text-sm ${active ? `${SHELL_NAV_ITEM_ACTIVE} font-medium text-text-primary` : `${SHELL_NAV_ITEM_IDLE} text-text-secondary focus-within:bg-bg-raised`}`}>
          <button
            type="button"
            className="flex min-h-9 min-w-0 flex-1 self-stretch items-center gap-2 rounded-control-md py-2 pl-12 text-left transition-transform active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
            aria-label={`Tag ${tag.name}`}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <span className="min-w-0 flex-1 truncate" title={tag.name}>{tag.name}</span>
            {count !== undefined ? <NavCount value={count} /> : null}
          </button>
          {trigger}
        </div>
      )}
    </SidebarRowMenu>
  );
}

function CollectionNavRow({
  collection,
  pinned,
  count,
  active,
  dropHighlight,
  renaming,
  renameDraft,
  mutationBusy,
  onNavigate,
  onDragOver,
  onDragLeave,
  onDrop,
  onReorderDragStart,
  onReorderDragOver,
  onReorderDrop,
  onReorderDragEnd,
  onStartRename,
  onRenameDraftChange,
  onCancelRename,
  onSubmitRename,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  collection: Collection;
  pinned: boolean;
  count?: number;
  active: boolean;
  dropHighlight: boolean;
  renaming: boolean;
  renameDraft: string;
  mutationBusy: boolean;
  onNavigate: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onReorderDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onReorderDragOver: (event: DragEvent<HTMLDivElement>) => boolean;
  onReorderDrop: (event: DragEvent<HTMLDivElement>) => boolean;
  onReorderDragEnd: () => void;
  onStartRename: () => void;
  onRenameDraftChange: (value: string) => void;
  onCancelRename: () => void;
  onSubmitRename: () => void;
  onTogglePin: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
}) {
  if (renaming) {
    return (
      <form
        className={`${SHELL_NAV_SURFACE} ${SHELL_NAV_ITEM_ACTIVE} w-full gap-2 py-1.5 pl-12 pr-2`}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitRename();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-[6px] border border-border-edge/80 bg-bg-surface px-1.5 py-0.5 text-sm outline-none focus:border-border-focus"
          autoFocus
          value={renameDraft}
          disabled={mutationBusy}
          aria-label="Rename collection"
          onChange={(event) => onRenameDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelRename();
            }
          }}
          onBlur={() => {
            const trimmed = renameDraft.trim();
            if (!trimmed || trimmed === collection.name.trim()) {
              onCancelRename();
              return;
            }
            onSubmitRename();
          }}
        />
      </form>
    );
  }

  return (
    <SidebarRowMenu
      label={collection.name}
      mutationBusy={mutationBusy}
      pinned={pinned}
      onTogglePin={onTogglePin}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onRename={onStartRename}
      onDelete={onDelete}
    >
      {(trigger) => (
        <div
          className={`group ${SHELL_NAV_SURFACE} flex min-w-0 w-full items-center pr-2 text-sm ${
            active
              ? `${SHELL_NAV_ITEM_ACTIVE} font-medium text-text-primary`
              : `${SHELL_NAV_ITEM_IDLE} text-text-secondary focus-within:bg-bg-raised`
          } ${dropHighlight ? "ring-2 ring-border-focus" : ""}`}
          draggable={pinned && !mutationBusy}
          onDragStart={onReorderDragStart}
          onDragOver={(event) => {
            if (!onReorderDragOver(event)) onDragOver(event);
          }}
          onDragLeave={() => {
            onReorderDragEnd();
            onDragLeave();
          }}
          onDrop={(event) => {
            if (!onReorderDrop(event)) onDrop(event);
          }}
          onDragEnd={onReorderDragEnd}
        >
          <button
            type="button"
            className="squircle-panel flex min-h-9 min-w-0 flex-1 self-stretch items-center gap-2 rounded-control-md py-2 text-left transition-transform active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
            aria-label={collection.name}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <span
              aria-hidden="true"
              className="flex h-[18px] w-10 shrink-0 translate-x-[18px] items-center justify-center text-collection-marker"
              style={collectionMarkerStyle(collection.id)}
              title={pinned ? "Pinned collection" : undefined}
            >
              {pinned ? <PinIcon className="size-3" fill="currentColor" /> : <span className="size-2 rounded-full bg-collection-marker" />}
            </span>
            <span className="min-w-0 flex-1 truncate" title={collection.name}>{collection.name}</span>
            {count !== undefined ? <NavCount value={count} /> : null}
          </button>
          {trigger}
        </div>
      )}
    </SidebarRowMenu>
  );
}

function SidebarRowMenu({
  children,
  label,
  mutationBusy,
  pinned,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  onRename,
  onDelete,
  deleteLabel = "Delete", deleteDisabled = false,
}: {
  children: (trigger: ReactNode) => ReactElement;
  label: string;
  mutationBusy: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRename?: () => void;
  onDelete: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  function openDialog(action: () => void) {
    openingDialog.current = true;
    action();
  }
  const actionsLabel = `${label} actions`;

  const trigger = (
    <button
      type="button"
      className="absolute right-0 flex size-7 shrink-0 items-center justify-center rounded-[6px] text-text-secondary hover:bg-bg-raised/70 focus-visible:bg-bg-raised/70 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[popup-open]:bg-bg-raised data-[popup-open]:opacity-100 disabled:cursor-default"
      aria-label={actionsLabel}
      disabled={mutationBusy}
    >
      <MoreIcon />
    </button>
  );

  return (
    <RowActionMenu trigger={trigger} label={actionsLabel} disabled={mutationBusy} triggerRef={triggerRef}
      onOpen={() => { openingDialog.current = false; }}
      finalFocus={() => openingDialog.current ? false : triggerRef.current}
      menu={() =>
        <>
          {onTogglePin ? (
            <Menu.Item className="ui-menu-item flex w-full text-left text-sm text-text-primary data-[highlighted]:bg-bg-active" onClick={onTogglePin}>
              {pinned ? "Unpin" : "Pin to top"}
            </Menu.Item>
          ) : null}
          {pinned && onMoveUp ? (
            <Menu.Item className="ui-menu-item flex w-full text-left text-sm text-text-primary data-[highlighted]:bg-bg-active" onClick={onMoveUp}>
              Move up
            </Menu.Item>
          ) : null}
          {pinned && onMoveDown ? (
            <Menu.Item className="ui-menu-item flex w-full text-left text-sm text-text-primary data-[highlighted]:bg-bg-active" onClick={onMoveDown}>
              Move down
            </Menu.Item>
          ) : null}
          {onRename ? (
            <Menu.Item className="ui-menu-item flex w-full text-left text-sm text-text-primary data-[highlighted]:bg-bg-active" onClick={() => openDialog(onRename)}>
              Rename
            </Menu.Item>
          ) : null}
          <Menu.Item disabled={deleteDisabled} className="ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-danger hover:bg-bg-danger data-[highlighted]:bg-bg-danger data-[disabled]:opacity-50" onClick={() => openDialog(onDelete)}>
            <DeleteIcon className="size-4" /><span className="leading-none">{deleteLabel}</span>
          </Menu.Item>
        </>
      }
    >
      {children}
    </RowActionMenu>
  );
}

function ShellNavItem({
  expanded,
  active = false,
  label,
  ariaLabel,
  icon,
  count,
  dropHighlight = false,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  expanded: boolean;
  active?: boolean;
  label: string;
  ariaLabel?: string;
  icon?: ReactNode;
  count?: number;
  dropHighlight?: boolean;
  onClick: () => void;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`${SHELL_NAV_ITEM} ${
        expanded
          ? icon ? "min-h-10 w-full gap-2.5 px-3 py-2 text-left text-sm" : "min-h-8 w-full gap-2.5 ps-[38px] pe-3 py-1 text-left text-xs"
          : "mx-auto size-10 justify-center px-0"
      } ${active ? SHELL_NAV_ITEM_ACTIVE : SHELL_NAV_ITEM_IDLE} ${
        dropHighlight ? "ring-2 ring-border-focus" : ""
      }`}
      aria-label={ariaLabel ?? label}
      data-sidebar-anchor={icon ? label : undefined}
      aria-current={active ? "page" : undefined}
      title={!expanded ? label : undefined}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {icon ? <span data-sidebar-icon className="flex size-[18px] shrink-0 items-center justify-center">{icon}</span> : null}
      {expanded ? (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count !== undefined ? <NavCount value={count} /> : null}
        </>
      ) : null}
    </button>
  );
}

function NavCount({ value }: { value: number }) {
  return (
    <span
      aria-hidden
      className="library-sidebar-count ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-text-secondary group-hover:opacity-0 group-focus-within:opacity-0"
    >
      {value}
    </span>
  );
}

function CollapsibleSection({
  rail,
  onSeeAll, overviewActive = false, overviewLabel,
  title,
  icon,
  open,
  onOpenChange,
  children,
}: {
  rail?: SidebarRailAction;
  onSeeAll?: () => void;
  overviewLabel?: string;
  overviewActive?: boolean;
  title: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (rail && detailsRef.current?.contains(document.activeElement)) {
      document.querySelector<HTMLButtonElement>('button[aria-controls="library-sidebar"]')?.focus();
    }
  }, [rail]);

  return (
    <div className={`${open ? "flex min-h-0 flex-1 flex-col" : "shrink-0"} pt-4`}>
      <div className="mb-1 flex h-10 shrink-0 items-center">
        <button
          type="button"
          data-sidebar-anchor={title}
          aria-label={rail?.label ?? title}
          title={rail?.label}
          aria-current={rail?.active ? "page" : undefined}
          className={`squircle-panel flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-control-md px-3 text-left text-text-primary hover:bg-bg-raised ${rail?.active ? SHELL_NAV_ITEM_ACTIVE : ""}`}
          aria-expanded={rail ? false : open}
          onClick={() => rail ? rail.onExpand() : onOpenChange(!open)}
        >
          <span data-sidebar-icon className="flex size-[18px] shrink-0 items-center justify-center">{icon}</span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{title}</span>
          <ChevronDownIcon
            className={`size-3.5 text-text-secondary transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
              open ? "" : "-rotate-90"
            }`}
          />
        </button>
      </div>
      {open ? (
        <div
          ref={detailsRef}
          data-sidebar-details
          inert={Boolean(rail)}
          aria-hidden={rail ? true : undefined}
          className={`flex min-h-0 flex-1 flex-col gap-1 overflow-hidden ${rail ? "invisible" : ""}`}
        >
          {children}
          {onSeeAll ? <div className="library-sidebar-overview-footer shrink-0 px-3 pt-1">
            <button type="button" aria-current={overviewActive ? "page" : undefined} onClick={onSeeAll} className={`flex min-h-8 w-full items-center gap-2 rounded-control-md px-3 text-xs font-medium outline-none hover:bg-bg-active focus-visible:outline-2 focus-visible:outline-border-focus ${overviewActive ? "bg-bg-selected text-text-primary" : "bg-bg-raised text-text-secondary"}`}>
              {overviewLabel === "All collections" ? <CollectionIcon className="size-3.5" /> : <HashIcon className="size-3.5" />}<span className="min-w-0 truncate">{overviewLabel}</span>
              <ArrowRightIcon className="ml-auto size-3.5" />
            </button>
          </div> : null}
        </div>
      ) : null}
    </div>
  );
}

function SidebarSearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="shrink-0 px-3">
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <SearchIcon className="pointer-events-none absolute left-[19px] top-1/2 size-3.5 -translate-y-1/2 text-text-secondary" />
        <input
          className="h-7 w-full rounded-control border border-transparent bg-transparent pl-9 pr-2 text-xs"
          placeholder={label === "Search collections" ? "Search folders" : label}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
