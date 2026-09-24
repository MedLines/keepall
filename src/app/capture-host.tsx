"use client";

import { type ClipboardEvent, type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
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
  assertLocalImageBytes,
  assertLocalImageFile,
  ImageValidationError,
  isAllowedLocalImageMime,
  textFieldsFromAccompanyingText,
} from "@/domain/image";
import { LinkValidationError } from "@/domain/link";
import { NoteValidationError } from "@/domain/note";
import { VideoValidationError } from "@/domain/video";
import { createVideo } from "@/persistence/videos";
import { prepareLocalVideo } from "./prepare-local-video";
import { applyItemOrg } from "@/persistence/apply-item-org";
import {
  clearCollectionOnItem,
  createNote,
  createOrReuseImage,
  createOrReuseLink,
  updateLink,
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
import { NoteContent } from "./note-content";


const IMAGE_ACTION_BTN = `${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} order-last h-8 px-3 text-xs disabled:opacity-60`;
const CAPTURE_PREVIEW_CLASS = "ui-scrollbar max-h-36 overflow-y-auto overscroll-contain rounded-input border border-border-control bg-bg-control p-4";

function CaptureMarkdownToggle({ checked, disabled, onChange }: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ui-control flex min-h-8 items-center gap-1.5 px-2 text-xs text-text-secondary">
      <span className="relative size-4 shrink-0">
        <input
          type="checkbox"
          className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className={`pointer-events-none absolute inset-0 grid place-items-center rounded-[5px] border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-border-focus ${checked ? "border-action-primary bg-action-primary text-text-on-action" : "border-text-secondary"}`} aria-hidden="true">
          {checked ? <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={1.5} /> : null}
        </span>
      </span>
      Markdown
    </label>
  );
}

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

function imageSelectionError(error: unknown, file: File | null): string {
  if (file && !isAllowedLocalImageMime(file.type)) {
    const formats = "Choose PNG, JPEG, GIF, WebP, or AVIF images.";
    return file.type.startsWith("video/")
      ? `Videos can't be added here. ${formats}`
      : `This file type can't be added here. ${formats}`;
  }
  return error instanceof ImageValidationError
    ? error.message
    : "Couldn't read the selected image. Try again.";
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
  const [videoDraft, setVideoDraft] = useState<{ file: File; poster: Blob | null } | null>(null);
  const [videoPreparing, setVideoPreparing] = useState(false);
  const imageDraftsRef = useRef<ImageDraft[]>([]);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageUploadErrorRef = useRef<string | null>(null);
  const imageUploadInFlightRef = useRef(false);
  const [imageUpload, setImageUpload] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const imageReadGenerationRef = useRef(0);
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
  const [noteFormat, setNoteFormat] = useState<"plain" | "markdown">("plain");
  const [previewKind, setPreviewKind] = useState<"link" | "note" | "image" | "video" | null>(null);
  const [linkNoteDraft, setLinkNoteDraft] = useState("");
  const [videoNoteDraft, setVideoNoteDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const saveInFlightRef = useRef(false);
  const savedItemIdRef = useRef<string | null>(null);
  const isActive = state.status !== "idle";
  const classified = classifyCapture(state.input).type;
  const kind = state.override ?? classified;
  const savingImage = imageDrafts.length > 0;
  const composeLocked =
    state.status === "saving" ||
    state.status === "reading" ||
    savedItemId !== null ||
    imageUpload !== null || videoPreparing;
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
    imageDraftsRef.current = imageDrafts;
  }, [imageDrafts]);

  useEffect(() => {
    return () => revokeImageDraftPreviews(imageDraftsRef.current);
  }, []);

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

  function setCaptureMarkdown(checked: boolean) {
    setNoteFormat(checked ? "markdown" : "plain");
    if (!checked) setPreviewKind(null);
  }

  function resetSession() {
    savedItemIdRef.current = null;
    setSavedItemId(null);
    setLinkConflict(null);
    setDraftTagNames([]);
    setTagInput("");
    setDraftCollectionName(null);
    setCollectionInput("");
    imageReadGenerationRef.current += 1;
    imageUploadInFlightRef.current = false;
    imageUploadErrorRef.current = null;
    setImageUpload(null);
    setImageUploadError(null);
    setNoteFormat("plain");
    setPreviewKind(null);
    setLinkNoteDraft("");
    setVideoNoteDraft("");
    clearImageDrafts();
    setVideoDraft(null);
    setVideoPreparing(false);
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
    if (files.length === 0 || imageUploadInFlightRef.current || videoDraft) {
      return;
    }

    const generation = imageReadGenerationRef.current;
    let currentFile: File | null = null;
    imageUploadInFlightRef.current = true;
    imageUploadErrorRef.current = null;
    setImageUploadError(null);
    setImageUpload({ completed: 0, total: files.length });
    try {
      const prepared: { file: File; bytes: Uint8Array; mimeType: string }[] = [];
      for (const [index, file] of files.entries()) {
        currentFile = file;
        assertLocalImageFile(file);
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (generation !== imageReadGenerationRef.current) return;
        const mimeType = assertLocalImageBytes(bytes, file.type);
        prepared.push({ file, bytes, mimeType });
        setImageUpload({ completed: index + 1, total: files.length });
      }

      const drafts: ImageDraft[] = [];
      try {
        for (const { file, bytes, mimeType } of prepared) {
          drafts.push({ bytes, mimeType, previewUrl: URL.createObjectURL(file) });
        }
      } catch (caught) {
        revokeImageDraftPreviews(drafts);
        throw caught;
      }
      if (generation !== imageReadGenerationRef.current) {
        revokeImageDraftPreviews(drafts);
        return;
      }
      setImageDrafts((previous) => [...previous, ...drafts]);
      dispatchDraftText(accompanyingText, status);
    } catch (caught) {
      if (generation !== imageReadGenerationRef.current) return;
      const message = imageSelectionError(caught, currentFile);
      imageUploadErrorRef.current = message;
      setImageUploadError(message);
      if (status === "reading") {
        dispatch({ type: "clipboardUnavailable" });
      }
    } finally {
      if (generation === imageReadGenerationRef.current) {
        imageUploadInFlightRef.current = false;
        setImageUpload(null);
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

  async function onPickVideo(file: File | undefined) {
    if (!file || imageDrafts.length > 0 || videoDraft || imageUploadInFlightRef.current) return;
    setVideoPreparing(true);
    try {
      const poster = await prepareLocalVideo(file);
      setVideoDraft({ file, poster });
      dispatch({ type: "input", text: "" });
    } catch (error) {
      dispatch({ type: "failed", message: error instanceof VideoValidationError ? error.message : "Couldn't add video." });
    } finally {
      setVideoPreparing(false);
    }
  }

  async function pasteImageFromClipboard() {
    if (composeLocked || videoDraft) {
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
      if (videoDraft) return;
      await setDraftFromBlob(file, state.input, state.status);
      return;
    }
  }

  async function persistCapture(options?: {
    conflictChoice?: CaptureLinkConflictChoice;
  }) {
    if (
      saveInFlightRef.current ||
      imageUploadInFlightRef.current ||
      imageUploadErrorRef.current
    ) {
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

    try {
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
      } else if (!savedItemIdRef.current && imageDrafts.length === 0 && !videoDraft) {
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
            if (linkNoteDraft.trim() && existing.noteContent?.trim() && existing.noteContent.trim() !== linkNoteDraft.trim()) {
              dispatch({ type: "failed", message: "This link already has a personal note. Edit that note from the library." });
              return;
            }
            const ok = await resolveExistingOrgConflict(existing);
            if (!ok) {
              return;
            }
          }
        }
      }
    } catch (caught) {
      dispatch({
        type: "failed",
        message: caught instanceof ImageValidationError
          ? caught.message
          : "Couldn't check for an existing item. Try again.",
      });
      return;
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
        if (videoDraft) {
          const video = await createVideo(videoDraft.file, videoDraft.poster, state.input, { content: videoNoteDraft, format: noteFormat });
          itemId = video.id;
        } else if (imageDrafts.length > 0) {
          const fields = textFieldsFromAccompanyingText(state.input);
          const { image } = await createOrReuseImage({
            assets: imageDrafts.map((draft) => ({
              bytes: draft.bytes,
              mimeType: draft.mimeType,
            })),
            sourceUrl: fields.sourceUrl || undefined,
            caption: fields.caption || undefined,
            ...(fields.caption && noteFormat === "markdown" ? { captionFormat: "markdown" as const } : {}),
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
              ...(linkNoteDraft.trim() ? { noteContent: linkNoteDraft.trim() } : {}),
              ...(linkNoteDraft.trim() && noteFormat === "markdown" ? { noteFormat: "markdown" as const } : {}),
            });
            itemId = link.id;
            if (!created && linkNoteDraft.trim() && !link.noteContent?.trim()) {
              await updateLink(link.id, {
                url: link.url,
                noteContent: linkNoteDraft,
                noteFormat,
              });
            }
            if (created) {
              void enrichLinkPreview(link.id, link.url);
            }
          } else {
            const note = await createNote({
              content: resolved.classification.content,
              ...(noteFormat === "markdown" ? { format: "markdown" as const } : {}),
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

      if (caught instanceof ImageValidationError || caught instanceof VideoValidationError) {
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
      description="Paste a link, write a note, or add images or video."
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
          className="scroll-fade flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-6 pb-5 pt-3 [scrollbar-gutter:stable]"
          data-testid="capture-scroll-region"
        >
        {videoDraft ? (
          <p className="rounded-input border border-border-control bg-bg-raised px-3 py-2 text-sm text-text-primary">Video: {videoDraft.file.name}</p>
        ) : null}
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
        {imageUploadError ? (
          <div className="flex items-start justify-between gap-3 rounded-input border border-border-control bg-bg-raised px-3 py-2" role="alert">
            <div>
              <p className="text-sm font-medium text-text-danger">{imageUploadError}</p>
              <p className="mt-1 text-xs text-text-secondary">No images from this selection were added.</p>
            </div>
            <button
              className="ui-control shrink-0 px-2 py-1 text-xs"
              type="button"
              onClick={() => {
                imageUploadErrorRef.current = null;
                setImageUploadError(null);
              }}
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {imageUpload ? (
          <p
            className="flex items-center gap-2 text-sm text-text-secondary"
            role="status"
            aria-live="polite"
          >
            <span
              className="size-3 animate-spin rounded-full border-2 border-border-control border-t-action-primary"
              aria-hidden="true"
            />
            Adding images… {imageUpload.completed} of {imageUpload.total}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {kind === "link" && !savingImage && !videoDraft ? <span className="text-sm font-medium text-text-secondary">Link URL</span> : null}
          <label className="sr-only" htmlFor="capture-input">
            {videoDraft ? "Video title" : savingImage
              ? "Optional source URL or caption"
              : "Link, note, or image"}
          </label>
          <textarea
            ref={inputRef}
            className={`ui-field w-full rounded-input px-4 py-3 text-sm disabled:opacity-60 ${
              videoDraft ? "min-h-11" : savingImage ? "min-h-16" : kind === "link" ? "min-h-11" : "min-h-24"
            }`}
            id="capture-input"
            placeholder={
              videoDraft ? "Optional video title" : savingImage
                ? "Optional source URL or caption"
                : kind === "link" ? "https://example.com/page" : "Paste a link, note, or image"
            }
            value={state.input}
            onChange={(event) =>
              dispatch({ type: "input", text: event.target.value })
            }
            disabled={composeLocked}
          />
        </div>
        {kind === "note" && !savingImage && !videoDraft ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CaptureMarkdownToggle checked={noteFormat === "markdown"} disabled={composeLocked} onChange={setCaptureMarkdown} />
              <button type="button" aria-pressed={previewKind === "note"} aria-hidden={noteFormat !== "markdown"} className={`ui-control min-h-9 px-3 text-xs font-medium ${noteFormat === "markdown" ? "" : "invisible"}`} disabled={noteFormat !== "markdown"} onClick={() => setPreviewKind((current) => current === "note" ? null : "note")}>
                {previewKind === "note" ? "Hide preview" : "Preview"}
              </button>
            </div>
            {noteFormat === "markdown" && previewKind === "note" ? (
              <div aria-label="Markdown preview" className={CAPTURE_PREVIEW_CLASS}>
                <NoteContent content={state.input} format="markdown" />
              </div>
            ) : null}
          </div>
        ) : null}
        {savingImage && textFieldsFromAccompanyingText(state.input).caption ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CaptureMarkdownToggle checked={noteFormat === "markdown"} disabled={composeLocked} onChange={setCaptureMarkdown} />
              <button type="button" aria-pressed={previewKind === "image"} aria-hidden={noteFormat !== "markdown"} className={`ui-control min-h-9 px-3 text-xs font-medium ${noteFormat === "markdown" ? "" : "invisible"}`} disabled={noteFormat !== "markdown"} onClick={() => setPreviewKind((current) => current === "image" ? null : "image")}>
                {previewKind === "image" ? "Hide preview" : "Preview"}
              </button>
            </div>
            {noteFormat === "markdown" && previewKind === "image" ? (
              <section aria-label="Image note preview" className={CAPTURE_PREVIEW_CLASS}>
                <NoteContent content={state.input} format="markdown" />
              </section>
            ) : null}
          </div>
        ) : null}
        {videoDraft ? (
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-text-primary" htmlFor="capture-video-note">Notes (optional)</label>
            <textarea id="capture-video-note" className="ui-field min-h-28 resize-y px-3 py-2 text-sm" placeholder="Add a note about this video" value={videoNoteDraft} disabled={composeLocked} onChange={(event) => setVideoNoteDraft(event.target.value)} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CaptureMarkdownToggle checked={noteFormat === "markdown"} disabled={composeLocked} onChange={setCaptureMarkdown} />
              {noteFormat === "markdown" ? <button type="button" aria-pressed={previewKind === "video"} className="ui-control min-h-9 px-3 text-xs font-medium" disabled={!videoNoteDraft.trim()} onClick={() => setPreviewKind((current) => current === "video" ? null : "video")}>{previewKind === "video" ? "Hide preview" : "Preview"}</button> : null}
            </div>
            {noteFormat === "markdown" && previewKind === "video" && videoNoteDraft.trim() ? <section aria-label="Video note preview" className={CAPTURE_PREVIEW_CLASS}><NoteContent content={videoNoteDraft} format="markdown" /></section> : null}
          </div>
        ) : null}
        {kind === "link" && !savingImage && !videoDraft ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {previewKind === "link" ? (
                <span className="text-sm font-medium text-text-primary">Your note (optional)</span>
              ) : (
                <label className="text-sm font-medium text-text-primary" htmlFor="capture-link-note">Your note (optional)</label>
              )}
              <div className="ml-auto flex items-center gap-2">
                <CaptureMarkdownToggle checked={noteFormat === "markdown"} disabled={composeLocked} onChange={setCaptureMarkdown} />
                <button type="button" aria-pressed={previewKind === "link"} aria-hidden={noteFormat !== "markdown"} className={`ui-control min-h-8 px-2 text-xs font-medium disabled:opacity-50 ${noteFormat === "markdown" ? "" : "invisible"}`} disabled={noteFormat !== "markdown" || !linkNoteDraft.trim()} onClick={() => setPreviewKind((current) => current === "link" ? null : "link")}>
                  {previewKind === "link" ? "Hide preview" : "Preview"}
                </button>
              </div>
            </div>
            {noteFormat === "markdown" && linkNoteDraft.trim() && previewKind === "link" ? (
              <section aria-label="Personal note preview" className={`${CAPTURE_PREVIEW_CLASS} h-28`}>
                <NoteContent content={linkNoteDraft} format="markdown" />
              </section>
            ) : (
              <textarea id="capture-link-note" className="ui-field min-h-28 resize-y px-3 py-2 text-sm" placeholder="Why are you saving this link?" value={linkNoteDraft} disabled={composeLocked} onChange={(event) => {
                setLinkNoteDraft(event.target.value);
                if (!event.target.value.trim()) setPreviewKind(null);
              }} />
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <input
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
            className="sr-only"
            type="file"
            disabled={Boolean(videoDraft)}
            multiple
            onChange={(event) => {
              void onPickFiles(event.target.files ?? undefined);
              event.target.value = "";
            }}
          />
          {!videoDraft ? <button
            className={IMAGE_ACTION_BTN}
            type="button"
            disabled={composeLocked}
            onClick={() => fileInputRef.current?.click()}
          >
            Add image
          </button> : null}
          <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" className="sr-only" disabled={savingImage || Boolean(videoDraft)} onChange={(event) => {
            void onPickVideo(event.target.files?.[0]);
            event.target.value = "";
          }} />
          {!savingImage && !videoDraft ? <button className={IMAGE_ACTION_BTN} type="button" disabled={composeLocked} onClick={() => videoInputRef.current?.click()}>
            Add video
          </button> : null}
          {!videoDraft ? <button
            className={IMAGE_ACTION_BTN}
            type="button"
            disabled={composeLocked}
            onClick={() => void pasteImageFromClipboard()}
          >
            Paste image
          </button> : null}
          {videoDraft ? (
            <button className={IMAGE_ACTION_BTN} type="button" disabled={composeLocked} onClick={() => setVideoDraft(null)}>Remove video</button>
          ) : null}
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
          {!savingImage && !videoDraft ? (
            <div className="order-first mr-auto flex gap-1">
              <button
                className={`${SHELL_TOP_BTN} h-8 px-2.5 text-xs ${
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
                className={`${SHELL_TOP_BTN} h-8 px-2.5 text-xs ${
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
              {videoDraft ? "Saving as video" : imageDrafts.length > 1
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
          className="flex shrink-0 items-center gap-3 border-t border-border-control bg-bg-canvas px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
          data-testid="capture-footer"
        >
          <button
            className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_ACTIVE} px-4 disabled:opacity-60`}
            type="submit"
            disabled={
              state.status === "saving" ||
              state.status === "reading" ||
              state.status === "saved" ||
              imageUpload !== null ||
              videoPreparing ||
              imageUploadError !== null
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
            <p className="ml-auto text-xs text-text-secondary">Ctrl/⌘ Enter to save</p>
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
