"use client";

import { useId, useState } from "react";
import { SideDrawer } from "@/components/ui/side-drawer";
import { CloseIcon, CollectionIcon, HashIcon } from "./shell-icons";
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
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      side={side}
      title={`Organize ${itemTitle}`}
      description="Add tags or move this item to a collection."
    >
      <div className="scroll-fade min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <div className="flex flex-col gap-8">
          <section aria-labelledby={`${id}-tags`}>
            <div className="mb-3 flex items-center gap-2">
              <HashIcon className="size-5" />
              <h3 id={`${id}-tags`} className="font-medium">
                Tags
              </h3>
            </div>
            {tags.length > 0 ? (
              <ul className="mb-4 flex flex-wrap gap-2" aria-label="Current tags">
                {tags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex min-h-10 items-center gap-1 rounded-control bg-bg-raised ps-3 text-sm"
                  >
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag.name}`}
                      className="flex size-10 items-center justify-center rounded-control text-text-secondary transition-colors hover:bg-bg-danger hover:text-text-danger"
                      disabled={disabled}
                      onClick={() => onRemoveTag(tag.id)}
                    >
                      <CloseIcon className="size-4" />
                    </button>
                  </li>
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
              onChange={setTagDraft}
              onSubmit={(name) => {
                onAddTag(name);
                setTagDraft("");
              }}
            />
          </section>

          <section aria-labelledby={`${id}-collection`}>
            <div className="mb-3 flex items-center gap-2">
              <CollectionIcon className="size-5" />
              <h3 id={`${id}-collection`} className="font-medium">
                Collection
              </h3>
            </div>
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
              onChange={setCollectionDraft}
              onSubmit={(name) => {
                onMoveToCollection(name);
                setCollectionDraft("");
              }}
            />
          </section>
        </div>
      </div>
      <footer className="shrink-0 border-t border-border-edge px-5 py-4">
        <button
          type="button"
          className="flex min-h-10 w-full items-center justify-center rounded-control bg-action-primary px-4 text-sm font-medium text-text-on-action active:scale-[0.96] disabled:opacity-60 motion-reduce:active:scale-100"
          onClick={() => onOpenChange(false)}
        >
          Done
        </button>
      </footer>
    </SideDrawer>
  );
}
