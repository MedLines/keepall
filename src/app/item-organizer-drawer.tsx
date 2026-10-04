"use client";

import { useState } from "react";
import { OrganizerDrawer } from "./organizer-drawer";
import { CaptureOrgPanel } from "./capture-org-panel";
import type { OrgNameSuggestion } from "./org-name-suggest";

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
  onMoveToUnsorted: () => void;
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
  onMoveToUnsorted,
}: ItemOrganizerDrawerProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [collectionDraft, setCollectionDraft] = useState("");

  return (
    <OrganizerDrawer
      open={open} onOpenChange={onOpenChange} side={side}
      title={`Organize ${itemTitle}`}
      description="Move this item to a collection or add tags. Changes apply immediately."
      disabled={disabled}
    >
      <CaptureOrgPanel
        tagNames={tags.map((tag) => tag.name)}
        tagInput={tagDraft}
        tagInputLabel="Add tag"
        collectionName={collections[0]?.name ?? null}
        collectionInput={collectionDraft}
        collectionInputLabel="Move to collection"
        tagSuggestions={tagSuggestions}
        collectionSuggestions={collectionSuggestions}
        disabled={disabled || pendingTag || pendingCollection}
        tagError={tagError}
        collectionError={collectionError}
        onTagInputChange={setTagDraft}
        onCollectionInputChange={setCollectionDraft}
        onAddTag={(name) => {
          onAddTag(name);
          setTagDraft("");
        }}
        onRemoveTag={(name) => {
          const tag = tags.find((entry) => entry.name === name);
          if (tag) onRemoveTag(tag.id);
        }}
        onSetCollection={(name) => {
          onMoveToCollection(name);
          setCollectionDraft("");
        }}
        onClearCollection={onMoveToUnsorted}
      />
    </OrganizerDrawer>
  );
}
