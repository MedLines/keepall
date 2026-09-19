"use client";

import { type KeyboardEvent, useMemo } from "react";
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
  "squircle-panel inline-flex min-h-9 shrink-0 items-center gap-1 rounded-control border px-2 py-1 text-xs disabled:opacity-60";

const PICK_CHIP_OUTLINE =
  "border-border-control bg-bg-control text-text-secondary hover:bg-bg-raised hover:text-text-primary";

const PICK_CHIP_SELECTED =
  "border-border-control bg-bg-active text-text-primary";

const FIELD_INPUT =
  "ui-field h-11 w-full px-3 text-sm disabled:opacity-60";

function filterByQuery(entries: OrgNameSuggestion[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return entries;
  }
  return entries.filter((entry) =>
    entry.name.toLowerCase().includes(normalized),
  );
}

export function CaptureOrgPanel({
  tagNames,
  tagInput,
  collectionName,
  collectionInput,
  tagSuggestions,
  collectionSuggestions,
  disabled,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onCollectionInputChange,
  onSetCollection,
  onClearCollection,
}: Props) {
  const unusedTags = useMemo(
    () =>
      tagSuggestions.filter((entry) => !tagNames.includes(entry.name)),
    [tagNames, tagSuggestions],
  );
  const visibleTagPicks = filterByQuery(unusedTags, tagInput);
  const visibleCollections = filterByQuery(collectionSuggestions, collectionInput);

  const tagQuery = tagInput.trim();
  const collectionQuery = collectionInput.trim();
  const tagQueryMatchesExisting = tagSuggestions.some(
    (entry) => entry.name.toLowerCase() === tagQuery.toLowerCase(),
  );
  const collectionQueryMatchesExisting = collectionSuggestions.some(
    (entry) => entry.name.toLowerCase() === collectionQuery.toLowerCase(),
  );

  function submitTagDraft() {
    const trimmed = tagQuery;
    if (!trimmed || disabled) {
      return;
    }
    if (tagNames.includes(trimmed)) {
      onTagInputChange("");
      return;
    }
    onAddTag(trimmed);
    onTagInputChange("");
  }

  function submitCollectionDraft() {
    const trimmed = collectionQuery;
    if (!trimmed || disabled) {
      return;
    }
    onSetCollection(trimmed);
    onCollectionInputChange("");
  }

  function onTagFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.metaKey || event.ctrlKey) {
      return;
    }
    event.preventDefault();
    submitTagDraft();
  }

  function onCollectionFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.metaKey || event.ctrlKey) {
      return;
    }
    event.preventDefault();
    submitCollectionDraft();
  }

  return (
    <div className="flex flex-col gap-6 py-4">

      <div className="flex flex-col gap-1.5">
        <label htmlFor="capture-add-collection" className="text-sm font-medium text-text-secondary">Collection</label>
        <ul
          className="flex flex-wrap gap-1"
          aria-label="Collections"
        >
          <li>
            <button
              className={`${PICK_CHIP} ${
                collectionName === null ? PICK_CHIP_SELECTED : PICK_CHIP_OUTLINE
              }`}
              type="button"
              disabled={disabled}
              aria-pressed={collectionName === null}
              onClick={() => onClearCollection()}
            >
              Unsorted
            </button>
          </li>
          {visibleCollections.map((entry) => (
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
        {collectionSuggestions.length > 0 && collectionQuery ? (
          visibleCollections.length === 0 ? (
            <p className="text-xs text-text-secondary">
              No matching collections — Enter creates one.
            </p>
          ) : null
        ) : null}
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
          onKeyDown={onCollectionFieldKeyDown}
        />
        {collectionQuery && !collectionQueryMatchesExisting ? (
          <p className="text-xs text-text-secondary">
            Enter to create “{collectionQuery}”
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="capture-add-tag" className="text-sm font-medium text-text-secondary">Tags</label>
        {tagNames.length > 0 ? (
          <ul className="flex flex-wrap gap-1" aria-label="Selected tags">
            {tagNames.map((name) => (
              <li key={name} className={`${PICK_CHIP} ${PICK_CHIP_SELECTED} pr-0.5`}>
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
        {visibleTagPicks.length > 0 ? (
          <ul className="flex flex-wrap gap-1" aria-label="Existing tags">
            {visibleTagPicks.map((entry) => (
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
        ) : tagSuggestions.length > 0 && tagQuery ? (
          <p className="text-xs text-text-secondary">No matching tags — Enter creates one.</p>
        ) : null}
        <input
          autoComplete="off"
          className={FIELD_INPUT}
          disabled={disabled}
          id="capture-add-tag"
          placeholder={tagSuggestions.length > 0 ? "Filter or create tag…" : "Tag name"}
          value={tagInput}
          onChange={(event) => onTagInputChange(event.target.value)}
          onKeyDown={onTagFieldKeyDown}
        />
        {tagQuery && !tagQueryMatchesExisting ? (
          <p className="text-xs text-text-secondary">Enter to create “{tagQuery}”</p>
        ) : null}
      </div>
    </div>
  );
}
