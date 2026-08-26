"use client";

import Link from "next/link";
import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
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
  LogoIcon,
  NoteIcon,
  SearchIcon,
} from "./shell-icons";
import { ShellPanelIcon } from "./shell-panel-icon";
import {
  SHELL_ASIDE,
  SHELL_BACKDROP,
  SHELL_FORM_SURFACE,
  SHELL_MANAGE_SURFACE,
  SHELL_PANEL_ROW,
  SHELL_PANEL_ROW_ACTIVE,
  SHELL_PANEL_SURFACE,
  SHELL_RAIL_BTN,
  SHELL_RAIL_BTN_ACTIVE,
} from "./shell-styles";
import type { PendingMutation } from "./library-item";
import { useShellMobile } from "./use-shell-mobile";

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
  renameCollectionDraft: string;
  browseCollection: Collection | null;
  collectionManageError: string | null;
  dragError: string | null;
  mutationBusy: boolean;
  pendingMutation: PendingMutation | null;
  libraryActive: boolean;
  onGoAll: () => void;
  onGoCollection: (id: string) => void;
  onGoType: (type: LibraryTypeFilter) => void;
  onCollectionDragOver: (id: string, event: DragEvent<HTMLButtonElement>) => void;
  onCollectionDragLeave: () => void;
  onCollectionDrop: (id: string, event: DragEvent<HTMLButtonElement>) => void;
  onNewCollectionDraftChange: (value: string) => void;
  onCreateCollection: () => void;
  onRenameDraftChange: (value: string) => void;
  onRenameCollection: () => void;
  onDeleteCollection: () => void;
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
  panelOpen,
  onPanelOpenChange,
  backupOpen,
  onBackupOpenChange,
  browseCollectionId,
  browseType,
  collections,
  dropTargetCollectionId,
  newCollectionDraft,
  renameCollectionDraft,
  browseCollection,
  collectionManageError,
  dragError,
  mutationBusy,
  pendingMutation,
  libraryActive,
  onGoAll,
  onGoCollection,
  onGoType,
  onCollectionDragOver,
  onCollectionDragLeave,
  onCollectionDrop,
  onNewCollectionDraftChange,
  onCreateCollection,
  onRenameDraftChange,
  onRenameCollection,
  onDeleteCollection,
}: Props) {
  const [navFilter, setNavFilter] = useState("");
  const isMobile = useShellMobile();

  const filterQuery = navFilter.trim().toLowerCase();
  const filteredCollections = useMemo(() => {
    if (!filterQuery) {
      return collections;
    }
    return collections.filter((collection) =>
      collection.name.toLowerCase().includes(filterQuery),
    );
  }, [collections, filterQuery]);

  const closePanelOnMobile = useCallback(() => {
    if (isMobile) {
      onPanelOpenChange(false);
    }
  }, [isMobile, onPanelOpenChange]);

  useEffect(() => {
    if (!panelOpen || !isMobile) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onPanelOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, onPanelOpenChange, panelOpen]);

  return (
    <aside className={SHELL_ASIDE}>
      <nav
        className="relative z-50 flex w-14 flex-col items-center py-3 shadow-[1px_0_0_rgba(0,0,0,0.04)]"
        aria-label="App rail"
      >
        <Link
          href="/"
          className={`${SHELL_RAIL_BTN} mb-4 text-zinc-900`}
          aria-label="Keepall home"
        >
          <LogoIcon />
        </Link>
        <button
          type="button"
          className={`${SHELL_RAIL_BTN} mb-1 ${
            libraryActive && !backupOpen ? SHELL_RAIL_BTN_ACTIVE : ""
          }`}
          aria-label="Library"
          aria-pressed={libraryActive && !backupOpen}
          onClick={() => {
            onBackupOpenChange(false);
            onGoAll();
            closePanelOnMobile();
          }}
        >
          <LibraryIcon />
        </button>
        <button
          type="button"
          className={`${SHELL_RAIL_BTN} mb-1 ${panelOpen ? SHELL_RAIL_BTN_ACTIVE : ""}`}
          aria-label={panelOpen ? "Hide browse panel" : "Show browse panel"}
          aria-pressed={panelOpen}
          onClick={() => onPanelOpenChange(!panelOpen)}
        >
          <ShellPanelIcon open={panelOpen} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className={`${SHELL_RAIL_BTN} ${backupOpen ? SHELL_RAIL_BTN_ACTIVE : ""}`}
          aria-label="Backup"
          aria-pressed={backupOpen}
          onClick={() => {
            const next = !backupOpen;
            onBackupOpenChange(next);
            if (next) {
              onPanelOpenChange(true);
            }
          }}
        >
          <BackupIcon />
        </button>
      </nav>

      {isMobile && panelOpen ? (
        <button
          type="button"
          className={SHELL_BACKDROP}
          aria-label="Close browse panel"
          onClick={() => onPanelOpenChange(false)}
        />
      ) : null}

      <div
        className={`${SHELL_PANEL_SURFACE} overflow-hidden transition-[width,transform,opacity] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none max-md:fixed max-md:inset-y-0 max-md:left-14 max-md:z-50 md:relative ${
          panelOpen
            ? "max-md:translate-x-0 max-md:opacity-100 md:w-60 md:opacity-100"
            : "pointer-events-none max-md:-translate-x-full max-md:opacity-0 md:w-0 md:opacity-0"
        }`}
        aria-hidden={!panelOpen}
      >
        {backupOpen ? (
          <div className="flex-1 overflow-auto p-4">
            <BackupPanel variant="sidebar" />
          </div>
        ) : (
          <ShellBrowsePanel
            navFilter={navFilter}
            onNavFilterChange={setNavFilter}
            browseCollectionId={browseCollectionId}
            browseType={browseType}
            filteredCollections={filteredCollections}
            collections={collections}
            dropTargetCollectionId={dropTargetCollectionId}
            newCollectionDraft={newCollectionDraft}
            renameCollectionDraft={renameCollectionDraft}
            browseCollection={browseCollection}
            collectionManageError={collectionManageError}
            dragError={dragError}
            mutationBusy={mutationBusy}
            pendingMutation={pendingMutation}
            onGoAll={() => {
              onGoAll();
              closePanelOnMobile();
            }}
            onGoCollection={(id) => {
              onGoCollection(id);
              closePanelOnMobile();
            }}
            onGoType={(type) => {
              onGoType(type);
              closePanelOnMobile();
            }}
            onCollectionDragOver={onCollectionDragOver}
            onCollectionDragLeave={onCollectionDragLeave}
            onCollectionDrop={onCollectionDrop}
            onNewCollectionDraftChange={onNewCollectionDraftChange}
            onCreateCollection={onCreateCollection}
            onRenameDraftChange={onRenameDraftChange}
            onRenameCollection={onRenameCollection}
            onDeleteCollection={onDeleteCollection}
          />
        )}
      </div>
    </aside>
  );
}

function ShellBrowsePanel({
  navFilter,
  onNavFilterChange,
  browseCollectionId,
  browseType,
  filteredCollections,
  collections,
  dropTargetCollectionId,
  newCollectionDraft,
  renameCollectionDraft,
  browseCollection,
  collectionManageError,
  dragError,
  mutationBusy,
  pendingMutation,
  onGoAll,
  onGoCollection,
  onGoType,
  onCollectionDragOver,
  onCollectionDragLeave,
  onCollectionDrop,
  onNewCollectionDraftChange,
  onCreateCollection,
  onRenameDraftChange,
  onRenameCollection,
  onDeleteCollection,
}: {
  navFilter: string;
  onNavFilterChange: (value: string) => void;
  browseCollectionId: string | null;
  browseType: LibraryTypeFilter | null;
  filteredCollections: Collection[];
  collections: Collection[];
  dropTargetCollectionId: string | null;
  newCollectionDraft: string;
  renameCollectionDraft: string;
  browseCollection: Collection | null;
  collectionManageError: string | null;
  dragError: string | null;
  mutationBusy: boolean;
  pendingMutation: PendingMutation | null;
  onGoAll: () => void;
  onGoCollection: (id: string) => void;
  onGoType: (type: LibraryTypeFilter) => void;
  onCollectionDragOver: (id: string, event: DragEvent<HTMLButtonElement>) => void;
  onCollectionDragLeave: () => void;
  onCollectionDrop: (id: string, event: DragEvent<HTMLButtonElement>) => void;
  onNewCollectionDraftChange: (value: string) => void;
  onCreateCollection: () => void;
  onRenameDraftChange: (value: string) => void;
  onRenameCollection: () => void;
  onDeleteCollection: () => void;
}) {
  return (
    <nav
      className="flex min-h-0 flex-1 flex-col overflow-auto py-3"
      aria-label="Browse"
    >
      <div className="px-3 pb-3">
        <label className="relative block">
          <span className="sr-only">Filter navigation</span>
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="w-full rounded-[10px] border border-zinc-200/80 bg-zinc-50 py-2 pl-8 pr-3 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.03)] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(24,24,27,0.08)]"
            placeholder="Filter…"
            value={navFilter}
            onChange={(event) => onNavFilterChange(event.target.value)}
          />
        </label>
      </div>

      <ShellSection title="Library">
        <ShellRow
          active={browseCollectionId === null && browseType === null}
          label="All items"
          icon={LibraryIcon}
          onClick={onGoAll}
        />
      </ShellSection>

      <ShellSection title="Collections">
        {filteredCollections.length === 0 ? (
          <p className="px-4 pb-2 text-pretty text-xs text-zinc-500">
            {collections.length === 0
              ? "No collections yet."
              : "No matches."}
          </p>
        ) : (
          filteredCollections.map((collection) => (
            <ShellRow
              key={collection.id}
              active={browseCollectionId === collection.id}
              label={collection.name}
              icon={CollectionIcon}
              dropHighlight={dropTargetCollectionId === collection.id}
              onClick={() => onGoCollection(collection.id)}
              onDragOver={(event) => onCollectionDragOver(collection.id, event)}
              onDragLeave={onCollectionDragLeave}
              onDrop={(event) => onCollectionDrop(collection.id, event)}
            />
          ))
        )}
        <form
          className={`mx-3 mt-2 space-y-2 ${SHELL_FORM_SURFACE}`}
          onSubmit={(event) => {
            event.preventDefault();
            onCreateCollection();
          }}
        >
          <label
            className="text-xs font-medium text-zinc-700"
            htmlFor="new-collection-name"
          >
            New collection
          </label>
          <input
            className="w-full rounded-[8px] border border-zinc-200/80 bg-white px-2.5 py-2 text-sm outline-none transition-[border-color] duration-150 ease-out focus:border-zinc-400"
            id="new-collection-name"
            value={newCollectionDraft}
            disabled={mutationBusy}
            placeholder="Name"
            onChange={(event) => onNewCollectionDraftChange(event.target.value)}
          />
          <button
            className={`${SHELL_PANEL_ROW} justify-center px-3 ${
              mutationBusy || !newCollectionDraft.trim()
                ? "opacity-60"
                : "text-zinc-800 hover:bg-white"
            }`}
            type="submit"
            disabled={mutationBusy || !newCollectionDraft.trim()}
          >
            {pendingMutation?.op === "create-collection"
              ? "Creating…"
              : "Create"}
          </button>
        </form>
        {browseCollection ? (
          <div className={`mx-3 mt-3 space-y-2 ${SHELL_MANAGE_SURFACE}`}>
            <label
              className="text-xs font-medium text-zinc-700"
              htmlFor="rename-collection-name"
            >
              Rename collection
            </label>
            <input
              className="w-full rounded-[8px] border border-zinc-200/80 bg-zinc-50 px-2.5 py-2 text-sm outline-none transition-[border-color] duration-150 ease-out focus:border-zinc-400"
              id="rename-collection-name"
              value={renameCollectionDraft}
              disabled={mutationBusy}
              onChange={(event) => onRenameDraftChange(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className={`${SHELL_PANEL_ROW} flex-1 justify-center text-zinc-800 hover:bg-zinc-50`}
                type="button"
                disabled={mutationBusy || !renameCollectionDraft.trim()}
                onClick={onRenameCollection}
              >
                {pendingMutation?.op === "rename-collection"
                  ? "Saving…"
                  : "Save name"}
              </button>
              <button
                className={`${SHELL_PANEL_ROW} flex-1 justify-center text-red-800 hover:bg-red-50`}
                type="button"
                disabled={mutationBusy}
                onClick={onDeleteCollection}
              >
                {pendingMutation?.op === "delete-collection"
                  ? "Deleting…"
                  : "Delete collection"}
              </button>
            </div>
          </div>
        ) : null}
      </ShellSection>

      <ShellSection title="Type">
        {TYPE_OPTIONS.map(({ value, label, Icon }) => (
          <ShellRow
            key={value}
            active={browseType === value && browseCollectionId === null}
            label={label}
            icon={Icon}
            onClick={() => onGoType(value)}
          />
        ))}
      </ShellSection>

      {dragError ? (
        <p className="mx-3 mt-2 text-pretty text-xs text-red-700" role="alert">
          {dragError}
        </p>
      ) : null}
      {collectionManageError ? (
        <p className="mx-3 mt-2 text-pretty text-xs text-red-700" role="alert">
          {collectionManageError}
        </p>
      ) : null}
    </nav>
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
    <div className="mb-3">
      <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function ShellRow({
  active,
  label,
  icon: Icon,
  dropHighlight = false,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  active: boolean;
  label: string;
  icon: typeof LibraryIcon;
  dropHighlight?: boolean;
  onClick: () => void;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`${SHELL_PANEL_ROW} ${
        active ? SHELL_PANEL_ROW_ACTIVE : "text-zinc-600 hover:bg-zinc-50"
      } ${dropHighlight ? "shadow-[0_0_0_2px_rgba(24,24,27,0.9)]" : ""}`}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Icon className="text-zinc-500" />
      <span className="truncate">{label}</span>
    </button>
  );
}
