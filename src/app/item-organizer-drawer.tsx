"use client";

import { useId, useState } from "react";
import { OrganizerDrawer, OrganizerTagChip } from "./organizer-drawer";
import { OrgNameSuggest, type OrgNameSuggestion } from "./org-name-suggest";

type NamedEntry = { id: string; name: string };

type ItemOrganizerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "left" | "right";
  itemTitle: string;
  tags: NamedEntry[];
  collections: NamedEntry[];
  tagSuggestions: OrgNameSuggestion[];
  collectionSuggestions: OrgNameSuggestion[];
  disabled: boolean;
  pendingTag: boolean;
  pendingCollection: boolean;
  tagError: string | null;
  collectionError: string | null;
  onAddTag: (name: string) => void;
  onRemoveTag: (id: string) => void;
  onMoveToCollection: (name: string) => void;
};

export function ItemOrganizerDrawer({
  open,
  onOpenChange,
  side,
  itemTitle,
  tags,
  collections,
  tagSuggestions,
  collectionSuggestions,
  disabled,
  pendingTag,
  pendingCollection,
  tagError,
  collectionError,
  onAddTag,
  onRemoveTag,
  onMoveToCollection,
}: ItemOrganizerDrawerProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [collectionDraft, setCollectionDraft] = useState("");
  const id = useId();

  return (
    <OrganizerDrawer
      open={open} onOpenChange={onOpenChange} side={side}
      title={`Organize ${itemTitle}`}
      description="Add tags or move this item to a collection. Changes apply immediately."
      disabled={disabled}
      tags={<>
        {tags.length > 0 ? (
          <ul className="mb-4 flex flex-wrap gap-2" aria-label="Current tags">
            {tags.map((tag) => (
              <OrganizerTagChip key={tag.id} name={tag.name} disabled={disabled} onRemove={() => onRemoveTag(tag.id)} />
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-text-secondary">No tags added.</p>
        )}
        <OrgNameSuggest
          embedded
          inputId={`${id}-add-tag`}
          label="Add tag"
          placeholder="Search or create a tag"
          value={tagDraft}
          suggestions={tagSuggestions}
          disabled={disabled}
          pending={pendingTag}
          error={tagError}
          suggestWhenEmpty={false}
          onChange={setTagDraft}
          onSubmit={(name) => {
            onAddTag(name);
            setTagDraft("");
          }}
        />
      </>}
      collection={<>
        <p className="mb-4 text-sm text-text-secondary">
          {collections.length > 0
            ? `Currently in ${collections.map((entry) => entry.name).join(", ")}.`
            : "Currently unsorted."}
        </p>
        <OrgNameSuggest
          embedded
          inputId={`${id}-add-collection`}
          label="Move to collection"
          placeholder="Search or create a collection"
          value={collectionDraft}
          suggestions={collectionSuggestions}
          disabled={disabled}
          pending={pendingCollection}
          submitLabel="Move"
          error={collectionError}
          suggestWhenEmpty={false}
          onChange={setCollectionDraft}
          onSubmit={(name) => {
            onMoveToCollection(name);
            setCollectionDraft("");
          }}
        />
      </>}
    />
  );
}
