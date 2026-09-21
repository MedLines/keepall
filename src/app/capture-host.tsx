"use client";

import { type ClipboardEvent, type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import {
  captureReducer,
  initialCaptureState,
  shouldBlockDialogDismiss,
} from "@/domain/capture";
import {
  captureOrgDrafts,
  rankCaptureOrganizations,
} from "@/domain/capture-org";
import { classifyCapture, resolveCapture } from "@/domain/classify";
import {
  ImageValidationError,
  textFieldsFromAccompanyingText,
} from "@/domain/image";
import { LinkValidationError } from "@/domain/link";
import { NoteValidationError } from "@/domain/note";
import { applyItemOrg } from "@/persistence/apply-item-org";
import {
  clearCollectionOnItem,
  createNote,
  createOrReuseImage,
  createOrReuseLink,
  findImageByAssetPayloads,
  findLinkByNormalizedUrl,
  listItems,
  replaceItemTagsByNames,
} from "@/persistence/items";
import { listCollections } from "@/persistence/collections";
import { listTags } from "@/persistence/tags";
import { getLibraryPreferences } from "@/persistence/library-preferences";
import { CaptureOrgPanel } from "./capture-org-panel";
import {
  CaptureLinkConflictDialog,
  type CaptureLinkConflict,
  type CaptureLinkConflictChoice,
} from "./capture-link-conflict-dialog";
import { enrichLinkPreview } from "./enrich-link-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { OPEN_CAPTURE_EVENT } from "./capture-events";
import type { OrgNameSuggestion } from "./org-name-suggest";
import { readClipboardImageAndText } from "./read-clipboard-capture";
import { SHELL_TOP_BTN, SHELL_TOP_BTN_ACTIVE, SHELL_TOP_BTN_IDLE } from "./shell-styles";
import {
  captureCollectionConflict,
  captureTagConflict,
} from "@/domain/link";
import type { CaptureOrgDrafts } from "@/domain/capture-org";
import { SideDrawer } from "@/components/ui/side-drawer";


const IMAGE_ACTION_BTN = `${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} px-3 text-xs disabled:opacity-60`;

function imageDraftPreviewMaxHeightClass(count: number): string {
  if (count <= 2) {
    return "max-h-16";
  }
  if (count <= 4) {
    return "max-h-14";
  }
  if (count <= 6) {
    return "max-h-12";
  }
  return "max-h-10";
}

/** Alt+K (Windows/Linux) and Option+K (macOS). Option is altKey; code stays KeyK even when Option remaps the character. */
export function isCaptureOpenShortcut(event: KeyboardEvent): boolean {
  return (
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.code === "KeyK"
  );
}

type ImageDraft = {
  bytes: Uint8Array;
  mimeType: string;
  previewUrl: string;
};

function revokeImageDraftPreviews(drafts: ImageDraft[]): void {
  for (const draft of drafts) {
    URL.revokeObjectURL(draft.previewUrl);
  }
}

async function applyCaptureOrg(
  itemId: string,
  org: CaptureOrgDrafts,
  choices: {
    collectionChoice: "keep" | "move" | null;
    tagChoice: "keep" | "replace" | "merge";
  },
): Promise<void> {
  const { collectionChoice, tagChoice } = choices;

  if (tagChoice === "replace") {
    await replaceItemTagsByNames(itemId, org.tagNames);
  } else if (tagChoice === "merge" && org.tagNames.length > 0) {
    await applyItemOrg(itemId, {
      tagNames: org.tagNames,
      collectionName: null,
    });
  }

  if (collectionChoice === "keep") {
    return;
  }

  if (collectionChoice === "move" && !org.collectionName) {
    await clearCollectionOnItem(itemId);
    return;
  }

  if (org.collectionName) {
    await applyItemOrg(itemId, {
      tagNames: [],
      collectionName: org.collectionName,
    });
  }
}

export function CaptureHost() {
  const [state, dispatch] = useReducer(captureReducer, initialCaptureState);
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);
  const [draftTagNames, setDraftTagNames] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [draftCollectionName, setDraftCollectionName] = useState<string | null>(
    null,
  );
  const [collectionInput, setCollectionInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<OrgNameSuggestion[]>([]);
  const [collectionSuggestions, setCollectionSuggestions] = useState<
    OrgNameSuggestion[]
  >([]);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [linkConflict, setLinkConflict] = useState<CaptureLinkConflict | null>(
    null,
  );
  const [captureSide, setCaptureSide] = useState<"left" | "right">("right");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveInFlightRef = useRef(false);
  const savedItemIdRef = useRef<string | null>(null);
  const isActive = state.status !== "idle";
  const classified = classifyCapture(state.input).type;
  const kind = state.override ?? classified;
  const savingImage = imageDrafts.length > 0;
  const composeLocked =
    state.status === "saving" ||
    state.status === "reading" ||
    savedItemId !== null;
  const orgLocked = state.status === "saving" || state.status === "reading";

  useEffect(() => {
    function openCapture() {
      setCaptureSide(
        document.documentElement.dir === "rtl" ? "left" : "right",
      );
      dispatch({ type: "open" });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isCaptureOpenShortcut(event)) {
        event.preventDefault();
        openCapture();
      }
    }

    function onOpenCapture() {
      openCapture();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_CAPTURE_EVENT, onOpenCapture);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_CAPTURE_EVENT, onOpenCapture);
    };
  }, []);

  useEffect(() => {
    if (state.status !== "reading") {
      return;
    }

    savedItemIdRef.current = null;
    setSavedItemId(null);
    setLinkConflict(null);
    setDraftTagNames([]);
    setTagInput("");
    setDraftCollectionName(null);
    setCollectionInput("");

    let cancelled = false;

    void readClipboardImageAndText()
      .then(({ image, text }) => {
        if (cancelled) {
          return;
        }
        if (image) {
          void setDraftFromBlob(image, text, "reading");
          return;
        }
        dispatch({ type: "clipboard", text });
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({ type: "clipboardUnavailable" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.status]);

  useEffect(() => {
    if (state.status === "open" || state.status === "failed") {
      inputRef.current?.focus();
    }
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "saved") {
      return;
    }

    const timer = window.setTimeout(() => {
      resetSession();
      dispatch({ type: "dismiss" });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [state.status]);

  useEffect(() => {
    return () => {
      revokeImageDraftPreviews(imageDrafts);
    };
  }, [imageDrafts]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    let cancelled = false;

    void Promise.all([
      listTags(),
      listCollections(),
      listItems(),
      getLibraryPreferences(),
    ])
      .then(([tags, collections, items, preferences]) => {
        if (cancelled) {
          return;
        }
        setTagSuggestions(
          rankCaptureOrganizations(tags, items, "tag").map((tag) => ({
            id: tag.id,
            name: tag.name,
          })),
        );
        setCollectionSuggestions(
          rankCaptureOrganizations(
            collections,
            items,
            "collection",
            preferences.pinnedCollectionIds,
          ).map((collection) => ({
            id: collection.id,
            name: collection.name,
          })),
        );
      })
      .catch(() => {
        /* typeahead stays empty; save still works */
      });

    return () => {
      cancelled = true;
    };
  }, [isActive]);

  function rememberSavedItem(itemId: string) {
    savedItemIdRef.current = itemId;
    setSavedItemId(itemId);
  }

  function resetSession() {
    savedItemIdRef.current = null;
    setSavedItemId(null);
    setLinkConflict(null);
    setDraftTagNames([]);
    setTagInput("");
    setDraftCollectionName(null);
    setCollectionInput("");
    clearImageDrafts();
  }

  function dispatchDraftText(
    accompanyingText: string,
    status: typeof state.status,
  ) {
    const fields = textFieldsFromAccompanyingText(accompanyingText);
    const text = fields.sourceUrl || fields.caption || accompanyingText;
    if (status === "reading") {
      dispatch({ type: "clipboard", text });
    } else if (status === "open" || status === "failed") {
      dispatch({ type: "input", text });
    }
  }

  async function setDraftFromFiles(
    files: File[],
    accompanyingText: string,
    status: typeof state.status,
  ) {
    if (files.length === 0) {
      return;
    }

    try {
      const drafts: ImageDraft[] = [];
      for (const file of files) {
        const buffer = new Uint8Array(await file.arrayBuffer());
        drafts.push({
          bytes: buffer,
          mimeType: file.type || "application/octet-stream",
          previewUrl: URL.createObjectURL(file),
        });
      }
      setImageDrafts((previous) => [...previous, ...drafts]);
      dispatchDraftText(accompanyingText, status);
    } catch {
      if (status === "reading") {
        dispatch({ type: "clipboardUnavailable" });
      }
    }
  }

  async function setDraftFromBlob(
    blob: Blob,
    accompanyingText: string,
    status: typeof state.status,
  ) {
    await setDraftFromFiles(
      [new File([blob], "clipboard-image", { type: blob.type })],
      accompanyingText,
      status,
    );
  }

  function clearImageDrafts() {
    setImageDrafts((previous) => {
      revokeImageDraftPreviews(previous);
      return [];
    });
  }

  async function onPickFiles(files: FileList | File[] | undefined) {
    if (!files || files.length === 0) {
      return;
    }
    await setDraftFromFiles(Array.from(files), state.input, state.status);
  }

  async function pasteImageFromClipboard() {
    if (composeLocked) {
      return;
    }
    const { image, text } = await readClipboardImageAndText();
    if (image) {
      await setDraftFromBlob(image, text || state.input, state.status);
    }
  }

  async function onPaste(event: ClipboardEvent<HTMLFormElement>) {
    if (composeLocked) {
      return;
    }

    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    for (const item of items) {
      if (!item.type.startsWith("image/")) {
        continue;
      }
      const file = item.getAsFile();
      if (!file) {
        continue;
      }
      event.preventDefault();
      await setDraftFromBlob(file, state.input, state.status);
      return;
    }
  }

  async function persistCapture(options?: {
    conflictChoice?: CaptureLinkConflictChoice;
  }) {
    if (saveInFlightRef.current) {
      return;
    }

    const org = captureOrgDrafts(
      [...draftTagNames, tagInput],
      draftCollectionName ?? collectionInput,
    );
    const conflictChoice = options?.conflictChoice ?? null;

    let collectionChoice: "keep" | "move" | null = null;
    let tagChoice: "keep" | "replace" | "merge" = "merge";

    async function resolveExistingOrgConflict(existing: {
      id: string;
      tagIds: string[];
      collectionIds: string[];
    }): Promise<boolean> {
      const [collections, tags] = await Promise.all([
        listCollections(),
        listTags(),
      ]);
      const existingCollectionId = existing.collectionIds[0] ?? null;
      const existingCollectionName = existingCollectionId
        ? (collections.find((entry) => entry.id === existingCollectionId)
            ?.name ?? null)
        : null;
      const existingTagNames = existing.tagIds
        .map((id) => tags.find((tag) => tag.id === id)?.name)
        .filter((name): name is string => Boolean(name));

      const askCollection = captureCollectionConflict(
        existingCollectionName,
        org.collectionName,
      );
      const askTags = captureTagConflict(existingTagNames, org.tagNames);

      if ((askCollection || askTags) && !conflictChoice) {
        setLinkConflict({
          itemId: existing.id,
          existingCollectionName,
          nextCollectionName: org.collectionName,
          existingTagNames,
          nextTagNames: org.tagNames,
          askCollection,
          askTags,
        });
        return false;
      }

      if (conflictChoice) {
        collectionChoice = askCollection
          ? conflictChoice.collectionChoice
          : null;
        tagChoice = askTags ? conflictChoice.tagChoice : "merge";
      }
      return true;
    }

    if (!savedItemIdRef.current && imageDrafts.length > 0) {
      const existing = await findImageByAssetPayloads(
        imageDrafts.map((draft) => ({
          bytes: draft.bytes,
          mimeType: draft.mimeType,
        })),
      );
      if (existing) {
        const ok = await resolveExistingOrgConflict(existing);
        if (!ok) {
          return;
        }
      }
    } else if (!savedItemIdRef.current && imageDrafts.length === 0) {
      const resolved = resolveCapture(state.input, state.override);
      if (!resolved.ok) {
        dispatch({ type: "failed", message: resolved.error });
        return;
      }

      if (resolved.classification.type === "link") {
        const existing = await findLinkByNormalizedUrl(
          resolved.classification.url,
        );
        if (existing) {
          const ok = await resolveExistingOrgConflict(existing);
          if (!ok) {
            return;
          }
        }
      }
    }

    if (captureReducer(state, { type: "save" }).status !== "saving") {
      return;
    }

    saveInFlightRef.current = true;
    dispatch({ type: "save" });
    setLinkConflict(null);

    try {
      let itemId = savedItemIdRef.current;

      if (!itemId) {
        if (imageDrafts.length > 0) {
          const fields = textFieldsFromAccompanyingText(state.input);
          const { image } = await createOrReuseImage({
            assets: imageDrafts.map((draft) => ({
              bytes: draft.bytes,
              mimeType: draft.mimeType,
            })),
            sourceUrl: fields.sourceUrl || undefined,
            caption: fields.caption || undefined,
          });
          itemId = image.id;
        } else {
          const resolved = resolveCapture(state.input, state.override);
          if (!resolved.ok) {
            dispatch({ type: "failed", message: resolved.error });
            return;
          }

          if (resolved.classification.type === "link") {
            const { link, created } = await createOrReuseLink({
              url: resolved.classification.url,
            });
            itemId = link.id;
            if (created) {
              void enrichLinkPreview(link.id, link.url);
            }
          } else {
            const note = await createNote({
              content: resolved.classification.content,
            });
            itemId = note.id;
          }
        }

        rememberSavedItem(itemId);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      }

      await applyCaptureOrg(itemId, org, { collectionChoice, tagChoice });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

      dispatch({ type: "saved" });
    } catch (caught) {
      if (savedItemIdRef.current) {
        dispatch({
          type: "failed",
          message: "Saved, but couldn't add tags or collection. Try again.",
        });
        return;
      }

      if (caught instanceof ImageValidationError) {
        dispatch({ type: "failed", message: caught.message });
      } else if (
        caught instanceof NoteValidationError ||
        caught instanceof LinkValidationError
      ) {
        dispatch({ type: "failed", message: caught.message });
      } else {
        dispatch({ type: "failed", message: "Couldn't save. Try again." });
      }
    } finally {
      saveInFlightRef.current = false;
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistCapture();
  }

  async function confirmLinkConflict(choice: CaptureLinkConflictChoice) {
    await persistCapture({ conflictChoice: choice });
  }

  function cancelLinkConflict() {
    setLinkConflict(null);
  }

  function addDraftTag(name: string) {
    const next = captureOrgDrafts([...draftTagNames, name], null);
    setDraftTagNames(next.tagNames);
  }

  return (
    <>
    <SideDrawer
      open={isActive}
      side={captureSide}
      title="Save to Keepall"
      description="Paste a link, write a note, or add images."
      widthClassName="w-[min(30rem,100vw)]"
      closeDisabled={shouldBlockDialogDismiss(state.status)}
      onOpenChange={(open, eventDetails) => {
        if (open) {
          return;
        }
        if (shouldBlockDialogDismiss(state.status)) {
          eventDetails.cancel();
          return;
        }
        resetSession();
        dispatch({ type: "dismiss" });
      }}
    >
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onSubmit={onSubmit}
        onPaste={onPaste}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
      >
        <div
          className="scroll-fade flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-7 pb-5 pt-2"
          data-testid="capture-scroll-region"
        >
        {imageDrafts.length > 0 ? (
          <ul
            className={`flex gap-1.5 ${imageDrafts.length === 1 ? "" : "w-full"}`}
            aria-label={`${imageDrafts.length} image${imageDrafts.length === 1 ? "" : "s"} attached`}
          >
            {imageDrafts.map((draft) => (
              <li
                key={draft.previewUrl}
                className={imageDrafts.length === 1 ? "shrink-0" : "min-w-0 flex-1"}
              >
                <div
                  className={`overflow-hidden rounded-lg bg-bg-raised shadow-[0_0_0_1px_rgba(0,0,0,0.05)] ${
                    imageDrafts.length === 1
                      ? "size-16"
                      : `aspect-square w-full ${imageDraftPreviewMaxHeightClass(imageDrafts.length)}`
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img
                    alt=""
                    className="media-outline size-full object-cover"
                    src={draft.previewUrl}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="capture-input">
            {savingImage
              ? "Optional source URL or caption"
              : "Link, note, or image"}
          </label>
          <textarea
            ref={inputRef}
            className={`ui-field w-full rounded-input px-4 py-3 text-sm disabled:opacity-60 ${
              savingImage ? "min-h-16" : "min-h-24"
            }`}
            id="capture-input"
            placeholder={
              savingImage
                ? "Optional source URL or caption"
                : "Paste a link, note, or image"
            }
            value={state.input}
            onChange={(event) =>
              dispatch({ type: "input", text: event.target.value })
            }
            disabled={composeLocked}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <input
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
            className="sr-only"
            type="file"
            multiple
            onChange={(event) => {
              void onPickFiles(event.target.files ?? undefined);
              event.target.value = "";
            }}
          />
          <button
            className={IMAGE_ACTION_BTN}
            type="button"
            disabled={composeLocked}
            onClick={() => fileInputRef.current?.click()}
          >
            Add image
          </button>
          <button
            className={IMAGE_ACTION_BTN}
            type="button"
            disabled={composeLocked}
            onClick={() => void pasteImageFromClipboard()}
          >
            Paste image
          </button>
          {imageDrafts.length > 0 ? (
            <button
              className={IMAGE_ACTION_BTN}
              type="button"
              disabled={composeLocked}
              onClick={() => clearImageDrafts()}
            >
              Remove images
            </button>
          ) : null}
          {!savingImage ? (
            <div className="ml-auto flex gap-1">
              <button
                className={`${SHELL_TOP_BTN} h-7 px-2.5 text-xs ${
                  kind === "link" ? SHELL_TOP_BTN_ACTIVE : SHELL_TOP_BTN_IDLE
                }`}
                type="button"
                aria-pressed={kind === "link"}
                disabled={composeLocked}
                onClick={() => dispatch({ type: "override", kind: "link" })}
              >
                Link
              </button>
              <button
                className={`${SHELL_TOP_BTN} h-7 px-2.5 text-xs ${
                  kind === "note" ? SHELL_TOP_BTN_ACTIVE : SHELL_TOP_BTN_IDLE
                }`}
                type="button"
                aria-pressed={kind === "note"}
                disabled={composeLocked}
                onClick={() => dispatch({ type: "override", kind: "note" })}
              >
                Note
              </button>
            </div>
          ) : (
            <p className="ml-auto text-xs text-text-secondary">
              {imageDrafts.length > 1
                ? "One item, several photos"
                : "Saving as image"}
            </p>
          )}
        </div>
        <CaptureOrgPanel
          tagNames={draftTagNames}
          tagInput={tagInput}
          collectionName={draftCollectionName}
          collectionInput={collectionInput}
          tagSuggestions={tagSuggestions}
          collectionSuggestions={collectionSuggestions}
          disabled={orgLocked || linkConflict !== null}
          onTagInputChange={setTagInput}
          onAddTag={addDraftTag}
          onRemoveTag={(name) =>
            setDraftTagNames((current) =>
              current.filter((entry) => entry !== name),
            )
          }
          onCollectionInputChange={setCollectionInput}
          onSetCollection={(name) => {
            const next = captureOrgDrafts([], name);
            setDraftCollectionName(next.collectionName);
          }}
          onClearCollection={() => setDraftCollectionName(null)}
        />
        {state.error ? (
          <p className="text-sm text-text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        </div>
        <div
          className="flex shrink-0 items-center gap-3 border-t border-border-control bg-bg-canvas px-7 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
          data-testid="capture-footer"
        >
          <button
            className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_ACTIVE} px-4 disabled:opacity-60`}
            type="submit"
            disabled={
              state.status === "saving" ||
              state.status === "reading" ||
              state.status === "saved"
            }
          >
            {state.status === "saving" ? "Saving…" : "Save"}
          </button>
          <button
            className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} px-4 disabled:opacity-60`}
            type="button"
            disabled={shouldBlockDialogDismiss(state.status)}
            onClick={() => {
              resetSession();
              dispatch({ type: "dismiss" });
            }}
          >
            Cancel
          </button>
          {state.status === "saved" ? (
            <p className="text-xs text-text-secondary">Saved.</p>
          ) : (
            <p className="ml-auto text-xs text-text-secondary">⌘Enter to save</p>
          )}
        </div>
      </form>
      <CaptureLinkConflictDialog
        conflict={linkConflict}
        busy={state.status === "saving"}
        onConfirm={(choice) => void confirmLinkConflict(choice)}
        onCancel={cancelLinkConflict}
      />
    </SideDrawer>
    </>
  );
}
