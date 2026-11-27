"use client";

import { useTranslations } from "@/i18n/use-translations";
import { useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { SHELL_TOP_BTN, SHELL_TOP_BTN_ACTIVE, SHELL_TOP_BTN_IDLE } from "./shell-styles";
import { RadioCard } from "@/components/ui/radio-card";

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
  const t = useTranslations("Capture");

  return (
    <ModalDialog
      open busy={busy} title={t("alreadySaved")}
      description={t("conflictDescription")}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      footer={<>
        <button className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} px-4 disabled:opacity-60`} type="button" disabled={busy} onClick={onCancel}>{t("cancel")}</button>
        <button className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_ACTIVE} px-4 disabled:opacity-60`} type="button" disabled={busy}
          onClick={() => onConfirm({
            collectionChoice: conflict.askCollection ? collectionChoice : "keep",
            tagChoice: conflict.askTags ? tagChoice : "merge",
          })}
        >{busy ? t("saving") : t("confirm")}</button>
      </>}
    >
          {conflict.askCollection ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-text-primary">
                {t("collection")}
              </legend>
              <RadioCard className="text-text-primary" name="capture-conflict-collection" checked={collectionChoice === "keep"} disabled={busy} onChange={() => setCollectionChoice("keep")}>
                <span>
                  {t("keepIn", { name: conflict.existingCollectionName ?? "" })}
                </span>
              </RadioCard>
              <RadioCard className="text-text-primary" name="capture-conflict-collection" checked={collectionChoice === "move"} disabled={busy} onChange={() => setCollectionChoice("move")}>
                <span>
                  {conflict.nextCollectionName
                    ? t("moveToNamed", { name: conflict.nextCollectionName })
                    : t("moveToUnsorted")}
                </span>
              </RadioCard>
            </fieldset>
          ) : null}

          {conflict.askTags ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-text-primary">
                {t("tags")}
              </legend>
              <RadioCard className="text-text-primary" name="capture-conflict-tags" checked={tagChoice === "keep"} disabled={busy} onChange={() => setTagChoice("keep")}>
                <span>
                  {t("keepExisting", { tags: formatList(conflict.existingTagNames) })}
                </span>
              </RadioCard>
              <RadioCard className="text-text-primary" name="capture-conflict-tags" checked={tagChoice === "replace"} disabled={busy} onChange={() => setTagChoice("replace")}>
                <span>
                  {t("useNewOnly", { tags: formatList(conflict.nextTagNames) })}
                </span>
              </RadioCard>
              <RadioCard className="text-text-primary" name="capture-conflict-tags" checked={tagChoice === "merge"} disabled={busy} onChange={() => setTagChoice("merge")}>
                <span>{t("mergeBoth")}</span>
              </RadioCard>
            </fieldset>
          ) : null}

    </ModalDialog>
  );
}

export function CaptureLinkConflictDialog(props: Props) {
  return props.conflict ? <LinkConflictChoices {...props} conflict={props.conflict} /> : null;
}
