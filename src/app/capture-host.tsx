"use client";

import { type ClipboardEvent, type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import {
  captureReducer,
  initialCaptureState,
  shouldBlockDialogDismiss,
} from "@/domain/capture";
import { captureOrgDrafts } from "@/domain/capture-org";
import { classifyCapture, resolveCapture } from "@/domain/classify";
import {
  ImageValidationError,
  textFieldsFromAccompanyingText,
} from "@/domain/image";
import { LinkValidationError } from "@/domain/link";
import { NoteValidationError } from "@/domain/note";
import { applyItemOrg } from "@/persistence/apply-item-org";
import { listCollections } from "@/persistence/collections";
import { createImage, createLink, createNote } from "@/persistence/items";
import { listTags } from "@/persistence/tags";
import { CaptureOrgPanel } from "./capture-org-panel";
import { enrichLinkPreview } from "./enrich-link-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { OPEN_CAPTURE_EVENT } from "./capture-events";
import type { OrgNameSuggestion } from "./org-name-suggest";
import { readClipboardImageAndText } from "./read-clipboard-capture";
import { SHELL_TOP_BTN, SHELL_TOP_BTN_ACTIVE, SHELL_TOP_BTN_IDLE } from "./shell-styles";

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

const GHOST_BTN =
  "text-sm text-zinc-600 transition-colors duration-150 hover:text-zinc-900 disabled:opacity-60";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    function onKeyDown(event: KeyboardEvent) {
      if (isCaptureOpenShortcut(event)) {
        event.preventDefault();
        dispatch({ type: "open" });
      }
    }

    function onOpenCapture() {
      dispatch({ type: "open" });
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_CAPTURE_EVENT, onOpenCapture);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_CAPTURE_EVENT, onOpenCapture);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isActive && !dialog.open) {
      dialog.showModal();
    }

    if (!isActive && dialog.open) {
      dialog.close();
    }
  }, [isActive]);

  useEffect(() => {
    if (state.status !== "reading") {
      return;
    }

    savedItemIdRef.current = null;
    setSavedItemId(null);
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

    void Promise.all([listTags(), listCollections()])
      .then(([tags, collections]) => {
        if (cancelled) {
          return;
        }
        setTagSuggestions(tags.map((tag) => ({ id: tag.id, name: tag.name })));
        setCollectionSuggestions(
          collections.map((collection) => ({
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
      setImageDrafts((previous) => {
        revokeImageDraftPreviews(previous);
        return drafts;
      });
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

  async function persistCapture() {
    if (saveInFlightRef.current) {
      return;
    }

    const org = captureOrgDrafts(
      [...draftTagNames, tagInput],
      draftCollectionName ?? collectionInput,
    );

    if (!savedItemIdRef.current && imageDrafts.length === 0) {
      const resolved = resolveCapture(state.input, state.override);
      if (!resolved.ok) {
        dispatch({ type: "failed", message: resolved.error });
        return;
      }
    }

    if (captureReducer(state, { type: "save" }).status !== "saving") {
      return;
    }

    saveInFlightRef.current = true;
    dispatch({ type: "save" });

    try {
      let itemId = savedItemIdRef.current;

      if (!itemId) {
        if (imageDrafts.length > 0) {
          const fields = textFieldsFromAccompanyingText(state.input);
          const image = await createImage({
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
            const link = await createLink({
              url: resolved.classification.url,
            });
            itemId = link.id;
            void enrichLinkPreview(link.id, link.url);
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

      if (org.tagNames.length > 0 || org.collectionName) {
        await applyItemOrg(itemId, org);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      }

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

  function addDraftTag(name: string) {
    const next = captureOrgDrafts([...draftTagNames, name], null);
    setDraftTagNames(next.tagNames);
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto h-fit max-h-[min(90dvh,40rem)] w-[min(100%-2rem,32rem)] overflow-y-auto rounded-[12px] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_16px_40px_rgba(0,0,0,0.16)] [&::backdrop]:bg-zinc-900/20 [&::backdrop]:backdrop-blur-[1px]"
      aria-labelledby="capture-title"
      onCancel={(event) => {
        if (shouldBlockDialogDismiss(state.status)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onClose={() => {
        if (shouldBlockDialogDismiss(state.status)) {
          const dialog = dialogRef.current;
          if (dialog && !dialog.open) {
            try {
              dialog.setAttribute("open", "");
            } catch {
              // ignore
            }
            try {
              dialog.open = true;
            } catch {
              // ignore
            }

            window.setTimeout(() => {
              try {
                dialog.showModal();
              } catch {
                // ignore
              }
            }, 0);
          }
          return;
        }
        resetSession();
        dispatch({ type: "dismiss" });
      }}
    >
      <h2 className="text-lg font-semibold tracking-tight" id="capture-title">
        Save to Keepall
      </h2>
      <form
        className="mt-4 flex flex-col gap-5"
        onSubmit={onSubmit}
        onPaste={onPaste}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
      >
        {imageDrafts.length > 0 ? (
          <div className="overflow-hidden rounded-[10px] bg-zinc-100 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img
              alt=""
              className="max-h-48 w-full object-contain"
              src={imageDrafts[0]!.previewUrl}
            />
            {imageDrafts.length > 1 ? (
              <p className="border-t border-zinc-200/80 px-3 py-2 text-center text-xs text-zinc-500">
                {imageDrafts.length} images selected
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="capture-input">
            {savingImage
              ? "Optional source URL or caption"
              : "Link, note, or image"}
          </label>
          <textarea
            ref={inputRef}
            className="min-h-24 w-full rounded-[10px] border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-sm outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out focus:border-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,24,27,0.08)] disabled:opacity-60"
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
            className={GHOST_BTN}
            type="button"
            disabled={composeLocked}
            onClick={() => fileInputRef.current?.click()}
          >
            Add image
          </button>
          <button
            className={GHOST_BTN}
            type="button"
            disabled={composeLocked}
            onClick={() => void pasteImageFromClipboard()}
          >
            Paste image
          </button>
          {imageDrafts.length > 0 ? (
            <button
              className={GHOST_BTN}
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
            <p className="ml-auto text-xs text-zinc-500">
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
          disabled={orgLocked}
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
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
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
            <p className="text-xs text-zinc-500">Saved.</p>
          ) : (
            <p className="ml-auto text-xs text-zinc-500">⌘Enter to save</p>
          )}
        </div>
      </form>
    </dialog>
  );
}
