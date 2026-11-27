"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScrollPanel } from "@/components/ui/scroll-panel";
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
import type { LibraryTypeSelection } from "@/domain/library-view";
import type { Item } from "@/domain/item";
import type { Tag } from "@/domain/tag";
import { useTranslations } from "@/i18n/use-translations";
import { JumpPalette, type JumpFilter } from "./jump-palette";
import type { LibrarySidebarCounts } from "./library-sidebar-counts";
import {
  AgentIcon,
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
import { useAgentReviewOffer } from "./use-agent-review-offer";
import {
  SHELL_ASIDE,
  SHELL_NAV_GUTTER,
  SHELL_NAV_ITEM,
  SHELL_NAV_ITEM_ACTIVE,
  SHELL_NAV_ITEM_IDLE,
  SHELL_NAV_SURFACE,
  SHELL_SIDEBAR_COLLAPSED,
  SHELL_SIDEBAR_EXPANDED,
} from "./shell-styles";
import { useShellMobile } from "./use-shell-mobile";
import { ShellPanelIcon } from "./shell-panel-icon";
import { collectionMarkerStyle } from "./collection-marker";
import { LogoContextMenu } from "./logo-context-menu";
import { SidebarResizeHandle } from "./sidebar-resize-handle";
import { menuItemClassName } from "@/components/ui/menu-item";
import { Tooltip } from "@/components/ui/tooltip";

const COLLECTION_REORDER_MIME = "application/x-keepall-pinned-collection";

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
  browseType: LibraryTypeSelection;
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
  /** Newest items in a collection or tag, shown in the jump palette's preview. */
  recentItems?: (kind: "collection" | "tag", id: string) => Item[];
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
  recentItems,
}: Props) {
  const t = useTranslations("LibraryShell");
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpFilter, setJumpFilter] = useState<JumpFilter>("all");
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

  const jumpOpener = useRef<HTMLElement | null>(null);
  const openJump = useCallback((filter: JumpFilter) => {
    jumpOpener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    setJumpFilter(filter);
    setJumpOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "KeyK" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat || event.isComposing) return;
      if (!jumpOpen && document.querySelector('[role="dialog"]:not([data-ending-style]), [role="alertdialog"]:not([data-ending-style])')) return;
      event.preventDefault();
      if (jumpOpen) setJumpOpen(false); else openJump("all");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [jumpOpen, openJump]);

  const pinnedCollections = useMemo(() => {
    const byId = new Map(collections.map(collection => [collection.id, collection]));
    return pinnedCollectionIds.flatMap(id => byId.get(id) ?? []);
  }, [collections, pinnedCollectionIds]);

  const { offer: agentReview } = useAgentReviewOffer();
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

  const collectionsActive = browseCollectionId !== null || collectionsView;
  const tagsActive = browseTagId !== null || tagsView;

  const renderPrimaryNav = (contentExpanded: boolean) => (
    <>
      <ShellNavItem
        expanded={contentExpanded}
        label={t("jumpTo")}
        ariaLabel={t("jumpToLabel")}
        hasPopup
        shortcut={t("jumpShortcut")}
        icon={<SearchIcon className="size-4.5 shrink-0 text-text-secondary" />}
        onClick={() => openJump("all")}
      />
      <ShellNavItem
        expanded={contentExpanded}
        active={allItemsActive}
        label={t("allItems")}
        count={libraryLoading ? undefined : counts.all}
        icon={<LibraryIcon className="size-4.5 shrink-0 text-text-secondary" />}
        onClick={() => {
          onGoAll();
          closeOnMobile();
        }}
      />
      <ShellNavItem
        expanded={contentExpanded}
        active={unsortedActive}
        label={t("unsorted")}
        count={libraryLoading ? undefined : counts.unsorted}
        icon={<InboxIcon className="size-4.5 shrink-0 text-text-secondary" />}
        onClick={() => {
          onGoUnsorted();
          closeOnMobile();
        }}
      />
      {/* Only while an agent's suggestions wait, so people who don't use agents never see it. */}
      {agentReview ? (
        <ShellNavLink expanded={contentExpanded} label={t("agentReview")} href="/review" count={agentReview.items}
          icon={<AgentIcon className="size-4.5 shrink-0 text-text-secondary" />} />
      ) : null}
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
          aria-label={t("sidebarNavigation")}
          className={`library-sidebar-navigation grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-5 overflow-hidden pb-4.5 ${contentExpanded ? SHELL_NAV_GUTTER : "px-2"}`}
        >
          <div className={`flex min-h-0 flex-col gap-1 ${contentExpanded ? "overflow-hidden" : "scroll-fade overflow-y-auto overscroll-contain"}`}>
            <div className={`flex shrink-0 flex-col gap-1 ${contentExpanded ? "library-sidebar-primary-nav overflow-hidden" : ""}`}>
              {renderPrimaryNav(contentExpanded)}
            </div>

            <div className="flex shrink-0 flex-col gap-1 pt-4">
              <ShellNavItem
                expanded={contentExpanded}
                active={collectionsActive}
                label={t("collections")}
                hasPopup
                count={libraryLoading ? undefined : collections.length}
                icon={<CollectionIcon className="size-4.5 shrink-0 text-text-secondary" />}
                onClick={() => openJump("collections")}
              />
              <ShellNavItem
                expanded={contentExpanded}
                active={tagsActive}
                label={t("tags")}
                hasPopup
                count={libraryLoading ? undefined : tags.length}
                icon={<HashIcon className="size-4.5 shrink-0 text-text-secondary" />}
                onClick={() => openJump("tags")}
              />
            </div>

            {contentExpanded && (isMobile || expanded) ? (
              <PinnedCollectionsSection
                rescueFocusOnHide={!isMobile}
                pinnedCollections={pinnedCollections}
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
            ) : null}
          </div>

          <div className={`flex flex-col gap-1 ${contentExpanded ? "library-sidebar-footer-nav overflow-hidden" : ""}`}>
            <SidebarRowMenu label={t("trash")} mutationBusy={mutationBusy || libraryLoading} deleteLabel={t("emptyTrash")} deleteDisabled={trashCount === 0} onDelete={() => onEmptyTrash?.()}>
              {(trigger) => contentExpanded ? (
                <div className={cn(`group ${SHELL_NAV_SURFACE} min-h-10 w-full text-sm ${browseTrash ? SHELL_NAV_ITEM_ACTIVE : `${SHELL_NAV_ITEM_IDLE} focus-within:bg-bg-raised`}`)}>
                  <button type="button" aria-label={t("trash")} aria-current={browseTrash ? "page" : undefined} data-sidebar-anchor="Trash"
                    className="flex min-h-10 min-w-0 flex-1 self-stretch items-center gap-2.5 px-3 py-2 text-left transition-transform active:scale-98 motion-reduce:transition-none motion-reduce:active:scale-100"
                    onClick={() => { onGoTrash?.(); closeOnMobile(); }}>
                    <span data-sidebar-icon className="flex size-4.5 shrink-0 items-center justify-center"><DeleteIcon className="size-4.5" /></span>
                    <span className="min-w-0 flex-1 truncate">{t("trash")}</span>
                    {!libraryLoading ? <NavCount value={trashCount} /> : null}
                  </button>
                  {trigger}
                </div>
              ) : (
                <ShellNavItem expanded={false} active={browseTrash} label={t("trash")} icon={<DeleteIcon className="size-4.5 shrink-0" />} onClick={() => { onGoTrash?.(); closeOnMobile(); }} />
              )}
            </SidebarRowMenu>
            <ShellNavLink
              expanded={contentExpanded}
              label={t("help")}
              href="/help"
              icon={<HelpIcon className="size-4.5 shrink-0 text-text-secondary" />}
            />
            <ShellNavLink
              expanded={contentExpanded}
              label={t("settings")}
              href="/settings"
              icon={
                <SettingsIcon className="size-4.5 shrink-0 text-text-secondary" />
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
              aria-label={t("sidebar")}
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
                  className={`${SHELL_ASIDE} ${SHELL_SIDEBAR_EXPANDED} border-r border-border-control shadow-menu outline-none transition-transform duration-300 ease-standard data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full motion-reduce:transition-none`}
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
                  <Dialog.Title className="sr-only">{t("sidebarNavigation")}</Dialog.Title>
                  <aside id={mobileSidebarOpen ? "library-sidebar" : undefined} aria-label={t("sidebar")} className="flex min-h-0 flex-1 flex-col">
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
          aria-label={t("sidebar")}
          data-state={expanded ? "open" : "closed"}
          data-ready={panelReady}
          className="library-sidebar-desktop relative z-50 h-full max-h-full min-h-0 shrink-0 overflow-visible"
        >
          <div
            className="library-sidebar-panel absolute inset-y-0 left-0 z-10"
            data-sidebar-panel
            data-state={expanded ? "open" : "closed"}
          >
            <div className={`${SHELL_ASIDE} library-sidebar-content`}>
              {sidebarBody(true, false)}
            </div>
          </div>
          <SidebarResizeHandle expanded={expanded} onExpandedChange={onPanelOpenChange} />
        </aside>
      )}
      <JumpPalette
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        filter={jumpFilter}
        onFilterChange={setJumpFilter}
        collections={collections}
        tags={tags}
        pinnedCollectionIds={pinnedCollectionIds}
        collectionCounts={counts.byCollectionId}
        tagCounts={counts.byTagId}
        mutationBusy={mutationBusy}
        recentItems={recentItems}
        onGoCollection={(id) => { onGoCollection(id); closeOnMobile(); }}
        onGoTag={(id) => { onGoTag(id); closeOnMobile(); }}
        onGoCollections={() => { onGoCollections?.(); closeOnMobile(); }}
        onGoTags={() => { onGoTags?.(); closeOnMobile(); }}
        onTogglePinnedCollection={onTogglePinnedCollection}
        onRenameCollection={onRenameCollection}
        onDeleteCollection={onDeleteCollection}
        onDeleteTag={onDeleteTag}
        returnFocus={() => (jumpOpener.current?.isConnected ? jumpOpener.current : null)}
      />
    </>
  );
}

function SidebarBrand({ expanded, mobileSidebarOpen, onClose, onGoHome }: {
  expanded: boolean;
  mobileSidebarOpen: boolean;
  onClose: () => void;
  onGoHome: () => void;
}) {
  const t = useTranslations("LibraryShell");
  return (
    <div data-sidebar-brand className={`mb-5 mt-4.5 flex h-10 shrink-0 items-center ${expanded ? "mx-4" : "mx-2"}`}>
      <LogoContextMenu>
        <Link
          href="/"
          onNavigate={(event) => {
            event.preventDefault();
            onGoHome();
          }}
          aria-label={t("home")}
          data-sidebar-anchor="logo"
          className={`keepall-logo-link flex h-10 min-w-0 items-center gap-0 text-text-primary ${expanded ? "w-fit px-3" : "w-10 justify-center"}`}
        >
          <span data-sidebar-icon className="flex shrink-0 items-center justify-center"><LogoIcon className="size-9" /></span>
          {/* The wordmark is the product name, the same in every language. */}
          {/* eslint-disable-next-line react/jsx-no-literals */}
          {expanded ? <span data-sidebar-copy className="shrink-0 text-xl font-medium leading-7">keepall</span> : null}
        </Link>
      </LogoContextMenu>
      {mobileSidebarOpen ? (
        <Tooltip content={t("closeSidebar")} describe={false}><button type="button" aria-label={t("closeNavigation")} className="ml-auto flex size-8 shrink-0 items-center justify-center hover:bg-bg-raised" onClick={onClose}>
          <ShellPanelIcon open />
        </button></Tooltip>
      ) : null}
    </div>
  );
}

function ShellNavLink({ expanded, label, href, icon, count }: {
  expanded: boolean;
  label: string;
  href: string;
  icon: ReactNode;
  count?: number;
}) {
  return (
<Tooltip content={label} disabled={expanded} side="right" describe={false}>
    <Link
      href={href}
      className={cn(`${SHELL_NAV_ITEM} ${SHELL_NAV_ITEM_IDLE} ${
        expanded
          ? "min-h-10 w-full gap-2.5 px-3 py-2 text-left text-sm"
          : "mx-auto size-10 justify-center px-0"
      }`)}
      aria-label={label}
      data-sidebar-anchor={label}
    >
      <span data-sidebar-icon className="flex size-4.5 shrink-0 items-center justify-center">
        {icon}
      </span>
      {expanded ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
      {expanded && count !== undefined ? <NavCount value={count} /> : null}
    </Link></Tooltip>
  );
}

function PinnedCollectionsSection({
  rescueFocusOnHide,
  pinnedCollections,
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
  /** Desktop only: collapsing the sidebar removes this section, so focus inside it moves to the Expand button. */
  rescueFocusOnHide: boolean;
  pinnedCollections: Collection[];
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
  const t = useTranslations("LibraryShell");
  const sectionRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const section = sectionRef.current;
    return () => {
      if (rescueFocusOnHide && section?.contains(document.activeElement)) {
        document.querySelector<HTMLButtonElement>('button[aria-controls="library-sidebar"]')?.focus();
      }
    };
  }, [rescueFocusOnHide]);
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
    <section ref={sectionRef} aria-labelledby="sidebar-pinned-heading" className="library-sidebar-section flex min-h-0 flex-1 flex-col pt-4">
      <h2 id="sidebar-pinned-heading" className="shrink-0 px-3 pb-1 text-2xs font-semibold tracking-wide text-text-secondary uppercase">{t("pinned")}</h2>
      <SidebarSectionScroll activeId={browseCollectionId} filter="" itemCount={pinnedCollections.length}>
        <div className="flex flex-col gap-1">
          {pinnedCollections.length === 0 ? (
            <p className="px-3 pb-2 text-pretty text-xs text-text-secondary">
              {libraryLoading ? t("loading") : t("pinnedEmpty")}
            </p>
          ) : (
            pinnedCollections.map((collection) => {
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
            <p className="mt-2 px-3 text-pretty text-xs text-text-danger" role="alert">
              {dragError}
            </p>
          ) : null}

          {collectionManageError ? (
            <p className="mt-2 px-3 text-pretty text-xs text-text-danger" role="alert">
              {collectionManageError}
            </p>
          ) : null}
        </div>
      </SidebarSectionScroll>
    </section>
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
    <ScrollPanel
      viewportRef={scrollRef}
      className="library-sidebar-section-scroll min-h-0 flex-1"
      viewportClassName="scroll-fade overscroll-contain"
      onClick={(event) => {
        if ((event.target as Element).closest('[aria-current="page"]')) revealSelected();
      }}
    >
      <div className="pr-1">{children}</div>
    </ScrollPanel>
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
  const t = useTranslations("LibraryShell");
  if (renaming) {
    return (
      <form
        className={cn(`${SHELL_NAV_SURFACE} ${SHELL_NAV_ITEM_ACTIVE} w-full gap-2 py-1.5 ps-10 pe-2`)}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitRename();
        }}
      >
        <input
          className="min-w-0 flex-1 border border-border-edge/80 bg-bg-surface px-1.5 py-0.5 text-sm outline-none focus:border-border-focus"
          autoFocus
          value={renameDraft}
          disabled={mutationBusy}
          aria-label={t("renameCollection")}
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
          className={cn(`group ${SHELL_NAV_SURFACE} flex min-w-0 w-full items-center pr-2 text-sm ${
            active
              ? `${SHELL_NAV_ITEM_ACTIVE} font-medium text-text-primary`
              : `${SHELL_NAV_ITEM_IDLE} text-text-secondary focus-within:bg-bg-raised`
          } ${dropHighlight ? "ring-2 ring-border-focus" : ""}`)}
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
            className="flex min-h-10 min-w-0 flex-1 self-stretch items-center gap-2.5 py-2 ps-3 text-left transition-transform active:scale-96 motion-reduce:transition-none motion-reduce:active:scale-100"
            aria-label={collection.name}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <span
              aria-hidden="true"
              className="flex size-4.5 shrink-0 items-center justify-center text-collection-marker"
              // eslint-disable-next-line shadcn/no-inline-styles -- Per-collection marker hue and lightness custom properties.
              style={collectionMarkerStyle(collection.id)}
              title={pinned ? t("pinnedCollection") : undefined}
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
  deleteLabel, deleteDisabled = false,
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
  const t = useTranslations("LibraryShell");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  function openDialog(action: () => void) {
    openingDialog.current = true;
    action();
  }
  const actionsLabel = t("rowActions", { label });

  const trigger = (
    <button
      type="button"
      className="absolute right-0 flex size-7 shrink-0 items-center justify-center text-text-secondary hover:bg-bg-raised/70 focus-visible:bg-bg-raised/70 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[popup-open]:bg-bg-raised data-[popup-open]:opacity-100 disabled:cursor-default"
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
            <Menu.Item className={menuItemClassName({ layout: "none", className: "text-left" })} onClick={onTogglePin}>
              {pinned ? t("unpin") : t("pinToTop")}
            </Menu.Item>
          ) : null}
          {pinned && onMoveUp ? (
            <Menu.Item className={menuItemClassName({ layout: "none", className: "text-left" })} onClick={onMoveUp}>
              {t("moveUp")}
            </Menu.Item>
          ) : null}
          {pinned && onMoveDown ? (
            <Menu.Item className={menuItemClassName({ layout: "none", className: "text-left" })} onClick={onMoveDown}>
              {t("moveDown")}
            </Menu.Item>
          ) : null}
          {onRename ? (
            <Menu.Item className={menuItemClassName({ layout: "none", className: "text-left" })} onClick={() => openDialog(onRename)}>
              {t("rename")}
            </Menu.Item>
          ) : null}
          <Menu.Item disabled={deleteDisabled} className={menuItemClassName({ tone: "danger", layout: "none", className: "items-center gap-2 text-left hover:bg-bg-danger data-[disabled]:opacity-50" })} onClick={() => openDialog(onDelete)}>
            <DeleteIcon className="size-4" /><span className="leading-none">{deleteLabel ?? t("delete")}</span>
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
  hasPopup = false,
  shortcut,
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
  /** Opens a dialog rather than navigating. */
  hasPopup?: boolean;
  /** Keyboard hint shown in place of a count. */
  shortcut?: string;
  dropHighlight?: boolean;
  onClick: () => void;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
<Tooltip content={label} disabled={expanded} side="right" describe={false}>
    <button
      type="button"
      className={cn(`${SHELL_NAV_ITEM} ${
        expanded
          ? icon ? "min-h-10 w-full gap-2.5 px-3 py-2 text-left text-sm" : "min-h-8 w-full gap-2.5 ps-9.5 pe-3 py-1 text-left text-xs"
          : "mx-auto size-10 justify-center px-0"
      } ${active ? SHELL_NAV_ITEM_ACTIVE : SHELL_NAV_ITEM_IDLE} ${
        dropHighlight ? "ring-2 ring-border-focus" : ""
      }`)}
      aria-label={ariaLabel ?? label}
      data-sidebar-anchor={icon ? label : undefined}
      aria-current={active ? "page" : undefined}
      aria-haspopup={hasPopup ? "dialog" : undefined}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {icon ? <span data-sidebar-icon className="flex size-4.5 shrink-0 items-center justify-center">{icon}</span> : null}
      {expanded ? (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count !== undefined ? <NavCount value={count} /> : null}
          {shortcut ? <kbd aria-hidden="true" className="ml-auto shrink-0 pl-2 text-2xs text-text-secondary">{shortcut}</kbd> : null}
        </>
      ) : null}
    </button></Tooltip>
  );
}

function NavCount({ value }: { value: number }) {
  return (
    <span
      aria-hidden
      className="library-sidebar-count ml-auto shrink-0 pl-2 text-meta tabular-nums text-text-secondary group-hover:opacity-0 group-focus-within:opacity-0"
    >
      {value}
    </span>
  );
}
