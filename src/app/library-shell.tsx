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
import { BackupPanel } from "./backup-panel";
import {
  BackupIcon,
  CollectionIcon,
  ImageIcon,
  LibraryIcon,
  LinkIcon,
  MoreIcon,
  NoteIcon,
  SearchIcon,
  PlusIcon,
} from "./shell-icons";
import {
  SHELL_ASIDE,
  SHELL_BACKDROP,
  SHELL_NAV_GUTTER,
  SHELL_NAV_ITEM,
  SHELL_NAV_ITEM_ACTIVE,
  SHELL_NAV_ITEM_IDLE,
  SHELL_SIDEBAR_COLLAPSED,
  SHELL_SIDEBAR_EXPANDED,
} from "./shell-styles";
import { useShellMobile } from "./use-shell-mobile";
import { ShellPanelIcon } from "./shell-panel-icon";

type Props = {
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  backupOpen: boolean;
  onBackupOpenChange: (open: boolean) => void;
  browseCollectionId: string | null;
  browseType: LibraryTypeFilter | null;
  collections: Collection[];
  dropTargetCollectionId: string | null;
  newCollectionDraft: string;
  collectionManageError: string | null;
  dragError: string | null;
  mutationBusy: boolean;
  onGoAll: () => void;
  onGoCollection: (id: string) => void;
  onGoType: (type: LibraryTypeFilter) => void;
  onCollectionDragOver: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onCollectionDragLeave: () => void;
  onCollectionDrop: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onNewCollectionDraftChange: (value: string) => void;
  onCreateCollection: () => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
};

const TYPE_OPTIONS: {
  value: LibraryTypeFilter;
  label: string;
  Icon: typeof LinkIcon;
}[] = [
  { value: "link", label: "Links", Icon: LinkIcon },
  { value: "note", label: "Notes", Icon: NoteIcon },
  { value: "image", label: "Images", Icon: ImageIcon },
];

export function LibraryShell({
  panelOpen: expanded,
  onPanelOpenChange,
  backupOpen,
  onBackupOpenChange,
  browseCollectionId,
  browseType,
  collections,
  dropTargetCollectionId,
  newCollectionDraft,
  collectionManageError,
  dragError,
  mutationBusy,
  onGoAll,
  onGoCollection,
  onGoType,
  onCollectionDragOver,
  onCollectionDragLeave,
  onCollectionDrop,
  onNewCollectionDraftChange,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
}: Props) {
  const [collectionFilter, setCollectionFilter] = useState("");
  const isMobile = useShellMobile();

  const filterQuery = collectionFilter.trim().toLowerCase();
  const filteredCollections = useMemo(() => {
    if (!filterQuery) {
      return collections;
    }
    return collections.filter((collection) =>
      collection.name.toLowerCase().includes(filterQuery),
    );
  }, [collections, filterQuery]);

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
    !backupOpen && browseCollectionId === null && browseType === null;

  const collectionBrowseActive = !backupOpen && browseCollectionId !== null;

  function typeActive(value: LibraryTypeFilter) {
    return !backupOpen && browseType === value && browseCollectionId === null;
  }

  const collectionsCollapsedLabel =
    collections.find((collection) => collection.id === browseCollectionId)
      ?.name ?? "Collections";

  const libraryNav = (
    <>
      <ShellNavItem
        expanded={expanded}
        active={allItemsActive}
        label="All items"
        icon={<LibraryIcon className="size-4 shrink-0 text-zinc-500" />}
        onClick={() => {
          leaveBackup();
          onGoAll();
          closeOnMobile();
        }}
      />
      {TYPE_OPTIONS.map(({ value, label, Icon }) => (
        <ShellNavItem
          key={value}
          expanded={expanded}
          active={typeActive(value)}
          label={label}
          icon={<Icon className="size-4 shrink-0 text-zinc-500" />}
          onClick={() => {
            leaveBackup();
            onGoType(value);
            closeOnMobile();
          }}
        />
      ))}
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
            <BackupPanel variant="sidebar" />
          </div>
        ) : (
          <nav
            aria-label="Sidebar navigation"
            className={`grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden py-2 ${SHELL_NAV_GUTTER}`}
          >
            <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
              <ShellNavItem
                expanded={expanded}
                label={expanded ? "Collapse" : "Expand"}
                icon={
                  <ShellPanelIcon open={expanded} className="size-4" />
                }
                onClick={() => onPanelOpenChange(!expanded)}
              />

              {expanded ? (
                <ShellSection title="Library">{libraryNav}</ShellSection>
              ) : (
                libraryNav
              )}

              <CollectionsSection
                expanded={expanded}
                collectionFilter={collectionFilter}
                onCollectionFilterChange={setCollectionFilter}
                filteredCollections={filteredCollections}
                collections={collections}
                browseCollectionId={browseCollectionId}
                collectionBrowseActive={collectionBrowseActive}
                collectionsCollapsedLabel={collectionsCollapsedLabel}
                dropTargetCollectionId={dropTargetCollectionId}
                newCollectionDraft={newCollectionDraft}
                collectionManageError={collectionManageError}
                dragError={dragError}
                mutationBusy={mutationBusy}
                onExpand={() => onPanelOpenChange(true)}
                onGoCollection={(id) => {
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
  expanded,
  collectionFilter,
  onCollectionFilterChange,
  filteredCollections,
  collections,
  browseCollectionId,
  collectionBrowseActive,
  collectionsCollapsedLabel,
  dropTargetCollectionId,
  newCollectionDraft,
  collectionManageError,
  dragError,
  mutationBusy,
  onExpand,
  onGoCollection,
  onCollectionDragOver,
  onCollectionDragLeave,
  onCollectionDrop,
  onNewCollectionDraftChange,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
}: {
  expanded: boolean;
  collectionFilter: string;
  onCollectionFilterChange: (value: string) => void;
  filteredCollections: Collection[];
  collections: Collection[];
  browseCollectionId: string | null;
  collectionBrowseActive: boolean;
  collectionsCollapsedLabel: string;
  dropTargetCollectionId: string | null;
  newCollectionDraft: string;
  collectionManageError: string | null;
  dragError: string | null;
  mutationBusy: boolean;
  onExpand: () => void;
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

  if (!expanded) {
    return (
      <ShellNavItem
        expanded={false}
        active={collectionBrowseActive}
        label={collectionsCollapsedLabel}
        icon={<CollectionIcon className="size-4 shrink-0 text-zinc-500" />}
        onClick={onExpand}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-1">
      <div className="flex shrink-0 items-center justify-between gap-2 pb-1 pl-2 pr-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Collections
        </p>
        <button
          type="button"
          className={`${SHELL_NAV_ITEM} ${SHELL_NAV_ITEM_IDLE} size-7 justify-center px-0 text-zinc-500`}
          aria-label="New collection"
          aria-expanded={createOpen}
          onClick={() => {
            setCreateOpen((open) => !open);
            onNewCollectionDraftChange("");
          }}
        >
          <PlusIcon />
        </button>
      </div>

      {createOpen ? (
        <form
          className="shrink-0 pb-2 pl-2 pr-1"
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

      <div className="shrink-0 pb-2 pl-2 pr-1">
        <label className="relative block">
          <span className="sr-only">Search collections</span>
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            className="w-full rounded-[8px] border border-zinc-200/80 bg-zinc-50 py-1 pl-7 pr-2 text-xs outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-zinc-400 focus:shadow-[0_0_0_2px_rgba(24,24,27,0.08)]"
            placeholder="Filter…"
            value={collectionFilter}
            onChange={(event) => onCollectionFilterChange(event.target.value)}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {filteredCollections.length === 0 ? (
          <p className="px-2 pb-2 text-pretty text-xs text-zinc-500">
            {collections.length === 0
              ? "No collections yet."
              : "No matches."}
          </p>
        ) : (
          filteredCollections.map((collection) => (
            <CollectionNavRow
              key={collection.id}
              collection={collection}
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
          <p className="mt-2 text-pretty text-xs text-red-700" role="alert">
            {dragError}
          </p>
        ) : null}

        {collectionManageError ? (
          <p className="mt-2 px-2 text-pretty text-xs text-red-700" role="alert">
            {collectionManageError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CollectionNavRow({
  collection,
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
  icon,
  dropHighlight = false,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  expanded: boolean;
  active?: boolean;
  label: string;
  icon: ReactNode;
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
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={!expanded ? label : undefined}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      {expanded ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

function ShellSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-1 pt-1">
      <p className="pb-1 pl-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </p>
      {children}
    </div>
  );
}
