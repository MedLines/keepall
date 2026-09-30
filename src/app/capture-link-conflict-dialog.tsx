"use client";

import { useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
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

function LinkConflictChoices({
  conflict,
  busy,
  onConfirm,
  onCancel,
}: Props & { conflict: CaptureLinkConflict }) {
  const [collectionChoice, setCollectionChoice] = useState<"keep" | "move">(
    "keep",
  );
  const [tagChoice, setTagChoice] = useState<"keep" | "replace" | "merge">(
    "merge",
  );

  return (
    <ModalDialog
      open busy={busy} title="Already saved"
      description="This item is already in your library. Choose how to update tags and collection."
      onOpenChange={(open) => { if (!open) onCancel(); }}
      footer={<>
        <button className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} px-4 disabled:opacity-60`} type="button" disabled={busy} onClick={onCancel}>Cancel</button>
        <button className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_ACTIVE} px-4 disabled:opacity-60`} type="button" disabled={busy}
          onClick={() => onConfirm({
            collectionChoice: conflict.askCollection ? collectionChoice : "keep",
            tagChoice: conflict.askTags ? tagChoice : "merge",
          })}
        >{busy ? "Saving…" : "Confirm"}</button>
      </>}
    >
          {conflict.askCollection ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-text-primary">
                Collection
              </legend>
              <label className="ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm text-text-primary has-[:checked]:bg-bg-active">
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
              <label className="ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm text-text-primary has-[:checked]:bg-bg-active">
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
              <label className="ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm text-text-primary has-[:checked]:bg-bg-active">
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
              <label className="ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm text-text-primary has-[:checked]:bg-bg-active">
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
              <label className="ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm text-text-primary has-[:checked]:bg-bg-active">
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

    </ModalDialog>
  );
}

export function CaptureLinkConflictDialog(props: Props) {
  return props.conflict ? <LinkConflictChoices {...props} conflict={props.conflict} /> : null;
}
