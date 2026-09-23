"use client";

import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { CaptureOrgBrowser } from "./capture-org-browser";
import { CloseIcon, CollectionIcon, HashIcon, PlusIcon } from "./shell-icons";
import type { OrgNameSuggestion } from "./org-name-suggest";

type Props = {
  tagNames: string[];
  tagInput: string;
  collectionName: string | null;
  collectionInput: string;
  tagSuggestions: OrgNameSuggestion[];
  collectionSuggestions: OrgNameSuggestion[];
  disabled: boolean;
  onTagInputChange: (value: string) => void;
  onAddTag: (name: string) => void;
  onRemoveTag: (name: string) => void;
  onCollectionInputChange: (value: string) => void;
  onSetCollection: (name: string) => void;
  onClearCollection: () => void;
};

const PICK_CHIP =
  "control-squircle squircle-panel inline-flex min-h-7 max-w-full shrink-0 items-center gap-1 rounded-control border px-2 py-0.5 text-xs disabled:opacity-60";

const PICK_CHIP_OUTLINE =
  "border-border-control bg-bg-control text-text-secondary hover:bg-bg-raised hover:text-text-primary";

const PICK_CHIP_SELECTED =
  "border-border-control bg-bg-active text-text-primary";

const COMPACT_CHOICE_LIMIT = 6;

function useTwoSuggestionRows(ref: React.RefObject<HTMLUListElement | null>, count: number, resetKey: string) {
  const [visibleCount, setVisibleCount] = useState(count);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setVisibleCount(count));
    return () => cancelAnimationFrame(frame);
  }, [count, resetKey]);
  useLayoutEffect(() => {
    if (visibleCount !== count || !ref.current) return;
    const choices = [...ref.current.children] as HTMLElement[];
    const rows = new Set<number>();
    const limit = choices.findIndex((choice) => {
      rows.add(choice.offsetTop);
      return rows.size > 2;
    });
    if (limit >= 0) {
      const frame = requestAnimationFrame(() => setVisibleCount(limit));
      return () => cancelAnimationFrame(frame);
    }
  }, [count, ref, resetKey, visibleCount]);

  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container || typeof ResizeObserver === "undefined") return;
    let width = container.clientWidth;
    const observer = new ResizeObserver(() => {
      if (container.clientWidth === width) return;
      width = container.clientWidth;
      setVisibleCount(count);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [count, ref]);

  return visibleCount;
}

type SectionHeaderProps = {
  inputId: string;
  label: string;
  kind: "collection" | "tag";
  browseLabel: string;
  showBrowse: boolean;
  disabled: boolean;
  onBrowse: () => void;
};

function SectionHeader({
  inputId,
  label,
  kind,
  browseLabel,
  showBrowse,
  disabled,
  onBrowse,
}: SectionHeaderProps) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3">
      <label
        htmlFor={inputId}
        className="flex items-center gap-2 text-sm font-semibold text-text-primary"
      >
        {kind === "collection" ? <CollectionIcon className="size-4" /> : <HashIcon className="size-4" />}
        {label}
      </label>
      {showBrowse ? (
        <button
          className="min-h-7 rounded-control px-2 text-xs font-medium text-text-secondary hover:bg-bg-raised hover:text-text-primary"
          type="button"
          disabled={disabled}
          onClick={onBrowse}
        >
          {browseLabel}
        </button>
      ) : null}
    </div>
  );
}

function compactChoices(
  entries: OrgNameSuggestion[],
  query: string,
  selectedName?: string | null,
) {
  const normalized = query.trim().toLowerCase();
  if (normalized) {
    return entries
      .filter((entry) => entry.name.toLowerCase().includes(normalized))
      .slice(0, COMPACT_CHOICE_LIMIT);
  }

  const selected = selectedName
    ? entries.find((entry) => entry.name === selectedName)
    : undefined;
  const ordered = selected
    ? [selected, ...entries.filter((entry) => entry.id !== selected.id)]
    : entries;
  return ordered.slice(0, COMPACT_CHOICE_LIMIT);
}

type BrowserSlotProps = Pick<
  Props,
  "collectionName" | "tagNames" | "disabled" | "onSetCollection" | "onAddTag"
> & {
  browserKind: "collection" | "tag" | null;
  collectionSuggestions: OrgNameSuggestion[];
  unusedTags: OrgNameSuggestion[];
  onClose: () => void;
};

function BrowserSlot({
  browserKind,
  collectionName,
  tagNames,
  collectionSuggestions,
  unusedTags,
  disabled,
  onSetCollection,
  onAddTag,
  onClose,
}: BrowserSlotProps) {
  if (!browserKind) {
    return null;
  }

  const isCollection = browserKind === "collection";
  return (
    <CaptureOrgBrowser
      key={browserKind}
      kind={browserKind}
      suggestions={isCollection ? collectionSuggestions : unusedTags}
      selectedNames={
        isCollection ? (collectionName ? [collectionName] : []) : tagNames
      }
      disabled={disabled}
      onChoose={isCollection ? onSetCollection : onAddTag}
      onClose={onClose}
    />
  );
}

function NoMatches({
  query,
  totalCount,
  visibleCount,
  children,
}: {
  query: string;
  totalCount: number;
  visibleCount: number;
  children: string;
}) {
  if (!query || totalCount === 0 || visibleCount > 0) {
    return null;
  }
  return <p className="text-xs text-text-secondary">{children}</p>;
}

function CreateHint({
  query,
  matchesExisting,
}: {
  query: string;
  matchesExisting: boolean;
}) {
  if (!query || matchesExisting) {
    return null;
  }
  return (
    <p className="text-xs text-text-secondary">Enter to create “{query}”</p>
  );
}

type CollectionSectionProps = Pick<
  Props,
  | "collectionName"
  | "collectionInput"
  | "collectionSuggestions"
  | "disabled"
  | "onCollectionInputChange"
  | "onSetCollection"
  | "onClearCollection"
> & { onBrowse: () => void };

function CollectionSection({
  collectionName,
  collectionInput,
  collectionSuggestions,
  disabled,
  onCollectionInputChange,
  onSetCollection,
  onClearCollection,
  onBrowse,
}: CollectionSectionProps) {
  const query = collectionInput.trim();
  const visible = compactChoices(
    collectionSuggestions,
    collectionInput,
    collectionName,
  );
  const selectedCollection = collectionName
    ? collectionSuggestions.find((entry) => entry.name === collectionName) ?? { id: collectionName, name: collectionName }
    : null;
  const otherCollections = selectedCollection
    ? visible.filter((entry) => entry.name !== selectedCollection.name)
    : visible;
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const visibleCount = useTwoSuggestionRows(suggestionsRef, otherCollections.length + 1 + Number(!!selectedCollection), `${collectionInput}:${collectionName}`);
  const matchesExisting = collectionSuggestions.some(
    (entry) => entry.name.toLowerCase() === query.toLowerCase(),
  );

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.metaKey || event.ctrlKey) {
      return;
    }
    event.preventDefault();
    if (!query || disabled) {
      return;
    }
    onSetCollection(query);
    onCollectionInputChange("");
  }

  return (
    <section className="flex flex-col gap-2 rounded-panel border border-border-control p-3">
      <SectionHeader
        inputId="capture-add-collection"
        label="Collection"
        kind="collection"
        browseLabel="Browse all collections"
        showBrowse={collectionSuggestions.length > 0}
        disabled={disabled}
        onBrowse={onBrowse}
      />
      <div className="flex min-h-7 items-center gap-2 text-text-secondary focus-within:text-text-primary">
        <PlusIcon className="size-4" />
        <input
          autoComplete="off"
          className="min-h-7 min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary disabled:opacity-60"
          disabled={disabled}
          id="capture-add-collection"
          placeholder={collectionSuggestions.length > 0 ? "Find or create a collection…" : "Collection name"}
          value={collectionInput}
          onChange={(event) => onCollectionInputChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul ref={suggestionsRef} className="flex max-h-[3.875rem] flex-wrap gap-1.5 overflow-hidden" aria-label="Collections">
        {selectedCollection ? (
          <li>
            <button className={`${PICK_CHIP} ${PICK_CHIP_SELECTED}`} type="button" disabled={disabled} aria-pressed="true" onClick={() => onSetCollection(selectedCollection.name)}>
              <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{selectedCollection.name}</span>
            </button>
          </li>
        ) : null}
        <li>
          <button
            className={`${PICK_CHIP} ${
              collectionName === null ? PICK_CHIP_SELECTED : PICK_CHIP_OUTLINE
            }`}
            type="button"
            disabled={disabled}
            aria-pressed={collectionName === null}
            onClick={onClearCollection}
          >
            <span className="truncate">Unsorted</span>
          </button>
        </li>
        {otherCollections.slice(0, Math.max(0, visibleCount - 1 - Number(!!selectedCollection))).map((entry) => (
          <li key={entry.id}>
            <button
              className={`${PICK_CHIP} ${
                collectionName === entry.name
                  ? PICK_CHIP_SELECTED
                  : PICK_CHIP_OUTLINE
              }`}
              type="button"
              disabled={disabled}
              aria-pressed={collectionName === entry.name}
              onClick={() => onSetCollection(entry.name)}
            >
              {collectionName === entry.name ? <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={1.5} aria-hidden="true" /> : null}
              <span className="truncate">{entry.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <NoMatches
        query={query}
        totalCount={collectionSuggestions.length}
        visibleCount={visible.length}
      >
        No matching collections — Enter creates one.
      </NoMatches>
      <CreateHint query={query} matchesExisting={matchesExisting} />
    </section>
  );
}

type TagSectionProps = Pick<
  Props,
  | "tagNames"
  | "tagInput"
  | "tagSuggestions"
  | "disabled"
  | "onTagInputChange"
  | "onAddTag"
  | "onRemoveTag"
> & {
  unusedTags: OrgNameSuggestion[];
  onBrowse: () => void;
};

function TagSection({
  tagNames,
  tagInput,
  tagSuggestions,
  unusedTags,
  disabled,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onBrowse,
}: TagSectionProps) {
  const query = tagInput.trim();
  const visible = compactChoices(unusedTags, tagInput);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const visibleCount = useTwoSuggestionRows(suggestionsRef, visible.length, `${tagInput}:${tagNames.join("|")}`);
  const matchesExisting = tagSuggestions.some(
    (entry) => entry.name.toLowerCase() === query.toLowerCase(),
  );

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.metaKey || event.ctrlKey) {
      return;
    }
    event.preventDefault();
    if (!query || disabled) {
      return;
    }
    if (!tagNames.includes(query)) {
      onAddTag(query);
    }
    onTagInputChange("");
  }

  return (
    <section className="flex flex-col gap-2 rounded-panel border border-border-control p-3">
      <SectionHeader
        inputId="capture-add-tag"
        label="Tags"
        kind="tag"
        browseLabel="Browse all tags"
        showBrowse={tagSuggestions.length > 0}
        disabled={disabled}
        onBrowse={onBrowse}
      />
      <div className="flex min-h-7 items-center gap-2 text-text-secondary focus-within:text-text-primary">
        <PlusIcon className="size-4" />
        <input
          autoComplete="off"
          className="min-h-7 min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary disabled:opacity-60"
          disabled={disabled}
          id="capture-add-tag"
          placeholder={tagSuggestions.length > 0 ? "Find or create a tag…" : "Tag name"}
          value={tagInput}
          onChange={(event) => onTagInputChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {tagNames.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected tags">
          {tagNames.map((name) => (
            <li
              key={name}
              className={`${PICK_CHIP} ${PICK_CHIP_SELECTED} pr-0.5`}
            >
              <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={1.5} aria-hidden="true" />
              <span className="max-w-40 truncate">{name}</span>
              <button
                className="flex size-6 shrink-0 items-center justify-center rounded-control text-text-secondary hover:bg-bg-danger hover:text-text-danger disabled:opacity-60"
                type="button"
                disabled={disabled}
                aria-label={`Remove tag ${name}`}
                onClick={() => onRemoveTag(name)}
              >
                <CloseIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {visible.length > 0 ? (
        <ul ref={suggestionsRef} className="flex max-h-[3.875rem] flex-wrap gap-1.5 overflow-hidden" aria-label="Existing tags">
          {visible.slice(0, visibleCount).map((entry) => (
            <li key={entry.id}>
              <button
                className={`${PICK_CHIP} ${PICK_CHIP_OUTLINE}`}
                type="button"
                disabled={disabled}
                onClick={() => onAddTag(entry.name)}
              >
                <span className="truncate">{entry.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <NoMatches
        query={query}
        totalCount={tagSuggestions.length}
        visibleCount={visible.length}
      >
        No matching tags — Enter creates one.
      </NoMatches>
      <CreateHint query={query} matchesExisting={matchesExisting} />
    </section>
  );
}

export function CaptureOrgPanel(props: Props) {
  const [browserKind, setBrowserKind] = useState<"collection" | "tag" | null>(
    null,
  );
  const unusedTags = useMemo(
    () =>
      props.tagSuggestions.filter(
        (entry) => !props.tagNames.includes(entry.name),
      ),
    [props.tagNames, props.tagSuggestions],
  );

  return (
    <div className="flex flex-col gap-4 py-1">
      <CollectionSection
        collectionName={props.collectionName}
        collectionInput={props.collectionInput}
        collectionSuggestions={props.collectionSuggestions}
        disabled={props.disabled}
        onCollectionInputChange={props.onCollectionInputChange}
        onSetCollection={props.onSetCollection}
        onClearCollection={props.onClearCollection}
        onBrowse={() => setBrowserKind("collection")}
      />
      <TagSection
        tagNames={props.tagNames}
        tagInput={props.tagInput}
        tagSuggestions={props.tagSuggestions}
        unusedTags={unusedTags}
        disabled={props.disabled}
        onTagInputChange={props.onTagInputChange}
        onAddTag={props.onAddTag}
        onRemoveTag={props.onRemoveTag}
        onBrowse={() => setBrowserKind("tag")}
      />
      <BrowserSlot
        browserKind={browserKind}
        collectionName={props.collectionName}
        tagNames={props.tagNames}
        collectionSuggestions={props.collectionSuggestions}
        unusedTags={unusedTags}
        disabled={props.disabled}
        onSetCollection={props.onSetCollection}
        onAddTag={props.onAddTag}
        onClose={() => setBrowserKind(null)}
      />
    </div>
  );
}
