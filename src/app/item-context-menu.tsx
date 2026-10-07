"use client";

import { ScrollPanel } from "@/components/ui/scroll-panel";

import { ContextMenu } from "@base-ui/react/context-menu";
import { Menu } from "@base-ui/react/menu";
import { useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react";
import { RowActionMenu } from "./row-action-menu";
import { motion, useReducedMotion } from "motion/react";
import { uiMotion } from "@/components/ui/motion-tokens";
import { normalizeCollectionName } from "@/domain/collection";
import { normalizeTagName } from "@/domain/tag";
import {
  ArrowRightIcon, CheckIcon, CollectionIcon, DeleteIcon, EditIcon, EyeIcon, HashIcon, LayersIcon, LinkIcon,
  PinIcon, PlusIcon, RefreshIcon, SearchIcon,
} from "./shell-icons";

type NamedEntry = { id: string; name: string };

type Props = {
  children: (trigger: ReactNode) => ReactElement;
  trigger: ReactElement | null;
  title: string;
  trashActions?: { onRestore: () => void; onDelete: () => void };
  openHref?: string;
  tags: NamedEntry[];
  assignedTagIds: string[];
  collections: NamedEntry[];
  assignedCollectionIds: string[];
  collectionError: string | null;
  onMoveToCollection: (name: string) => void;
  onClearCollection: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  busy: boolean;
  disabled: boolean;
  tagError: string | null;
  onAddTag: (name: string) => void;
  onRemoveTag: (id: string) => void;
  onPreview?: (animate?: boolean) => void;
  onFetchPreview?: () => void;
  fetchingPreview?: boolean;
  hasPreview?: boolean;
  onEdit: () => void;
  onOrganize: () => void;
  onDelete: () => void;
  onTogglePin?: () => void;
  pinned?: boolean;
  onOpen?: () => void;
};

const MENU_ITEM = "ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active";
const ORGANIZATION_ITEM = `${MENU_ITEM} organization-choice rounded-control-md`;

function SelectionMark({ checked }: { checked: boolean }) {
  const reduceMotion = useReducedMotion();
  return <motion.span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center"
    initial={false} animate={{ opacity: checked ? 1 : 0 }}
    transition={reduceMotion ? { duration: 0 } : checked ? uiMotion.fast : uiMotion.fast.exit}>
    <CheckIcon className="size-4" />
  </motion.span>;
}

export function ItemContextMenu({
  children, trigger, title, openHref, tags, assignedTagIds, busy, disabled, tagError,
  onAddTag, onRemoveTag, onPreview, onEdit, onOrganize, onDelete, onTogglePin, pinned, onOpen,
  collections, assignedCollectionIds, collectionError, onMoveToCollection, onClearCollection, triggerRef, trashActions,
  onFetchPreview, fetchingPreview = false, hasPreview = false,
}: Props) {
  const openingDialog = useRef(false);
  const movingToTrash = useRef(false);

  function openDialog(action: () => void) {
    openingDialog.current = true;
    action();
  }

  return (
    <RowActionMenu
      label={`Actions for ${title}`}
      trigger={trigger}
      disabled={disabled}
      triggerRef={triggerRef}
      onOpen={() => { openingDialog.current = false; movingToTrash.current = false; onOpen?.(); }}
      finalFocus={() => {
        if (openingDialog.current) return false;
        const trigger = triggerRef.current;
        const focused = document.activeElement;
        if (movingToTrash.current && focused instanceof HTMLElement && focused !== document.body &&
          focused !== trigger && focused.id !== "library-heading" && !focused.closest(".row-action-popup")) return false;
        if (trigger?.isConnected) return trigger;
        return document.getElementById("library-heading") ?? true;
      }}
      menu={() => trashActions ? <>
        <Menu.Item className={MENU_ITEM} disabled={busy} onClick={() => openDialog(trashActions.onRestore)}><ArrowRightIcon className="size-4" /><span className="leading-none">Restore</span></Menu.Item>
        <Menu.Separator className="my-1 border-t border-border-edge" />
        <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-sm text-text-danger outline-none data-[highlighted]:bg-bg-danger" disabled={busy} onClick={() => openDialog(trashActions.onDelete)}><DeleteIcon className="size-4" /><span className="leading-none">Delete permanently</span></Menu.Item>
      </> :
        <>
          {openHref ? (
            <>
              <Menu.Item className={MENU_ITEM} render={<a href={openHref} target="_blank" rel="noopener noreferrer" />}>
                <LinkIcon />Open in new tab
              </Menu.Item>
              <Menu.Separator className="my-1 border-t border-border-edge" />
            </>
          ) : null}
          {onPreview ? <Menu.Item className={MENU_ITEM} onClick={event => openDialog(() => onPreview(event.detail > 0))}>
            <EyeIcon />Preview
          </Menu.Item> : null}
          {onFetchPreview ? <Menu.Item className={MENU_ITEM} disabled={busy || fetchingPreview} onClick={onFetchPreview}>
            <RefreshIcon />{fetchingPreview ? "Fetching preview…" : hasPreview ? "Refresh preview" : "Fetch preview"}
          </Menu.Item> : null}
          <OrganizationMenu kind="tags" entries={tags} assignedIds={assignedTagIds} busy={busy} error={tagError} onSelect={onAddTag} onRemove={onRemoveTag} />
          <OrganizationMenu kind="collections" entries={collections} assignedIds={assignedCollectionIds} busy={busy} error={collectionError} onSelect={onMoveToCollection} onClear={onClearCollection} />
          <ContextMenu.Separator className="my-1 border-t border-border-edge" />
          {onTogglePin ? (
            <ContextMenu.Item className={MENU_ITEM} disabled={busy} onClick={onTogglePin}>
              <PinIcon />{pinned ? "Unpin" : "Pin"}
            </ContextMenu.Item>
          ) : null}
          <ContextMenu.Item className={MENU_ITEM} disabled={busy} onClick={() => openDialog(onEdit)}>
            <EditIcon />Edit
          </ContextMenu.Item>
          <ContextMenu.Item className={MENU_ITEM} disabled={busy} onClick={() => openDialog(onOrganize)}>
            <LayersIcon />Organize
          </ContextMenu.Item>
          <ContextMenu.Separator className="my-1 border-t border-border-edge" />
          <ContextMenu.Item className="ui-menu-item flex w-full items-center gap-2 text-sm text-text-danger outline-none hover:bg-bg-danger data-[highlighted]:bg-bg-danger" disabled={busy} onClick={() => { movingToTrash.current = true; onDelete(); }}>
            <DeleteIcon className="size-4" /><span className="leading-none">Move to Trash</span>
          </ContextMenu.Item>
        </>
      }
    >
      {children}
    </RowActionMenu>
  );
}

export function OrganizationMenu({ kind, entries, assignedIds, busy, error, onSelect, onRemove, onClear, trigger }: {
  kind: "tags" | "collections";
  entries: NamedEntry[];
  assignedIds: string[];
  busy: boolean;
  error: string | null;
  onSelect: (name: string) => void;
  onRemove?: (id: string) => void;
  onClear?: () => void;
  trigger?: ReactElement;
}) {
  const [query, setQuery] = useState("");
  const [optimisticSelection, setOptimisticSelection] = useState<{ baseline: string; ids: string[] } | null>(null);
  const assignmentKey = JSON.stringify(assignedIds);
  const selectedIds = !error && optimisticSelection?.baseline === assignmentKey ? optimisticSelection.ids : assignedIds;
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const isTags = kind === "tags";
  const label = isTags ? "Tags" : "Collections";
  const name = isTags ? normalizeTagName(query) : normalizeCollectionName(query);
  const search = name.toLowerCase();
  const matches = entries.filter((entry) => entry.name.toLowerCase().includes(search));
  if (isTags) matches.sort((a, b) => Number(selectedIds.includes(b.id)) - Number(selectedIds.includes(a.id)));
  const canCreate = Boolean(name) && !entries.some((entry) => entry.name.toLowerCase() === search);

  const popup = (
      <Menu.Portal>
        <Menu.Positioner className={`${trigger ? "z-[90]" : "z-[61]"} data-[anchor-hidden]:invisible`} align="start" sideOffset={4} alignOffset={trigger ? 0 : -4} collisionPadding={8} positionMethod="fixed">
          <Menu.Popup aria-label={label} className="ui-menu-popup ui-popover flex max-h-[min(20rem,var(--available-height))] w-64 max-w-[calc(100vw-1rem)] flex-col overflow-hidden outline-none">
            <div className="flex shrink-0 items-center gap-2 border-b border-border-edge px-3 pb-2 pt-1">
              <SearchIcon className="size-4 text-text-secondary" />
              <input
                ref={inputRef}
                aria-label={`Search ${kind}`}
                placeholder={`Search ${kind}…`}
                autoComplete="off"
                className="cursor-text select-text min-h-9 min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" || event.key === "Tab") return;
                  event.stopPropagation();
                  if (event.key === "ArrowDown" || event.key === "ArrowUp" || (event.key === "Enter" && !event.nativeEvent.isComposing)) {
                    event.preventDefault();
                    const items = resultsRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])');
                    const target = event.key === "ArrowUp" ? items?.[items.length - 1] : items?.[0];
                    if (event.key === "Enter") target?.click();
                    else target?.focus();
                  }
                }}
              />
            </div>
            <ScrollPanel viewportRef={resultsRef} className="flex min-h-0 flex-col" viewportClassName="min-h-0 flex-1 pt-1">
              {isTags ? matches.map((tag) => (
                <Menu.CheckboxItem
                  key={tag.id}
                  className={ORGANIZATION_ITEM}
                  checked={selectedIds.includes(tag.id)}
                  aria-disabled={busy || undefined}
                  closeOnClick={false}
                  onCheckedChange={(checked) => {
                    if (busy) return;
                    setOptimisticSelection({ baseline: assignmentKey, ids: checked ? [...selectedIds, tag.id] : selectedIds.filter(id => id !== tag.id) });
                    if (checked) onSelect(tag.name); else onRemove?.(tag.id);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  <SelectionMark checked={selectedIds.includes(tag.id)} />
                </Menu.CheckboxItem>
              )) : (
                <Menu.RadioGroup value={selectedIds[0] ?? ""} onValueChange={(id) => {
                  if (busy) return;
                  setOptimisticSelection({ baseline: assignmentKey, ids: id ? [id] : [] });
                  if (!id) onClear?.();
                  else {
                    const entry = entries.find((entry) => entry.id === id);
                    if (entry) onSelect(entry.name);
                  }
                }}>
                  {"unsorted".includes(search) ? (
                    <Menu.RadioItem value="" className={ORGANIZATION_ITEM} aria-disabled={busy || undefined} closeOnClick={false}>
                      <span className="flex-1">Unsorted</span>
                      <SelectionMark checked={selectedIds.length === 0} />
                    </Menu.RadioItem>
                  ) : null}
                  {matches.map((entry) => (
                    <Menu.RadioItem key={entry.id} value={entry.id} className={ORGANIZATION_ITEM} aria-disabled={busy || undefined} closeOnClick={false}>
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                      <SelectionMark checked={selectedIds.includes(entry.id)} />
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              )}
              {canCreate ? (
                <Menu.Item className={ORGANIZATION_ITEM} aria-disabled={busy || undefined} closeOnClick={false} onClick={() => { if (!busy) onSelect(name); }}>
                  <PlusIcon /><span className="min-w-0 truncate">Create “{name}”</span>
                </Menu.Item>
              ) : null}
              {isTags && !matches.length && !canCreate ? <p className="px-3 py-3 text-sm text-text-secondary">Type a name to create your first tag.</p> : null}
            </ScrollPanel>
            {error ? <p role="alert" className="px-3 py-2 text-sm text-text-danger">{error}</p> : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
  );
  const onOpenChange = (open: boolean) => { if (!open) { setQuery(""); setOptimisticSelection(null); } };
  const onOpenChangeComplete = (open: boolean) => { if (open) inputRef.current?.focus(); };
  return trigger ? <Menu.Root modal={false} onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
    <Menu.Trigger render={trigger} />{popup}
  </Menu.Root> : <Menu.SubmenuRoot onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
    <Menu.SubmenuTrigger className={MENU_ITEM}>
      {isTags ? <HashIcon /> : <CollectionIcon />}{label}<ArrowRightIcon className="ms-auto size-4 rtl:rotate-180" />
    </Menu.SubmenuTrigger>{popup}
  </Menu.SubmenuRoot>;
}
