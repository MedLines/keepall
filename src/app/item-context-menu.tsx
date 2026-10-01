"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import { Menu } from "@base-ui/react/menu";
import { useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react";
import { RowActionMenu } from "./row-action-menu";
import { normalizeCollectionName } from "@/domain/collection";
import { normalizeTagName } from "@/domain/tag";
import {
  ArrowRightIcon, CollectionIcon, DeleteIcon, EditIcon, EyeIcon, HashIcon, LayersIcon, LinkIcon,
  PinIcon, PlusIcon, SearchIcon, SelectionCheckedIcon,
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
  onPreview?: () => void;
  onEdit: () => void;
  onOrganize: () => void;
  onDelete: () => void;
  onTogglePin?: () => void;
  pinned?: boolean;
  onOpen?: () => void;
};

const MENU_ITEM = "ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active data-[disabled]:opacity-50";

export function ItemContextMenu({
  children, trigger, title, openHref, tags, assignedTagIds, busy, disabled, tagError,
  onAddTag, onRemoveTag, onPreview, onEdit, onOrganize, onDelete, onTogglePin, pinned, onOpen,
  collections, assignedCollectionIds, collectionError, onMoveToCollection, onClearCollection, triggerRef, trashActions,
}: Props) {
  const openingDialog = useRef(false);

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
      onOpen={() => { openingDialog.current = false; onOpen?.(); }}
      finalFocus={() => openingDialog.current ? false : triggerRef.current ?? true}
      menu={trashActions ? <>
        <Menu.Item className={MENU_ITEM} disabled={busy} onClick={() => openDialog(trashActions.onRestore)}><ArrowRightIcon className="size-4" /><span className="leading-none">Restore</span></Menu.Item>
        <Menu.Separator className="my-1 border-t border-border-edge" />
        <Menu.Item className="ui-menu-item flex w-full items-center gap-2 text-sm text-text-danger outline-none data-[highlighted]:bg-bg-danger data-[disabled]:opacity-50" disabled={busy} onClick={() => openDialog(trashActions.onDelete)}><DeleteIcon className="size-4" /><span className="leading-none">Delete permanently</span></Menu.Item>
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
          {onPreview ? <Menu.Item className={MENU_ITEM} disabled={busy} onClick={() => openDialog(onPreview)}>
            <EyeIcon />Preview
          </Menu.Item> : null}
          <OrganizationSubmenu kind="tags" entries={tags} assignedIds={assignedTagIds} busy={busy} error={tagError} onSelect={onAddTag} onRemove={onRemoveTag} />
          <OrganizationSubmenu kind="collections" entries={collections} assignedIds={assignedCollectionIds} busy={busy} error={collectionError} onSelect={onMoveToCollection} onClear={onClearCollection} />
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
          <ContextMenu.Item className="ui-menu-item flex w-full items-center gap-2 text-sm text-text-danger outline-none hover:bg-bg-danger data-[highlighted]:bg-bg-danger data-[disabled]:opacity-50" disabled={busy} onClick={() => openDialog(onDelete)}>
            <DeleteIcon className="size-4" /><span className="leading-none">Move to Trash</span>
          </ContextMenu.Item>
        </>
      }
    >
      {children}
    </RowActionMenu>
  );
}

function OrganizationSubmenu({ kind, entries, assignedIds, busy, error, onSelect, onRemove, onClear }: {
  kind: "tags" | "collections";
  entries: NamedEntry[];
  assignedIds: string[];
  busy: boolean;
  error: string | null;
  onSelect: (name: string) => void;
  onRemove?: (id: string) => void;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const isTags = kind === "tags";
  const label = isTags ? "Tags" : "Collections";
  const name = isTags ? normalizeTagName(query) : normalizeCollectionName(query);
  const search = name.toLowerCase();
  const matches = entries.filter((entry) => entry.name.toLowerCase().includes(search));
  const canCreate = Boolean(name) && !entries.some((entry) => entry.name.toLowerCase() === search);

  return (
    <Menu.SubmenuRoot
      onOpenChange={(open) => { if (!open) setQuery(""); }}
      onOpenChangeComplete={(open) => { if (open) inputRef.current?.focus(); }}
    >
      <Menu.SubmenuTrigger className={MENU_ITEM}>
        {isTags ? <HashIcon /> : <CollectionIcon />}{label}<ArrowRightIcon className="ms-auto size-4 rtl:rotate-180" />
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner className="z-[61]" sideOffset={4} alignOffset={-4} collisionPadding={8}>
          <Menu.Popup aria-label={label} className="ui-popover flex max-h-[var(--available-height)] w-64 max-w-[calc(100vw-1rem)] flex-col overflow-hidden outline-none">
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
            <div ref={resultsRef} className="ui-scrollbar min-h-0 overflow-y-auto pt-1">
              {isTags ? matches.map((tag) => (
                <Menu.CheckboxItem
                  key={tag.id}
                  className={MENU_ITEM}
                  checked={assignedIds.includes(tag.id)}
                  disabled={busy}
                  closeOnClick={false}
                  onCheckedChange={(checked) => checked ? onSelect(tag.name) : onRemove?.(tag.id)}
                >
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  <Menu.CheckboxItemIndicator><SelectionCheckedIcon className="size-4" /></Menu.CheckboxItemIndicator>
                </Menu.CheckboxItem>
              )) : (
                <Menu.RadioGroup value={assignedIds[0] ?? ""} onValueChange={(id) => {
                  if (!id) onClear?.();
                  else {
                    const entry = entries.find((entry) => entry.id === id);
                    if (entry) onSelect(entry.name);
                  }
                }}>
                  {"unsorted".includes(search) ? (
                    <Menu.RadioItem value="" className={MENU_ITEM} disabled={busy} closeOnClick={false}>
                      <span className="flex-1">Unsorted</span>
                      <Menu.RadioItemIndicator><SelectionCheckedIcon className="size-4" /></Menu.RadioItemIndicator>
                    </Menu.RadioItem>
                  ) : null}
                  {matches.map((entry) => (
                    <Menu.RadioItem key={entry.id} value={entry.id} className={MENU_ITEM} disabled={busy} closeOnClick={false}>
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                      <Menu.RadioItemIndicator><SelectionCheckedIcon className="size-4" /></Menu.RadioItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              )}
              {canCreate ? (
                <Menu.Item className={MENU_ITEM} disabled={busy} closeOnClick={false} onClick={() => onSelect(name)}>
                  <PlusIcon /><span className="min-w-0 truncate">Create “{name}”</span>
                </Menu.Item>
              ) : null}
              {isTags && !matches.length && !canCreate ? <p className="px-3 py-3 text-sm text-text-secondary">Type a name to create your first tag.</p> : null}
            </div>
            {error ? <p role="alert" className="px-3 py-2 text-sm text-text-danger">{error}</p> : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
}
