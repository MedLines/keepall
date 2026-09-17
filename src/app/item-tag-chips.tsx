"use client";

import { useState } from "react";

type TagChip = { id: string; name: string };

type Props = {
  tags: TagChip[];
  mutationBusy: boolean;
  onBrowseTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  className?: string;
};

export function ItemTagChips({
  tags,
  mutationBusy,
  onBrowseTag,
  onRemoveTag,
  className = "flex flex-wrap gap-1.5",
}: Props) {
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  if (tags.length === 0) {
    return null;
  }

  return (
    <ul className={className} aria-label="Tags">
      {tags.map((tag) => {
        const confirming = pendingRemoveId === tag.id;
        return (
          <li
            key={tag.id}
            className="inline-flex min-w-0 max-w-full items-center rounded-md bg-bg-raised text-xs text-text-secondary"
          >
            <button
              type="button"
              title={tag.name}
              className="min-h-8 min-w-0 truncate px-2 text-start transition-colors hover:text-text-primary"
              onClick={() => {
                setPendingRemoveId(null);
                onBrowseTag(tag.id);
              }}
            >
              {tag.name}
            </button>
            {confirming ? (
              <button
                type="button"
                className="min-h-8 shrink-0 border-s border-border-edge px-2 font-medium text-text-primary transition-colors hover:bg-bg-raised"
                aria-label={`Confirm remove tag ${tag.name}`}
                disabled={mutationBusy}
                onClick={() => {
                  onRemoveTag(tag.id);
                  setPendingRemoveId(null);
                }}
              >
                ✓
              </button>
            ) : (
              <button
                type="button"
                className="min-h-8 shrink-0 border-s border-border-edge px-2 transition-colors hover:bg-bg-raised"
                aria-label={`Remove tag ${tag.name}`}
                disabled={mutationBusy}
                onClick={() => setPendingRemoveId(tag.id)}
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
