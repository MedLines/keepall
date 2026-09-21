"use client";

import { type KeyboardEvent, useMemo, useState } from "react";
import { CaptureOrgBrowser } from "./capture-org-browser";
import { CloseIcon } from "./shell-icons";
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
  "control-squircle squircle-panel inline-flex min-h-9 shrink-0 items-center gap-1 rounded-control border px-2 py-1 text-xs disabled:opacity-60";

const PICK_CHIP_OUTLINE =
  "border-border-control bg-bg-control text-text-secondary hover:bg-bg-raised hover:text-text-primary";

const PICK_CHIP_SELECTED =
  "border-border-control bg-bg-active text-text-primary";

const FIELD_INPUT =
  "ui-field h-11 w-full px-3 text-sm disabled:opacity-60";

const COMPACT_CHOICE_LIMIT = 6;

type SectionHeaderProps = {
  inputId: string;
  label: string;
  browseLabel: string;
  showBrowse: boolean;
  disabled: boolean;
  onBrowse: () => void;
};

function SectionHeader({
  inputId,
  label,
  browseLabel,
  showBrowse,
  disabled,
  onBrowse,
}: SectionHeaderProps) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-text-secondary"
      >
        {label}
      </label>
      {showBrowse ? (
        <button
          className="min-h-8 rounded-control px-2 text-xs font-medium text-text-secondary hover:bg-bg-raised hover:text-text-primary"
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
    <div className="flex flex-col gap-1.5">
      <SectionHeader
        inputId="capture-add-collection"
        label="Collection"
        browseLabel="Browse all collections"
        showBrowse={collectionSuggestions.length > COMPACT_CHOICE_LIMIT}
        disabled={disabled}
        onBrowse={onBrowse}
      />
      <ul className="flex flex-wrap gap-1" aria-label="Collections">
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
            Unsorted
          </button>
        </li>
        {visible.map((entry) => (
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
              {entry.name}
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
      <input
        autoComplete="off"
        className={FIELD_INPUT}
        disabled={disabled}
        id="capture-add-collection"
        placeholder={
          collectionSuggestions.length > 0
            ? "Filter or new collection…"
            : "Collection name"
        }
        value={collectionInput}
        onChange={(event) => onCollectionInputChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <CreateHint query={query} matchesExisting={matchesExisting} />
    </div>
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
    <div className="flex flex-col gap-1.5">
      <SectionHeader
        inputId="capture-add-tag"
        label="Tags"
        browseLabel="Browse all tags"
        showBrowse={tagSuggestions.length > COMPACT_CHOICE_LIMIT}
        disabled={disabled}
        onBrowse={onBrowse}
      />
      {tagNames.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label="Selected tags">
          {tagNames.map((name) => (
            <li
              key={name}
              className={`${PICK_CHIP} ${PICK_CHIP_SELECTED} pr-0.5`}
            >
              {name}
              <button
                className="flex size-8 shrink-0 items-center justify-center rounded-control text-text-secondary hover:bg-bg-danger hover:text-text-danger disabled:opacity-60"
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
        <ul className="flex flex-wrap gap-1" aria-label="Existing tags">
          {visible.map((entry) => (
            <li key={entry.id}>
              <button
                className={`${PICK_CHIP} ${PICK_CHIP_OUTLINE}`}
                type="button"
                disabled={disabled}
                onClick={() => onAddTag(entry.name)}
              >
                {entry.name}
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
      <input
        autoComplete="off"
        className={FIELD_INPUT}
        disabled={disabled}
        id="capture-add-tag"
        placeholder={
          tagSuggestions.length > 0 ? "Filter or create tag…" : "Tag name"
        }
        value={tagInput}
        onChange={(event) => onTagInputChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <CreateHint query={query} matchesExisting={matchesExisting} />
    </div>
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
    <div className="flex flex-col gap-6 py-4">
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
