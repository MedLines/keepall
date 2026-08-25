"use client";

import { type ClipboardEvent, type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import {
  captureReducer,
  initialCaptureState,
  shouldBlockDialogDismiss,
} from "@/domain/capture";
import { classifyCapture, resolveCapture } from "@/domain/classify";
import {
  ImageValidationError,
  textFieldsFromAccompanyingText,
} from "@/domain/image";
import { LinkValidationError } from "@/domain/link";
import { NoteValidationError } from "@/domain/note";
import { createImage, createLink, createNote } from "@/persistence/items";
import { enrichLinkPreview } from "./enrich-link-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { readClipboardImageAndText } from "./read-clipboard-capture";

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

export function CaptureHost() {
  const [state, dispatch] = useReducer(captureReducer, initialCaptureState);
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveInFlightRef = useRef(false);
  const isActive = state.status !== "idle";
  const classified = classifyCapture(state.input).type;
  const kind = state.override ?? classified;
  const savingImage = imageDrafts.length > 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isCaptureOpenShortcut(event)) {
        event.preventDefault();
        dispatch({ type: "open" });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      clearImageDrafts();
      dispatch({ type: "dismiss" });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [state.status]);

  useEffect(() => {
    return () => {
      revokeImageDraftPreviews(imageDrafts);
    };
  }, [imageDrafts]);

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
    if (state.status === "saving" || state.status === "reading") {
      return;
    }
    try {
      const { image, text } = await readClipboardImageAndText();
      if (image) {
        await setDraftFromBlob(image, text || state.input, state.status);
      }
    } catch {
      // Clipboard denied or empty — no-op.
    }
  }

  async function onPaste(event: ClipboardEvent<HTMLFormElement>) {
    if (state.status === "saving" || state.status === "reading") {
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

    if (imageDrafts.length > 0) {
      if (captureReducer(state, { type: "save" }).status !== "saving") {
        return;
      }
      saveInFlightRef.current = true;
      dispatch({ type: "save" });
      try {
        const fields = textFieldsFromAccompanyingText(state.input);
        await createImage({
          assets: imageDrafts.map((draft) => ({
            bytes: draft.bytes,
            mimeType: draft.mimeType,
          })),
          sourceUrl: fields.sourceUrl || undefined,
          caption: fields.caption || undefined,
        });
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        dispatch({ type: "saved" });
      } catch (caught) {
        if (caught instanceof ImageValidationError) {
          dispatch({ type: "failed", message: caught.message });
        } else {
          dispatch({ type: "failed", message: "Couldn't save. Try again." });
        }
      } finally {
        saveInFlightRef.current = false;
      }
      return;
    }

    const resolved = resolveCapture(state.input, state.override);

    if (!resolved.ok) {
      dispatch({ type: "failed", message: resolved.error });
      return;
    }

    if (captureReducer(state, { type: "save" }).status !== "saving") {
      return;
    }

    saveInFlightRef.current = true;
    dispatch({ type: "save" });

    try {
      if (resolved.classification.type === "link") {
        const link = await createLink({
          url: resolved.classification.url,
        });
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        dispatch({ type: "saved" });
        void enrichLinkPreview(link.id, link.url);
        return;
      }

      await createNote({ content: resolved.classification.content });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      dispatch({ type: "saved" });
    } catch (caught) {
      if (
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

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-lg"
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
        clearImageDrafts();
        dispatch({ type: "dismiss" });
      }}
    >
      <h2 className="text-lg font-semibold" id="capture-title">
        Save to Keepall
      </h2>
      <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit} onPaste={onPaste}>
        {imageDrafts.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img
              alt=""
              className="max-h-48 w-full object-contain"
              src={imageDrafts[0]!.previewUrl}
            />
            {imageDrafts.length > 1 ? (
              <p className="border-t border-zinc-200 px-3 py-2 text-center text-sm text-zinc-600">
                {imageDrafts.length} images selected
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="capture-input">
            {savingImage
              ? "Optional source URL or caption"
              : "Link or note"}
          </label>
          <textarea
            ref={inputRef}
            className="min-h-28 rounded-md border border-zinc-300 bg-white px-3 py-2"
            id="capture-input"
            value={state.input}
            onChange={(event) =>
              dispatch({ type: "input", text: event.target.value })
            }
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={state.status === "saving" || state.status === "reading"}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium disabled:opacity-60"
            type="button"
            disabled={state.status === "saving" || state.status === "reading"}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose images…
          </button>
          <button
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium disabled:opacity-60"
            type="button"
            disabled={state.status === "saving" || state.status === "reading"}
            onClick={() => void pasteImageFromClipboard()}
          >
            Paste image
          </button>
          {imageDrafts.length > 0 ? (
            <button
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium disabled:opacity-60"
              type="button"
              disabled={state.status === "saving"}
              onClick={() => clearImageDrafts()}
            >
              Remove images
            </button>
          ) : null}
        </div>
        {!savingImage ? (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 w-full text-sm font-medium">Save as</legend>
            <button
              className={`rounded-md border px-3 py-1 text-sm ${
                kind === "link"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white"
              }`}
              type="button"
              aria-pressed={kind === "link"}
              onClick={() => dispatch({ type: "override", kind: "link" })}
            >
              Link
            </button>
            <button
              className={`rounded-md border px-3 py-1 text-sm ${
                kind === "note"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white"
              }`}
              type="button"
              aria-pressed={kind === "note"}
              onClick={() => dispatch({ type: "override", kind: "note" })}
            >
              Note
            </button>
          </fieldset>
        ) : (
          <p className="text-sm text-zinc-600">
            {imageDrafts.length > 1
              ? "Saving as one image item with multiple photos."
              : "Saving as image."}
          </p>
        )}
        <p className="text-sm text-zinc-600">Ctrl+Enter or ⌘Enter to save.</p>
        <div className="flex items-center gap-3">
          <button
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
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
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-60"
            type="button"
            disabled={shouldBlockDialogDismiss(state.status)}
            onClick={() => {
              clearImageDrafts();
              dispatch({ type: "dismiss" });
            }}
          >
            Cancel
          </button>
          {state.status === "saved" ? (
            <p className="text-sm text-zinc-700">Saved.</p>
          ) : null}
          {state.error ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
        </div>
      </form>
    </dialog>
  );
}
