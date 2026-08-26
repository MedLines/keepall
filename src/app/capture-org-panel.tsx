"use client";

import { SHELL_FORM_SURFACE } from "./shell-styles";
import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";

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
  const unusedTags = tagSuggestions.filter(
    (entry) => !tagNames.includes(entry.name),
  );
  const unusedCollections = collectionSuggestions.filter(
    (entry) => entry.name !== collectionName,
  );

  return (
    <div className={`${SHELL_FORM_SURFACE} flex flex-col gap-3`}>
      <p className="text-xs font-medium text-zinc-500">Optional</p>
      <div>
        {tagNames.length > 0 ? (
          <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Tags">
            {tagNames.map((name) => (
              <li
                key={name}
                className="flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600"
              >
                {name}
                <button
                  className="text-zinc-400 hover:text-zinc-700 disabled:opacity-60"
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove tag ${name}`}
                  onClick={() => onRemoveTag(name)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <OrgNameSuggest
          embedded
          compact
          hideLabel
          inputId="capture-add-tag"
          label="Tags"
          placeholder="Tag name"
          submitLabel="Add tag"
          value={tagInput}
          suggestions={unusedTags}
          disabled={disabled}
          suggestWhenEmpty={false}
          onChange={onTagInputChange}
          onSubmit={(name) => {
            onAddTag(name);
            onTagInputChange("");
          }}
        />
      </div>
      <div>
        {collectionName ? (
          <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Collection">
            <li className="flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
              {collectionName}
              <button
                className="text-zinc-400 hover:text-zinc-700 disabled:opacity-60"
                type="button"
                disabled={disabled}
                aria-label={`Remove collection ${collectionName}`}
                onClick={onClearCollection}
              >
                ×
              </button>
            </li>
          </ul>
        ) : (
          <p className="mb-2 text-xs text-zinc-500">Unsorted until you pick a collection</p>
        )}
        <OrgNameSuggest
          embedded
          compact
          hideLabel
          inputId="capture-add-collection"
          label="Collection"
          placeholder="Collection"
          submitLabel="Add collection"
          value={collectionInput}
          suggestions={unusedCollections}
          disabled={disabled}
          suggestWhenEmpty={false}
          onChange={onCollectionInputChange}
          onSubmit={(name) => {
            onSetCollection(name);
            onCollectionInputChange("");
          }}
        />
      </div>
    </div>
  );
}
