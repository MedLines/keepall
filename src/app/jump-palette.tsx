"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import type { Collection } from "@/domain/collection";
import { itemListTitle, type Item } from "@/domain/item";
import type { Tag } from "@/domain/tag";
import { useTranslations } from "@/i18n/use-translations";
import { collectionMarkerStyle } from "./collection-marker";
import { CloseIcon, DeleteIcon, EditIcon, HashIcon, PinIcon, SearchIcon } from "./shell-icons";

export type JumpFilter = "all" | "collections" | "tags";

export type JumpResult =
  | { kind: "collection"; id: string; name: string; count: number; pinned: boolean }
  | { kind: "tag"; id: string; name: string; count: number };

const ALL_LIMIT = 6;

/** Collections and tags matching `query`, names that start with it first; "all" keeps a short list of each. */
export function jumpResults({ collections, tags, pinnedCollectionIds, collectionCounts, tagCounts, query, filter }: {
  collections: Collection[];
  tags: Tag[];
  pinnedCollectionIds: string[];
  collectionCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  query: string;
  filter: JumpFilter;
}): JumpResult[] {
  const needle = query.trim().toLowerCase();
  const pinned = new Set(pinnedCollectionIds);
  const rank = (name: string) => (needle && name.toLowerCase().startsWith(needle) ? 0 : 1);
  const matches = (name: string) => !needle || name.toLowerCase().includes(needle);

  const collectionResults: JumpResult[] = filter === "tags" ? [] : collections
    .filter(collection => matches(collection.name))
    .map(collection => ({ kind: "collection" as const, id: collection.id, name: collection.name, count: collectionCounts[collection.id] ?? 0, pinned: pinned.has(collection.id) }))
    .sort((a, b) => rank(a.name) - rank(b.name) || Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));

  const tagResults: JumpResult[] = filter === "collections" ? [] : tags
    .filter(tag => matches(tag.name))
    .map(tag => ({ kind: "tag" as const, id: tag.id, name: tag.name, count: tagCounts[tag.id] ?? 0 }))
    .sort((a, b) => rank(a.name) - rank(b.name) || (needle || filter === "tags" ? a.name.localeCompare(b.name) : b.count - a.count || a.name.localeCompare(b.name)));

  return filter === "all"
    ? [...collectionResults.slice(0, ALL_LIMIT), ...tagResults.slice(0, ALL_LIMIT)]
    : [...collectionResults, ...tagResults];
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: JumpFilter;
  onFilterChange: (filter: JumpFilter) => void;
  collections: Collection[];
  tags: Tag[];
  pinnedCollectionIds: string[];
  collectionCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  mutationBusy: boolean;
  /** Newest items in a collection or tag, for the preview pane. */
  recentItems?: (kind: "collection" | "tag", id: string) => Item[];
  onGoCollection: (id: string) => void;
  onGoTag: (id: string) => void;
  onGoCollections: () => void;
  onGoTags: () => void;
  onTogglePinnedCollection: (id: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onDeleteTag: (id: string) => void;
  /** Where focus goes when the palette closes, usually the control that opened it. */
  returnFocus?: () => HTMLElement | null;
};

/**
 * Search-first popup for jumping to a collection or tag, with a preview pane that pins, renames
 * and deletes the highlighted result.
 *
 * @import import { JumpPalette } from "./jump-palette";
 */
export function JumpPalette({ open, onOpenChange, returnFocus, ...props }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={next => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="ui-backdrop ui-backdrop-plain fixed inset-0 z-[80]" />
        <Dialog.Viewport className="fixed inset-0 z-[80] flex justify-center overflow-y-auto p-4 pt-20">
          <Dialog.Popup finalFocus={() => returnFocus?.() ?? true} className="ui-popover flex h-fit max-h-[calc(100dvh-6rem)] w-full max-w-[52rem] flex-col overflow-hidden p-0 outline-none">
            {open ? <JumpPaletteBody {...props} onClose={() => onOpenChange(false)} /> : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function JumpPaletteBody({
  filter, onFilterChange, collections, tags, pinnedCollectionIds, collectionCounts, tagCounts, mutationBusy, recentItems,
  onGoCollection, onGoTag, onGoCollections, onGoTags, onTogglePinnedCollection, onRenameCollection, onDeleteCollection, onDeleteTag, onClose,
}: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter, Escape and blur can all end one rename; only the first may act on it.
  const renameSettled = useRef(true);
  const listId = useId();
  const t = useTranslations("JumpPalette");

  const results = useMemo(
    () => jumpResults({ collections, tags, pinnedCollectionIds, collectionCounts, tagCounts, query, filter }),
    [collections, tags, pinnedCollectionIds, collectionCounts, tagCounts, query, filter],
  );
  const activeIndex = Math.max(0, results.findIndex(result => result.id === activeId));
  const active = results[activeIndex] ?? null;
  const optionId = (id: string) => `${listId}-${id}`;

  function openResult(result: JumpResult) {
    onClose();
    if (result.kind === "collection") onGoCollection(result.id); else onGoTag(result.id);
  }

  function move(step: number) {
    if (results.length === 0) return;
    const next = results[(activeIndex + step + results.length) % results.length];
    setActiveId(next.id);
    document.getElementById(optionId(next.id))?.scrollIntoView({ block: "nearest" });
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    else if (event.key === "Enter" && active) { event.preventDefault(); openResult(active); }
  }

  function startRename(id: string, name: string) {
    renameSettled.current = false;
    setRenaming({ id, draft: name });
  }

  function cancelRename() {
    renameSettled.current = true;
    setRenaming(null);
    inputRef.current?.focus();
  }

  function commitRename() {
    if (!renaming || renameSettled.current) return;
    renameSettled.current = true;
    const collection = collections.find(entry => entry.id === renaming.id);
    const name = renaming.draft.trim();
    if (collection && name && name !== collection.name.trim() && !mutationBusy) onRenameCollection(renaming.id, name);
    setRenaming(null);
    inputRef.current?.focus();
  }

  const filters: Array<{ value: JumpFilter; label: string; count?: number }> = [
    { value: "all", label: t("filterAll") },
    { value: "collections", label: t("filterCollections"), count: collections.length },
    { value: "tags", label: t("filterTags"), count: tags.length },
  ];

  return (
    <>
      <Dialog.Title className="sr-only">{t("title")}</Dialog.Title>
      <div className="flex shrink-0 items-center gap-3 border-b border-border-control px-5">
        <SearchIcon className="size-4.5 shrink-0 text-text-secondary" />
        <input
          ref={inputRef}
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={active ? optionId(active.id) : undefined}
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          className="h-14 min-w-0 flex-1 bg-transparent text-md text-text-primary outline-none placeholder:text-text-secondary"
          value={query}
          onChange={event => { setQuery(event.target.value); setActiveId(null); }}
          onKeyDown={onInputKeyDown}
        />
        <Dialog.Close render={<IconButton size="sm" aria-label={t("close")} />}><CloseIcon /></Dialog.Close>
      </div>

      <div role="group" aria-label={t("filterGroup")} className="flex shrink-0 gap-2 px-4 pt-3 pb-1">
        {filters.map(entry => (
          <Button key={entry.value} variant={filter === entry.value ? "primary" : "secondary"} aria-pressed={filter === entry.value}
            onClick={() => { onFilterChange(entry.value); setActiveId(null); inputRef.current?.focus(); }}>
            <span>{entry.label}</span>
            {entry.count !== undefined ? <span className="ml-1.5 tabular-nums opacity-70">{t("count", { count: entry.count })}</span> : null}
          </Button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_18rem]">
        <ScrollPanel className="min-h-0" viewportClassName="scroll-fade max-h-[24rem] overscroll-contain">
          <div id={listId} role="listbox" aria-label={t("results")} className="flex flex-col gap-0.5 px-2 pt-1 pb-3">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-sm text-text-secondary">
                {query.trim() ? t("noMatches", { query: query.trim() }) : filter === "tags" ? t("noTags") : t("noCollections")}
              </p>
            ) : results.map((result, index) => (
              <ResultRow
                key={`${result.kind}-${result.id}`}
                id={optionId(result.id)}
                result={result}
                count={t("count", { count: result.count })}
                active={index === activeIndex}
                groupLabel={filter === "all" && (index === 0 || results[index - 1].kind !== result.kind) ? (result.kind === "collection" ? t("groupCollections") : t("groupTags")) : null}
                onPoint={() => setActiveId(result.id)}
                onOpen={() => openResult(result)}
              />
            ))}
          </div>
        </ScrollPanel>

        <aside aria-label={t("selected")} className="hidden min-h-0 flex-col gap-4 border-l border-border-control p-5 sm:flex">
          {active ? (
            <Preview
              result={active}
              recent={recentItems?.(active.kind, active.id) ?? []}
              renaming={renaming?.id === active.id ? renaming.draft : null}
              mutationBusy={mutationBusy}
              onOpen={() => openResult(active)}
              onTogglePin={() => onTogglePinnedCollection(active.id)}
              onStartRename={() => startRename(active.id, active.name)}
              onRenameDraftChange={draft => setRenaming({ id: active.id, draft })}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onDelete={() => {
                onClose();
                if (active.kind === "collection") onDeleteCollection(active.id); else onDeleteTag(active.id);
              }}
            />
          ) : <p className="text-sm text-text-secondary">{t("nothingSelected")}</p>}
        </aside>
      </div>

      <footer className="flex shrink-0 items-center gap-4 border-t border-border-control px-5 py-3 text-xs text-text-secondary">
        <span className="hidden items-center gap-1.5 sm:flex"><Key>{t("keyUp")}</Key><Key>{t("keyDown")}</Key><span>{t("hintMove")}</span></span>
        <span className="hidden items-center gap-1.5 sm:flex"><Key>{t("keyEnter")}</Key><span>{t("hintOpen")}</span></span>
        <span className="hidden items-center gap-1.5 sm:flex"><Key>{t("keyEscape")}</Key><span>{t("hintClose")}</span></span>
        <span className="flex-1" />
        <Button onClick={() => { onClose(); onGoCollections(); }}>{t("allCollections")}</Button>
        <Button onClick={() => { onClose(); onGoTags(); }}>{t("allTags")}</Button>
      </footer>
    </>
  );
}

function ResultRow({ id, result, count, active, groupLabel, onPoint, onOpen }: {
  id: string;
  result: JumpResult;
  count: string;
  active: boolean;
  groupLabel: string | null;
  onPoint: () => void;
  onOpen: () => void;
}) {
  return (
    <>
      {groupLabel ? <p role="presentation" className="px-3 pt-3 pb-1 text-2xs font-semibold tracking-wide text-text-secondary uppercase">{groupLabel}</p> : null}
      <div
        id={id}
        role="option"
        aria-selected={active}
        data-highlighted={active ? "" : undefined}
        className="ui-menu-item flex min-h-10 w-full cursor-pointer items-center gap-2.5 text-sm text-text-secondary data-[highlighted]:bg-bg-active data-[highlighted]:text-text-primary"
        onPointerMove={onPoint}
        onClick={onOpen}
      >
        <ResultMarker result={result} />
        <span className="min-w-0 flex-1 truncate">{result.name}</span>
        <span className="shrink-0 text-meta tabular-nums text-text-secondary">{count}</span>
      </div>
    </>
  );
}

function ResultMarker({ result }: { result: JumpResult }) {
  if (result.kind === "tag") return <HashIcon className="size-4 shrink-0 text-text-secondary" />;
  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center text-collection-marker"
      // eslint-disable-next-line shadcn/no-inline-styles -- Per-collection marker hue and lightness custom properties.
      style={collectionMarkerStyle(result.id)}
    >
      {result.pinned ? <PinIcon className="size-3" fill="currentColor" /> : <span className="size-2 rounded-full bg-collection-marker" />}
    </span>
  );
}

function Preview({ result, recent, renaming, mutationBusy, onOpen, onTogglePin, onStartRename, onRenameDraftChange, onCommitRename, onCancelRename, onDelete }: {
  result: JumpResult;
  recent: Item[];
  renaming: string | null;
  mutationBusy: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onStartRename: () => void;
  onRenameDraftChange: (draft: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("JumpPalette");
  const isCollection = result.kind === "collection";
  const kind = isCollection ? (result.pinned ? "pinned" : "collection") : "tag";
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-2 text-xs text-text-secondary">
          <ResultMarker result={result} />
          <span>{t("summary", { kind, count: result.count })}</span>
        </p>
        {renaming !== null ? (
          <form onSubmit={event => { event.preventDefault(); onCommitRename(); }}>
            <input
              autoFocus
              aria-label={t("collectionName")}
              className="ui-field min-h-10 w-full px-3 text-md font-semibold"
              value={renaming}
              disabled={mutationBusy}
              onChange={event => onRenameDraftChange(event.target.value)}
              onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancelRename(); } }}
              onBlur={onCommitRename}
            />
          </form>
        ) : (
          <h2 className="wrap-anywhere text-lg font-semibold text-text-primary">{isCollection ? result.name : t("tagTitle", { name: result.name })}</h2>
        )}
      </div>

      {recent.length > 0 ? (
        <div className="flex min-h-0 flex-col gap-1.5">
          <p className="text-2xs font-semibold tracking-wide text-text-secondary uppercase">{t("recentlyAdded")}</p>
          <ul className="flex flex-col gap-1 text-sm text-text-secondary">
            {recent.map(item => <li key={item.id} className="truncate">{itemListTitle(item)}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="primary" onClick={onOpen}>{t("open")}</Button>
        {isCollection ? (
          <>
            <PaneButton icon={<PinIcon className="size-4" />} disabled={mutationBusy} onClick={onTogglePin}>{result.pinned ? t("unpin") : t("pin")}</PaneButton>
            <PaneButton icon={<EditIcon className="size-4" />} disabled={mutationBusy} onClick={onStartRename}>{t("rename")}</PaneButton>
          </>
        ) : null}
        <Button variant="danger-ghost" disabled={mutationBusy} onClick={onDelete}><DeleteIcon className="size-4" /><span className="ms-2">{t("delete")}</span></Button>
      </div>
    </>
  );
}

function PaneButton({ icon, children, ...props }: { icon: ReactNode; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return <Button {...props}>{icon}<span className="ms-2">{children}</span></Button>;
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex min-w-5 items-center justify-center border border-border-edge px-1 py-0.5 text-2xs leading-none text-text-secondary">{children}</kbd>;
}
