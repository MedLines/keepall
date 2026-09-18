"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SHELL_TOP_BTN, SHELL_TOP_BTN_ACTIVE, SHELL_TOP_BTN_IDLE } from "./shell-styles";

export type CaptureLinkConflict = {
  itemId: string;
  existingCollectionName: string | null;
  nextCollectionName: string | null;
  existingTagNames: string[];
  nextTagNames: string[];
  askCollection: boolean;
  askTags: boolean;
};

export type CaptureLinkConflictChoice = {
  collectionChoice: "keep" | "move";
  tagChoice: "keep" | "replace" | "merge";
};

type Props = {
  conflict: CaptureLinkConflict | null;
  busy: boolean;
  onConfirm: (choice: CaptureLinkConflictChoice) => void;
  onCancel: () => void;
};

function formatList(names: string[]): string {
  if (names.length === 0) {
    return "none";
  }
  return names.map((name) => `“${name}”`).join(", ");
}

export function CaptureLinkConflictDialog({
  conflict,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [collectionChoice, setCollectionChoice] = useState<"keep" | "move">(
    "keep",
  );
  const [tagChoice, setTagChoice] = useState<"keep" | "replace" | "merge">(
    "merge",
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (conflict && !dialog.open) {
      setCollectionChoice("keep");
      setTagChoice("merge");
      dialog.showModal();
    }
    if (!conflict && dialog.open) {
      dialog.close();
    }
  }, [conflict]);

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto h-fit max-h-[min(90dvh,32rem)] w-[min(100%-2rem,28rem)] overflow-hidden rounded-[12px] bg-bg-surface p-0 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_16px_40px_rgba(0,0,0,0.16)] [&::backdrop]:bg-bg-overlay/35 [&::backdrop]:backdrop-blur-[1px]"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
    >
      {conflict ? (
        <div className="scroll-fade flex max-h-[min(90dvh,32rem)] flex-col gap-4 overflow-y-auto p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" id={titleId}>
              Already saved
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              This item is already in your library. Choose how to update tags
              and collection.
            </p>
          </div>

          {conflict.askCollection ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-text-primary">
                Collection
              </legend>
              <label className="flex items-start gap-2 text-sm text-text-primary">
                <input
                  className="mt-1"
                  type="radio"
                  name="capture-conflict-collection"
                  checked={collectionChoice === "keep"}
                  disabled={busy}
                  onChange={() => setCollectionChoice("keep")}
                />
                <span>
                  Keep in “{conflict.existingCollectionName}”
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-text-primary">
                <input
                  className="mt-1"
                  type="radio"
                  name="capture-conflict-collection"
                  checked={collectionChoice === "move"}
                  disabled={busy}
                  onChange={() => setCollectionChoice("move")}
                />
                <span>
                  Move to{" "}
                  {conflict.nextCollectionName
                    ? `“${conflict.nextCollectionName}”`
                    : "Unsorted"}
                </span>
              </label>
            </fieldset>
          ) : null}

          {conflict.askTags ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-text-primary">
                Tags
              </legend>
              <label className="flex items-start gap-2 text-sm text-text-primary">
                <input
                  className="mt-1"
                  type="radio"
                  name="capture-conflict-tags"
                  checked={tagChoice === "keep"}
                  disabled={busy}
                  onChange={() => setTagChoice("keep")}
                />
                <span>
                  Keep existing ({formatList(conflict.existingTagNames)})
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-text-primary">
                <input
                  className="mt-1"
                  type="radio"
                  name="capture-conflict-tags"
                  checked={tagChoice === "replace"}
                  disabled={busy}
                  onChange={() => setTagChoice("replace")}
                />
                <span>
                  Use new only ({formatList(conflict.nextTagNames)})
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-text-primary">
                <input
                  className="mt-1"
                  type="radio"
                  name="capture-conflict-tags"
                  checked={tagChoice === "merge"}
                  disabled={busy}
                  onChange={() => setTagChoice("merge")}
                />
                <span>Merge both</span>
              </label>
            </fieldset>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_ACTIVE} px-4 disabled:opacity-60`}
              type="button"
              disabled={busy}
              onClick={() =>
                onConfirm({
                  collectionChoice: conflict.askCollection
                    ? collectionChoice
                    : "keep",
                  tagChoice: conflict.askTags ? tagChoice : "merge",
                })
              }
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button
              className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} px-4 disabled:opacity-60`}
              type="button"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
