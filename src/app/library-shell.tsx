"use client";

import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Collection } from "@/domain/collection";
import type { LibraryTypeFilter } from "@/domain/library-view";
import type { Tag } from "@/domain/tag";
import type { LibrarySidebarCounts } from "./library-sidebar-counts";
import { BackupPanel } from "./backup-panel";
import {
  BackupIcon,
  ChevronDownIcon,
  CollectionIcon,
  HashIcon,
  InboxIcon,
  LibraryIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
} from "./shell-icons";
import {
  readShellCollectionsOpen,
  readShellTagsOpen,
  SHELL_ASIDE,
  SHELL_BACKDROP,
  SHELL_NAV_GUTTER,
  SHELL_NAV_ITEM,
  SHELL_NAV_ITEM_ACTIVE,
  SHELL_NAV_ITEM_IDLE,
  SHELL_SIDEBAR_COLLAPSED,
  SHELL_SIDEBAR_EXPANDED,
  writeShellCollectionsOpen,
  writeShellTagsOpen,
} from "./shell-styles";
import { useShellMobile } from "./use-shell-mobile";
import { ShellPanelIcon } from "./shell-panel-icon";

type Props = {
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  backupOpen: boolean;
  onBackupOpenChange: (open: boolean) => void;
  browseCollectionId: string | null;
  browseUnsorted: boolean;
  browseType: LibraryTypeFilter | null;
  browseTagId: string | null;
  collections: Collection[];
  tags: Tag[];
  sidebarCounts: LibrarySidebarCounts;
  dropTargetCollectionId: string | null;
  newCollectionDraft: string;
  collectionManageError: string | null;
  dragError: string | null;
  mutationBusy: boolean;
  libraryLoading?: boolean;
  onGoAll: () => void;
  onGoUnsorted: () => void;
  onGoCollection: (id: string) => void;
  onGoTag: (id: string) => void;
  onCollectionDragOver: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onCollectionDragLeave: () => void;
  onCollectionDrop: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onNewCollectionDraftChange: (value: string) => void;
  onCreateCollection: () => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
};

export function LibraryShell({
  panelOpen: expanded,
  onPanelOpenChange,
  backupOpen,
  onBackupOpenChange,
  browseCollectionId,
  browseUnsorted,
  browseType,
  browseTagId,
  collections,
  tags,
  sidebarCounts: counts,
  dropTargetCollectionId,
  newCollectionDraft,
  collectionManageError,
  dragError,
  mutationBusy,
  libraryLoading = false,
  onGoAll,
  onGoUnsorted,
  onGoCollection,
  onGoTag,
  onCollectionDragOver,
  onCollectionDragLeave,
  onCollectionDrop,
  onNewCollectionDraftChange,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
}: Props) {
  const [collectionFilter, setCollectionFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [collectionsOpen, setCollectionsOpen] = useState(
    readShellCollectionsOpen,
  );
  const [tagsOpen, setTagsOpen] = useState(readShellTagsOpen);
  const isMobile = useShellMobile();

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

  useEffect(() => {
    if (!expanded || !isMobile) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onPanelOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, isMobile, onPanelOpenChange]);

  function leaveBackup() {
    onBackupOpenChange(false);
  }

  const allItemsActive =
    !backupOpen &&
    browseCollectionId === null &&
    !browseUnsorted &&
    browseType === null;

  const unsortedActive = !backupOpen && browseUnsorted;

  const collectionsCollapsedLabel =
    collections.find((collection) => collection.id === browseCollectionId)
      ?.name ?? "Collections";
  const tagsCollapsedLabel =
    tags.find((tag) => tag.id === browseTagId)?.name ?? "Tags";

  const primaryNav = (
    <>
      <ShellNavItem
        expanded={expanded}
        active={allItemsActive}
        label="All items"
        count={libraryLoading ? undefined : counts.all}
        icon={<LibraryIcon className="size-4 shrink-0 text-zinc-500" />}
        onClick={() => {
          leaveBackup();
          onGoAll();
          closeOnMobile();
        }}
      />
      <ShellNavItem
        expanded={expanded}
        active={unsortedActive}
        label="Unsorted"
        count={libraryLoading ? undefined : counts.unsorted}
        icon={<InboxIcon className="size-4 shrink-0 text-zinc-500" />}
        onClick={() => {
          leaveBackup();
          onGoUnsorted();
          closeOnMobile();
        }}
      />
    </>
  );

  return (
    <>
      {isMobile && expanded ? (
        <button
          type="button"
          className={SHELL_BACKDROP}
          aria-label="Close sidebar"
          onClick={() => onPanelOpenChange(false)}
        />
      ) : null}

      <aside
        aria-label="Sidebar"
        className={`${SHELL_ASIDE} transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
          expanded ? SHELL_SIDEBAR_EXPANDED : SHELL_SIDEBAR_COLLAPSED
        }`}
      >
        {backupOpen && expanded ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4">
            <BackupPanel variant="sidebar" onClose={leaveBackup} />
          </div>
        ) : (
          <nav
            aria-label="Sidebar navigation"
            className={`grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden py-2 ${SHELL_NAV_GUTTER}`}
          >
            <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain">
              <ShellNavItem
                expanded={expanded}
                label={expanded ? "Collapse" : "Expand"}
                icon={
                  <ShellPanelIcon open={expanded} className="size-4" />
                }
                onClick={() => onPanelOpenChange(!expanded)}
              />

              {primaryNav}

              {expanded ? (
                <>
                  <CollectionsSection
                    collectionsOpen={collectionsOpen}
                    onCollectionsOpenChange={(open) => {
                      setCollectionsOpen(open);
                      writeShellCollectionsOpen(open);
                    }}
                    collectionFilter={collectionFilter}
                    onCollectionFilterChange={setCollectionFilter}
                    filteredCollections={filteredCollections}
                    collections={collections}
                    browseCollectionId={browseCollectionId}
                    counts={counts.byCollectionId}
                    dropTargetCollectionId={dropTargetCollectionId}
                    newCollectionDraft={newCollectionDraft}
                    collectionManageError={collectionManageError}
                    dragError={dragError}
                    mutationBusy={mutationBusy}
                    libraryLoading={libraryLoading}
                    onGoCollection={(id) => {
                      leaveBackup();
                      onGoCollection(id);
                      closeOnMobile();
                    }}
                    onCollectionDragOver={onCollectionDragOver}
                    onCollectionDragLeave={onCollectionDragLeave}
                    onCollectionDrop={onCollectionDrop}
                    onNewCollectionDraftChange={onNewCollectionDraftChange}
                    onCreateCollection={onCreateCollection}
                    onRenameCollection={onRenameCollection}
                    onDeleteCollection={onDeleteCollection}
                  />

                  <TagsSection
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
                      leaveBackup();
                      onGoTag(id);
                      closeOnMobile();
                    }}
                  />
                </>
              ) : (
                <>
                  <ShellNavItem
                    expanded={false}
                    active={browseCollectionId !== null}
                    label={collectionsCollapsedLabel}
                    icon={
                      <CollectionIcon className="size-4 shrink-0 text-zinc-500" />
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
                      <HashIcon className="size-4 shrink-0 text-zinc-500" />
                    }
                    onClick={() => {
                      onPanelOpenChange(true);
                      setTagsOpen(true);
                      writeShellTagsOpen(true);
                    }}
                  />
                </>
              )}
            </div>

            <ShellNavItem
              expanded={expanded}
              active={backupOpen}
              label="Backup"
              icon={
                <BackupIcon className="size-4 shrink-0 text-zinc-500" />
              }
              onClick={() => {
                const next = !backupOpen;
                onBackupOpenChange(next);
                if (next) {
                  onPanelOpenChange(true);
                }
              }}
            />
          </nav>
        )}
      </aside>
    </>
  );
}

function CollectionsSection({
  collectionsOpen,
  onCollectionsOpenChange,
  collectionFilter,
  onCollectionFilterChange,
  filteredCollections,
  collections,
  browseCollectionId,
  counts,
  dropTargetCollectionId,
  newCollectionDraft,
  collectionManageError,
  dragError,
  mutationBusy,
  libraryLoading = false,
  onGoCollection,
  onCollectionDragOver,
  onCollectionDragLeave,
  onCollectionDrop,
  onNewCollectionDraftChange,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
}: {
  collectionsOpen: boolean;
  onCollectionsOpenChange: (open: boolean) => void;
  collectionFilter: string;
  onCollectionFilterChange: (value: string) => void;
  filteredCollections: Collection[];
  collections: Collection[];
  browseCollectionId: string | null;
  counts: Record<string, number>;
  dropTargetCollectionId: string | null;
  newCollectionDraft: string;
  collectionManageError: string | null;
  dragError: string | null;
  mutationBusy: boolean;
  libraryLoading?: boolean;
  onGoCollection: (id: string) => void;
  onCollectionDragOver: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onCollectionDragLeave: () => void;
  onCollectionDrop: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onNewCollectionDraftChange: (value: string) => void;
  onCreateCollection: () => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [renamingCollectionId, setRenamingCollectionId] = useState<
    string | null
  >(null);
  const [renameDraft, setRenameDraft] = useState("");

  return (
    <CollapsibleSection
      title="Collections"
      open={collectionsOpen}
      onOpenChange={onCollectionsOpenChange}
      trailing={
        <button
          type="button"
          className={`${SHELL_NAV_ITEM} ${SHELL_NAV_ITEM_IDLE} size-7 justify-center px-0 text-zinc-500`}
          aria-label="New collection"
          aria-expanded={createOpen}
          onClick={() => {
            setCreateOpen((open) => !open);
            onNewCollectionDraftChange("");
            if (!collectionsOpen) {
              onCollectionsOpenChange(true);
            }
          }}
        >
          <PlusIcon />
        </button>
      }
    >
      {createOpen ? (
        <form
          className="pb-2 pl-2 pr-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newCollectionDraft.trim() || mutationBusy) {
              return;
            }
            onCreateCollection();
            setCreateOpen(false);
          }}
        >
          <input
            className="w-full rounded-[8px] border border-zinc-200/80 bg-white px-2 py-1 text-xs outline-none transition-[border-color] duration-150 ease-out focus:border-zinc-400"
            autoFocus
            value={newCollectionDraft}
            disabled={mutationBusy}
            placeholder="Collection name"
            aria-label="New collection name"
            onChange={(event) => onNewCollectionDraftChange(event.target.value)}
          />
        </form>
      ) : null}

      <SidebarSearch
        label="Search collections"
        value={collectionFilter}
        onChange={onCollectionFilterChange}
      />

      {filteredCollections.length === 0 ? (
        <p className="px-2 pb-2 text-pretty text-xs text-zinc-500">
          {libraryLoading
            ? "Loading…"
            : collections.length === 0
              ? "No collections yet."
              : "No matches."}
        </p>
      ) : (
        filteredCollections.map((collection) => (
          <CollectionNavRow
            key={collection.id}
            collection={collection}
            count={libraryLoading ? undefined : (counts[collection.id] ?? 0)}
            active={browseCollectionId === collection.id}
            dropHighlight={dropTargetCollectionId === collection.id}
            renaming={renamingCollectionId === collection.id}
            renameDraft={renameDraft}
            mutationBusy={mutationBusy}
            onNavigate={() => onGoCollection(collection.id)}
            onDragOver={(event) => onCollectionDragOver(collection.id, event)}
            onDragLeave={onCollectionDragLeave}
            onDrop={(event) => onCollectionDrop(collection.id, event)}
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
            onDelete={() => onDeleteCollection(collection.id)}
          />
        ))
      )}

      {dragError ? (
        <p className="mt-2 px-2 text-pretty text-xs text-red-700" role="alert">
          {dragError}
        </p>
      ) : null}

      {collectionManageError ? (
        <p className="mt-2 px-2 text-pretty text-xs text-red-700" role="alert">
          {collectionManageError}
        </p>
      ) : null}
    </CollapsibleSection>
  );
}

function TagsSection({
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
}: {
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
}) {
  return (
    <CollapsibleSection
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

      {filteredTags.length === 0 ? (
        <p className="px-2 pb-2 text-pretty text-xs text-zinc-500">
          {libraryLoading
            ? "Loading…"
            : tags.length === 0
              ? "No tags yet."
              : "No matches."}
        </p>
      ) : (
        filteredTags.map((tag) => (
          <ShellNavItem
            key={tag.id}
            expanded
            active={browseTagId === tag.id}
            label={tag.name}
            ariaLabel={`Tag ${tag.name}`}
            count={libraryLoading ? undefined : (counts[tag.id] ?? 0)}
            icon={<HashIcon className="size-4 shrink-0 text-zinc-500" />}
            onClick={() => onGoTag(tag.id)}
          />
        ))
      )}
    </CollapsibleSection>
  );
}

function CollectionNavRow({
  collection,
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
  onStartRename,
  onRenameDraftChange,
  onCancelRename,
  onSubmitRename,
  onDelete,
}: {
  collection: Collection;
  count: number;
  active: boolean;
  dropHighlight: boolean;
  renaming: boolean;
  renameDraft: string;
  mutationBusy: boolean;
  onNavigate: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onStartRename: () => void;
  onRenameDraftChange: (value: string) => void;
  onCancelRename: () => void;
  onSubmitRename: () => void;
  onDelete: () => void;
}) {
  const icon = (
    <CollectionIcon className="size-4 shrink-0 text-zinc-500" />
  );

  if (renaming) {
    return (
      <form
        className={`${SHELL_NAV_ITEM} ${SHELL_NAV_ITEM_ACTIVE} w-full gap-2 px-2 py-1.5`}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitRename();
        }}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {icon}
        </span>
        <input
          className="min-w-0 flex-1 rounded-[6px] border border-zinc-200/80 bg-white px-1.5 py-0.5 text-sm outline-none focus:border-zinc-400"
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
    <div
      className={`group ${SHELL_NAV_ITEM} flex min-w-0 w-full items-center py-1.5 pl-2 pr-1 text-sm ${
        active
          ? `${SHELL_NAV_ITEM_ACTIVE} font-medium text-zinc-900`
          : `text-zinc-600 ${SHELL_NAV_ITEM_IDLE}`
      } ${dropHighlight ? "shadow-[0_0_0_2px_rgba(24,24,27,0.9)]" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
        aria-label={collection.name}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {icon}
        </span>
        <span className="truncate">{collection.name}</span>
        <NavCount value={count} />
      </button>
      <CollectionRowMenu
        collectionName={collection.name}
        visible={active}
        mutationBusy={mutationBusy}
        onRename={onStartRename}
        onDelete={onDelete}
      />
    </div>
  );
}

function CollectionRowMenu({
  collectionName,
  visible,
  mutationBusy,
  onRename,
  onDelete,
}: {
  collectionName: string;
  visible: boolean;
  mutationBusy: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const actionsLabel = `${collectionName} actions`;

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={`flex size-7 shrink-0 items-center justify-center rounded-[6px] text-zinc-500 transition-[opacity,background-color] duration-150 hover:bg-zinc-200/70 focus-visible:bg-zinc-200/70 ${
          visible || open
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
        aria-label={actionsLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={mutationBusy}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreIcon />
      </button>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          aria-label={actionsLabel}
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[8.5rem] overflow-hidden rounded-[10px] border border-zinc-200/80 bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          <li role="presentation">
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
              onClick={() => {
                setOpen(false);
                onRename();
              }}
            >
              Rename
            </button>
          </li>
          <li role="presentation">
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          </li>
        </ul>
      ) : null}
    </div>
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
  icon: ReactNode;
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
          ? "w-full gap-2 px-2 py-1.5 text-left text-sm"
          : "mx-auto size-10 justify-center px-0"
      } ${active ? SHELL_NAV_ITEM_ACTIVE : SHELL_NAV_ITEM_IDLE} ${
        dropHighlight ? "shadow-[0_0_0_2px_rgba(24,24,27,0.9)]" : ""
      }`}
      aria-label={ariaLabel ?? label}
      aria-current={active ? "page" : undefined}
      title={!expanded ? label : undefined}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
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
      className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-zinc-400"
    >
      {value}
    </span>
  );
}

function CollapsibleSection({
  title,
  open,
  onOpenChange,
  trailing,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pt-1">
      <div className="flex items-center gap-0.5 pb-0.5 pl-1 pr-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 rounded-[8px] px-1 py-1 text-left transition-[background-color] duration-150 hover:bg-zinc-50"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          <ChevronDownIcon
            className={`size-3.5 text-zinc-400 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
              open ? "" : "-rotate-90"
            }`}
          />
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {title}
          </span>
        </button>
        {trailing}
      </div>
      {open ? children : null}
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
    <div className="pb-2 pl-2 pr-1">
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          className="w-full rounded-[8px] border border-zinc-200/80 bg-zinc-50 py-1 pl-7 pr-2 text-xs outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-zinc-400 focus:shadow-[0_0_0_2px_rgba(24,24,27,0.08)]"
          placeholder="Search"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
