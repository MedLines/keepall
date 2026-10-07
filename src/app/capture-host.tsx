"use client";

import { DEFAULT_SHORTCUTS, shortcutMatches } from "@/domain/keyboard-shortcuts";
import { useAppShortcuts } from "./use-app-shortcuts";
import { ScrollTextarea } from "@/components/ui/scroll-textarea";

import { ScrollArea } from "@/components/ui/scroll-area";

import { type ClipboardEvent, type FormEvent, useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
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
import { decodeTextDocument, documentFormat, DocumentValidationError } from "@/domain/document";
import { createDocument } from "@/persistence/documents";
import { VideoValidationError } from "@/domain/video";
import { createVideo } from "@/persistence/videos";
import { prepareLocalVideo } from "./prepare-local-video";
import { applyItemOrg } from "@/persistence/apply-item-org";
import {
  clearCollectionOnItem,
  createNote,
  createImage,
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
import { getCaptureCollectionName, OPEN_CAPTURE_EVENT } from "./capture-events";
import type { OrgNameSuggestion } from "./org-name-suggest";
import { readClipboardImageAndText } from "./read-clipboard-capture";
import { SHELL_TOP_BTN, SHELL_TOP_BTN_ACTIVE, SHELL_TOP_BTN_IDLE } from "./shell-styles";
import {
  captureCollectionConflict,
  captureTagConflict,
} from "@/domain/link";
import type { CaptureOrgDrafts } from "@/domain/capture-org";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDirtyDismissal } from "./use-dirty-dismissal";
import { NoteContent } from "./note-content";
import { NoteEditorControls } from "./note-editor-controls";
import { CloseIcon, UploadIcon, NoteIcon } from "./shell-icons";
import { BulkFileImport } from "./bulk-file-import";
import { BookmarksImport } from "./bookmarks-import";
import { importFiles, type FileImportResult } from "@/persistence/file-import";
import { CaptureImageLayout } from "./capture-image-layout";
import { CaptureFileList } from "./capture-file-list";
import { CaptureTypeMenu } from "./capture-type-menu";
import { CAPTURE_FILE_ACCEPT, classifyCaptureFile } from "@/domain/capture-file";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { DocumentText } from "./document-content";


const IMAGE_ACTION_BTN = `${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} h-8 px-3 text-xs disabled:opacity-60`;
const CAPTURE_PREVIEW_CLASS = "flex min-h-0 max-h-36 shrink-0 flex-col rounded-input border border-border-control bg-bg-control";
const FILE_PREVIEW_CLASS = "flex min-h-0 shrink-0 flex-col rounded-input border border-border-control bg-bg-control";

/** Alt+K (Windows/Linux) and Option+K (macOS). Option is altKey; code stays KeyK even when Option remaps the character. */
export function isCaptureOpenShortcut(event: KeyboardEvent): boolean {
  return shortcutMatches(event, DEFAULT_SHORTCUTS.capture);
}

type ImageDraft = {
  bytes: Uint8Array;
  mimeType: string;
  previewUrl: string;
  file: File;
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
  const [documentDraft, setDocumentDraft] = useState<{ fileName: string; bytes: Uint8Array; text: string } | null>(null);
  const [documentReading, setDocumentReading] = useState(false);
  const documentReadGenerationRef = useRef(0);
  const documentReadInFlightRef = useRef(false);
  const [folderImportBusy, setFolderImportBusy] = useState(false);
  const [bookmarksImportBusy, setBookmarksImportBusy] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const imageDraftsRef = useRef<ImageDraft[]>([]);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageUploadErrorRef = useRef<string | null>(null);
  const imageUploadInFlightRef = useRef(false);
  const [imageUpload, setImageUpload] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const imageReadGenerationRef = useRef(0);
  const videoPreparationGenerationRef = useRef(0);
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
  const [baseline, setBaseline] = useState<{ input: string; images: string[]; collection: string | null } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const clipboardTextUntouchedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileDrafts, setFileDrafts] = useState<File[] | null>(null);
  const [imageLayoutRequired, setImageLayoutRequired] = useState(false);
  const [imageLayout, setImageLayout] = useState<"gallery" | "separate" | null>(null);
  const [fileResults, setFileResults] = useState<FileImportResult[]>([]);
  const [fileProgress, setFileProgress] = useState<{ done: number; total: number } | null>(null);
  const [fileQuotaWarning, setFileQuotaWarning] = useState<string | null>(null);
  const [importSavedCount, setImportSavedCount] = useState(0);
  const saveInFlightRef = useRef(false);
  const savedItemIdRef = useRef<string | null>(null);
  const defaultCollectionNameRef = useRef<string | null>(null);
  const isActive = state.status !== "idle";
  const hasFileBatch = fileDrafts !== null;
  const classified = classifyCapture(state.input).type;
  const kind = documentDraft ? "note" : state.override ?? classified;
  const savingImage = imageDrafts.length > 0;
  const composeLocked =
    state.status === "saving" ||
    state.status === "reading" ||
    savedItemId !== null ||
    imageUpload !== null || videoPreparing || documentReading || folderImportBusy || bookmarksImportBusy || fileResults.length > 0;
  const orgLocked = state.status === "saving" || state.status === "reading" || documentReading || folderImportBusy || bookmarksImportBusy || fileResults.some((result) => result.status === "saved");
  const dismissLocked = shouldBlockDialogDismiss(state.status) || folderImportBusy || bookmarksImportBusy;

  function dismiss() {
    resetSession();
    dispatch({ type: "dismiss" });
  }
  const hasContent = Boolean(state.input.trim() || linkNoteDraft.trim() || videoNoteDraft.trim() || imageDrafts.length || videoDraft || documentDraft || hasFileBatch);
  const dirty = hasContent && baseline !== null && (
    state.input !== baseline.input || state.override !== null ||
    linkNoteDraft !== "" || videoNoteDraft !== "" || noteFormat !== "plain" ||
    tagInput !== "" || collectionInput !== "" || draftTagNames.length > 0 ||
    draftCollectionName !== baseline.collection || videoDraft !== null || documentDraft !== null || hasFileBatch ||
    JSON.stringify(imageDrafts.map((draft) => draft.previewUrl)) !== JSON.stringify(baseline.images)
  );
  const dismissal = useDirtyDismissal(dirty && state.status !== "saved", dismiss);

  function establishBaseline(input: string, images: string[] = []) {
    setBaseline({ input, images, collection: defaultCollectionNameRef.current });
  }

  function openCapture() {
      if (state.status === "reading" || state.status === "open" || state.status === "saving") return;
      defaultCollectionNameRef.current = getCaptureCollectionName();
      savedItemIdRef.current = null;
      setSavedItemId(null);
      setLinkConflict(null);
      setDraftTagNames([]);
      setTagInput("");
      setDraftCollectionName(defaultCollectionNameRef.current);
      setCollectionInput("");
      setCaptureSide(
        document.documentElement.dir === "rtl" ? "left" : "right",
      );
      dispatch({ type: "open" });
  }

  useAppShortcuts({ capture: openCapture });

  const onOpenCapture = useEffectEvent((event: Event) => {
    openCapture();
    if ((event as CustomEvent<{ bulkImport?: boolean }>).detail?.bulkImport) setBulkImportOpen(true);
  });
  useEffect(() => {
    window.addEventListener(OPEN_CAPTURE_EVENT, onOpenCapture);
    return () => window.removeEventListener(OPEN_CAPTURE_EVENT, onOpenCapture);
  }, []);

  const receiveClipboard = useEffectEvent(({ image, text }: Awaited<ReturnType<typeof readClipboardImageAndText>>) => {
    clipboardTextUntouchedRef.current = Boolean(text);
    if (image) { void setDraftFromBlob(image, text, "reading"); return; }
    establishBaseline(text);
    dispatch({ type: "clipboard", text });
  });

  useEffect(() => {
    if (state.status !== "reading") {
      return;
    }

    let cancelled = false;

    void readClipboardImageAndText()
      .then(clipboard => {
        if (cancelled) {
          return;
        }
        receiveClipboard(clipboard);
      })
      .catch(() => {
        if (!cancelled) {
          establishBaseline("");
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
    return () => {
      revokeImageDraftPreviews(imageDraftsRef.current);
      videoPreparationGenerationRef.current += 1;
      documentReadGenerationRef.current += 1;
    };
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

  function resetSession() {
    clipboardTextUntouchedRef.current = false;
    setBulkImportOpen(false);
    setFileDrafts(null);
    setImportSavedCount(0);
    setImageLayoutRequired(false);
    setImageLayout(null);
    setFileResults([]);
    setFileProgress(null);
    setFileQuotaWarning(null);
    setBaseline(null);
    savedItemIdRef.current = null;
    setSavedItemId(null);
    setLinkConflict(null);
    setDraftTagNames([]);
    setTagInput("");
    setDraftCollectionName(null);
    setCollectionInput("");
    imageReadGenerationRef.current += 1;
    videoPreparationGenerationRef.current += 1;
    documentReadGenerationRef.current += 1;
    documentReadInFlightRef.current = false;
    setDocumentDraft(null);
    setDocumentReading(false);
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
    const text = documentDraft ? accompanyingText : fields.sourceUrl || fields.caption || accompanyingText;
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
          drafts.push({ file, bytes, mimeType, previewUrl: URL.createObjectURL(file) });
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
      if (status === "reading") {
        const fields = textFieldsFromAccompanyingText(accompanyingText);
        establishBaseline(fields.sourceUrl || fields.caption || accompanyingText, drafts.map((draft) => draft.previewUrl));
      }
      dispatchDraftText(accompanyingText, status);
      return true;
    } catch (caught) {
      if (generation !== imageReadGenerationRef.current) return;
      const message = imageSelectionError(caught, currentFile);
      imageUploadErrorRef.current = message;
      setImageUploadError(message);
      if (status === "reading") {
        establishBaseline("");
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
    setImageLayoutRequired(false);
    setImageLayout(null);
    setImageDrafts((previous) => {
      revokeImageDraftPreviews(previous);
      return [];
    });
  }

  function removeImageDraft(draft: ImageDraft) {
    URL.revokeObjectURL(draft.previewUrl);
    setImageDrafts((previous) => previous.filter((entry) => entry !== draft));
    setPreviewKind(null);
    if (imageDrafts.length <= 2) { setImageLayoutRequired(false); setImageLayout(null); }
  }

  async function onPickFiles(files: FileList | File[] | undefined) {
    if (!files || files.length === 0 || composeLocked || documentReadInFlightRef.current) {
      return;
    }
    await stageFiles(Array.from(files));
  }

  async function stageFiles(files: File[], bulk = false) {
    const selected = files.map((file) => {
      const { kind, mimeType } = classifyCaptureFile(file);
      return (kind === "image" || kind === "video") && file.type !== mimeType
        ? new File([file], file.name, { type: mimeType }) : file;
    });
    if (!selected.length) return;
    if (selected.every((file) => classifyCaptureFile(file).kind === "image") && !videoDraft && !hasFileBatch) {
      const added = await setDraftFromFiles(selected, state.input, state.status);
      if (added && (selected.length > 1 || imageDrafts.length > 0)) {
        if (!imageLayoutRequired) setImageLayout(null);
        setImageLayoutRequired(true);
      }
    } else if (!bulk && selected.length === 1 && classifyCaptureFile(selected[0]).kind === "document" && !/\.pdf$/i.test(selected[0].name) && !videoDraft && !hasFileBatch) {
      await addTextFile(selected[0]);
    } else if (!bulk && selected.length === 1 && classifyCaptureFile(selected[0]).kind === "video" && !savingImage && !videoDraft && !hasFileBatch) {
      await onPickVideo(selected[0]);
    } else {
      setFileDrafts((previous) => [...(previous ?? []), ...selected]);
      setFileResults([]);
    }
  }

  async function addTextFile(file: File) {
    const generation = ++documentReadGenerationRef.current;
    documentReadInFlightRef.current = true;
    setDocumentReading(true);
    try {
      const format = documentFormat(file.name, file.size);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (generation !== documentReadGenerationRef.current) return;
      documentFormat(file.name, bytes.byteLength);
      const text = decodeTextDocument(bytes);
      const existingText = clipboardTextUntouchedRef.current ? "" : state.input;
      const combined = [existingText, linkNoteDraft, text].filter((part) => part.length > 0).join("\n\n");
      setDocumentDraft(documentDraft ?? { fileName: file.name, bytes, text });
      clipboardTextUntouchedRef.current = false;
      setNoteFormat(noteFormat === "markdown" || format === "markdown" ? "markdown" : "plain");
      setPreviewKind(null);
      setLinkNoteDraft("");
      dispatch({ type: "input", text: combined });
    } catch (error) {
      if (generation === documentReadGenerationRef.current) {
        dispatch({ type: "failed", message: error instanceof DocumentValidationError ? error.message : "Couldn't read this file. Try again." });
      }
    } finally {
      if (generation === documentReadGenerationRef.current) {
        documentReadInFlightRef.current = false;
        setDocumentReading(false);
      }
    }
  }

  async function onPickVideo(file: File | undefined) {
    if (!file || imageDrafts.length > 0 || videoDraft || imageUploadInFlightRef.current) return;
    const generation = ++videoPreparationGenerationRef.current;
    setVideoPreparing(true);
    try {
      const poster = await prepareLocalVideo(file);
      if (generation !== videoPreparationGenerationRef.current) return;
      setVideoDraft({ file, poster });
      if (documentDraft) setVideoNoteDraft(state.input);
      dispatch({ type: "input", text: "" });
    } catch (error) {
      if (generation !== videoPreparationGenerationRef.current) return;
      dispatch({ type: "failed", message: error instanceof VideoValidationError ? error.message : "Couldn't add video." });
    } finally {
      if (generation === videoPreparationGenerationRef.current) {
        setVideoPreparing(false);
      }
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

  async function saveSeparateFiles(files: File[], org: CaptureOrgDrafts) {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    dispatch({ type: "save" });
    const previous = fileResults;
    const indexes = files.map((_, index) => index).filter((index) => previous[index]?.status !== "saved");
    const pending = indexes.map((index) => files[index]);
    const completed = [...previous];
    setFileProgress({ done: 0, total: pending.length });
    try {
      const summary = await importFiles(pending, {
        prepareVideo: prepareLocalVideo, collectionName: org.collectionName ?? undefined, tagNames: org.tagNames,
        onProgress: (done, result) => {
          completed[indexes[done - 1]] = result;
          if (done % 8 === 0 || done === pending.length) { setFileProgress({ done, total: pending.length }); setFileResults([...completed]); }
        },
      });
      summary.results.forEach((result, index) => { completed[indexes[index]] = result; });
      setFileResults(completed);
      const saved = completed.filter((result) => result.status === "saved").length;
      const failed = completed.length - saved;
      if (saved) window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      if (failed) dispatch({ type: "failed", message: `${saved} saved, ${failed} failed. Retry saves only the failed files.` });
      else {
        const keepDraft = Boolean(imageDrafts.length && hasFileBatch || videoDraft || documentDraft || state.input.trim() && !clipboardTextUntouchedRef.current);
        setFileDrafts(null);
        setFileResults([]);
        setFileQuotaWarning(null);
        if (!hasFileBatch) clearImageDrafts();
        if (keepDraft) { setImportSavedCount(saved); dispatch({ type: "batchSaved" }); }
        else dispatch({ type: "saved" });
      }
    } catch {
      if (completed.some((result) => result?.status === "saved")) window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      setFileResults(files.map((file, index) => completed[index] ?? { fileName: file.name, status: "failed", error: "Import stopped. Retry this file." }));
      dispatch({ type: "failed", message: "Import stopped. Retry saves only the failed files." });
    } finally { saveInFlightRef.current = false; setFileProgress(null); }
  }

  async function persistCapture(options?: {
    conflictChoice?: CaptureLinkConflictChoice;
  }) {
    if (
      saveInFlightRef.current ||
      folderImportBusy ||
      bookmarksImportBusy ||
      videoPreparing ||
      documentReadInFlightRef.current ||
      imageUploadInFlightRef.current ||
      imageUploadErrorRef.current
    ) {
      return;
    }

    const org = captureOrgDrafts(
      [...draftTagNames, tagInput],
      draftCollectionName ?? collectionInput,
    );
    if (imageLayoutRequired && !hasFileBatch && !imageLayout) return;
    if (hasFileBatch || imageLayoutRequired && imageLayout === "separate") {
      await saveSeparateFiles(fileDrafts ?? imageDrafts.map((draft) => draft.file), org);
      return;
    }
    const atomicGallery = savingImage && imageLayoutRequired && imageLayout === "gallery";
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
      if (!savedItemIdRef.current && imageDrafts.length > 0 && !documentDraft && !atomicGallery) {
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
      } else if (!savedItemIdRef.current && imageDrafts.length === 0 && !videoDraft && !documentDraft) {
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
          const fields = documentDraft ? { sourceUrl: "", caption: state.input } : textFieldsFromAccompanyingText(state.input);
          const input = {
            ...(documentDraft ? { sourceFileName: documentDraft.fileName } : {}),
            assets: imageDrafts.map((draft) => ({
              bytes: draft.bytes,
              mimeType: draft.mimeType,
            })),
            sourceUrl: fields.sourceUrl || undefined,
            caption: fields.caption || undefined,
            ...(fields.caption && noteFormat === "markdown" ? { captionFormat: "markdown" as const } : {}),
          };
          // A file's text belongs to this item, even if its images were saved before.
          const image = atomicGallery ? await createImage({ ...input, collectionName: org.collectionName ?? undefined, tagNames: org.tagNames }) : documentDraft ? await createImage(input) : (await createOrReuseImage(input)).image;
          itemId = image.id;
        } else if (documentDraft) {
          const format = noteFormat === "markdown" ? "markdown" : "text";
          const fileName = documentFormat(documentDraft.fileName, 0) === format ? documentDraft.fileName : documentDraft.fileName.replace(/\.(txt|md)$/i, format === "markdown" ? ".md" : ".txt");
          const bytes = state.input === documentDraft.text ? documentDraft.bytes : new TextEncoder().encode(state.input);
          itemId = (await createDocument({ fileName, bytes })).id;
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
            const content = state.override === "note" && classified === "link" && linkNoteDraft.trim()
              ? `${resolved.classification.content}\n\n${linkNoteDraft.trim()}`
              : resolved.classification.content;
            const note = await createNote({
              content,
              ...(noteFormat === "markdown" ? { format: "markdown" as const } : {}),
            });
            itemId = note.id;
          }
        }

        rememberSavedItem(itemId);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      }

      if (!atomicGallery) await applyCaptureOrg(itemId, org, { collectionChoice, tagChoice });
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

      if (caught instanceof ImageValidationError || caught instanceof VideoValidationError || caught instanceof DocumentValidationError) {
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
    setTagInput("");
  }

  return (
    <>
    <SideDrawer
      open={isActive}
      side={captureSide}
      initialFocus={() => inputRef.current?.disabled ? inputRef.current.closest<HTMLElement>('[role="dialog"]') : inputRef.current}
      title="Save to Keepall"
      description="Paste a link, write a note, or add files."
      widthClassName="w-[min(30rem,100vw)]"
      closeDisabled={dismissLocked}
      onOpenChange={(open, eventDetails) => {
        if (open) {
          return;
        }
        if (dismissLocked) {
          eventDetails.cancel();
          return;
        }
        dismissal.requestDismiss(eventDetails);
      }}
    >
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onFocusCapture={dismissal.rememberFocus}
        onSubmit={onSubmit}
        onPaste={onPaste}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("[role=dialog]") !== event.currentTarget.closest("[role=dialog]")) return;
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
      >
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade overscroll-contain"
          data-testid="capture-scroll-region"
        >
        <div className="flex flex-col gap-4 px-6 pb-5 pt-3">
        {documentReading ? <p role="status" className="text-sm text-text-secondary">Reading text file…</p> : null}
        {importSavedCount > 0 ? <p role="status" className="text-sm text-text-secondary">{importSavedCount} files saved. Your draft is still here.</p> : null}
        {documentDraft ? <div className="flex items-start gap-3 rounded-input border border-border-control bg-bg-raised p-3">
          <NoteIcon className="mt-0.5 shrink-0 text-text-secondary" />
          <div className="min-w-0 text-sm">
            <p className="break-all font-medium">{documentDraft.fileName.replace(/\.(txt|md)$/i, noteFormat === "markdown" ? ".md" : ".txt")}</p>
            <p className="mt-1 text-xs text-text-secondary">{savingImage ? "Images and text save as one item." : videoDraft ? "Video and text save as one item." : "Edit the text below, then Save."}</p>
          </div>
        </div> : null}
        {videoDraft ? (
          <p className="rounded-input border border-border-control bg-bg-raised px-3 py-2 text-sm text-text-primary">Video: {videoDraft.file.name}</p>
        ) : null}
        {imageDrafts.length > 0 ? (
          <div className="flex flex-col items-start gap-2">
            <ul
              className="flex w-full flex-wrap gap-2"
              aria-label={`${imageDrafts.length} image${imageDrafts.length === 1 ? "" : "s"} attached`}
            >
              {imageDrafts.map((draft, index) => (
                <li
                  key={draft.previewUrl}
                  className="shrink-0"
                >
                  <div
                    className="relative size-16 overflow-hidden rounded-lg bg-bg-raised shadow-[0_0_0_1px_oklch(0_0_0_/_0.05)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                    <img
                      alt=""
                      className="media-outline size-full object-cover"
                      src={draft.previewUrl}
                    />
                    <button
                      type="button"
                      aria-label={`Remove image ${index + 1}`}
                      className="ui-control absolute right-0.5 top-0.5 flex size-6 items-center justify-center rounded-full shadow-sm disabled:opacity-60"
                      disabled={composeLocked}
                      onClick={() => removeImageDraft(draft)}
                    >
                      <CloseIcon className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              className={IMAGE_ACTION_BTN}
              type="button"
              disabled={composeLocked}
              onClick={() => { clearImageDrafts(); setPreviewKind(null); }}
            >
              Remove all images
            </button>
          </div>
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
        {hasFileBatch ? <CaptureFileList files={fileDrafts!} results={fileResults} disabled={composeLocked}
          onRemove={(index) => { setFileDrafts((files) => files && files.length > 1 ? files.filter((_, position) => position !== index) : null); }} /> : null}
        {!hasFileBatch && fileResults.some((result) => result.status === "failed") ? <ul aria-label="Failed files" className="space-y-2 text-xs text-text-danger">
          {fileResults.map((result, index) => result.status === "failed" ? <li key={index}>{result.fileName}: {result.error}</li> : null)}
        </ul> : null}
        {fileQuotaWarning ? <p role="status" className="text-sm text-text-warning">{fileQuotaWarning}</p> : null}
        {savingImage && imageLayoutRequired && !hasFileBatch ? <CaptureImageLayout mode={imageLayout} disabled={composeLocked}
          value={state.input} format={noteFormat} preview={previewKind === "image"} inputRef={inputRef}
          label={documentDraft ? "Text beneath images" : "Optional source URL or caption"}
          onModeChange={(mode) => { setImageLayout(mode); setPreviewKind(null); }}
          onChange={(text) => { clipboardTextUntouchedRef.current = false; dispatch({ type: "input", text }); }}
          onFormatChange={setNoteFormat} onPreviewChange={(preview) => setPreviewKind(preview ? "image" : null)} /> : null}
        {kind === "note" && !savingImage && !videoDraft && !hasFileBatch ? (
          <NoteEditorControls format={noteFormat} preview={previewKind === "note"} disabled={composeLocked} onFormatChange={setNoteFormat} onPreviewChange={(preview) => setPreviewKind(preview ? "note" : null)} />
        ) : null}
        {savingImage && !imageLayoutRequired && !hasFileBatch && (documentDraft || textFieldsFromAccompanyingText(state.input).caption) ? (
          <NoteEditorControls format={noteFormat} preview={previewKind === "image"} disabled={composeLocked} onFormatChange={setNoteFormat} onPreviewChange={(preview) => setPreviewKind(preview ? "image" : null)} />
        ) : null}
        {previewKind !== "note" && previewKind !== "image" && !hasFileBatch && !(savingImage && imageLayoutRequired) ? (
          <div className="flex flex-col gap-2">
            {documentDraft ? <span className="text-sm font-medium text-text-primary">{videoDraft ? "Video title" : savingImage ? "Text beneath images" : noteFormat === "markdown" ? "Markdown content" : "Text content"}</span> : null}
            {kind === "link" && !savingImage && !videoDraft ? <span className="text-sm font-medium text-text-secondary">Link URL</span> : null}
            <label className="sr-only" htmlFor="capture-input">
              {videoDraft ? "Video title" : savingImage
                ? documentDraft ? "Text beneath images" : "Optional source URL or caption"
                : documentDraft ? noteFormat === "markdown" ? "Markdown content" : "Text content" : "Link, note, or image"}
            </label>
            <ScrollTextarea
              ref={inputRef}
              className={`ui-field w-full rounded-input px-4 py-3 text-sm disabled:opacity-60 ${
                videoDraft ? "min-h-11" : documentDraft ? "min-h-48" : savingImage ? "min-h-16" : kind === "link" ? "min-h-11" : "min-h-24"
              }`}
              id="capture-input"
              placeholder={
                videoDraft ? "Optional video title" : savingImage
                  ? "Optional source URL or caption"
                  : kind === "link" ? "https://example.com/page" : "Paste a link, note, or image"
              }
              value={state.input}
              onChange={(event) => {
                clipboardTextUntouchedRef.current = false;
                dispatch({ type: "input", text: event.target.value });
              }}
              disabled={composeLocked}
            />
          </div>
        ) : null}
        {kind === "note" && !savingImage && !videoDraft && !hasFileBatch && previewKind === "note" ? (
          <ScrollArea role="region" aria-label="Note preview" className={documentDraft ? FILE_PREVIEW_CLASS : CAPTURE_PREVIEW_CLASS} viewportClassName="scroll-fade min-h-0 flex-1 overscroll-contain p-4">
            {documentDraft ? <DocumentText text={state.input} format={noteFormat === "markdown" ? "markdown" : "text"} /> : <NoteContent content={state.input} format={noteFormat} />}
          </ScrollArea>
        ) : null}
        {savingImage && !imageLayoutRequired && !hasFileBatch && previewKind === "image" ? (
          <ScrollArea role="region" aria-label="Image note preview" className={documentDraft ? FILE_PREVIEW_CLASS : CAPTURE_PREVIEW_CLASS} viewportClassName="scroll-fade min-h-0 flex-1 overscroll-contain p-4">
            {documentDraft ? <DocumentText text={state.input} format={noteFormat === "markdown" ? "markdown" : "text"} /> : <NoteContent content={state.input} format={noteFormat} />}
          </ScrollArea>
        ) : null}
        {videoDraft && !hasFileBatch ? (
          <div className="flex flex-col gap-3">
            {previewKind === "video" ? <span className="text-sm font-medium text-text-primary">Notes (optional)</span> : <label className="text-sm font-medium text-text-primary" htmlFor="capture-video-note">Notes (optional)</label>}
            <NoteEditorControls format={noteFormat} preview={previewKind === "video"} disabled={composeLocked} onFormatChange={setNoteFormat} onPreviewChange={(preview) => setPreviewKind(preview ? "video" : null)} />
            {previewKind !== "video" ? <ScrollTextarea id="capture-video-note" className="ui-field min-h-28 resize-y px-3 py-2 text-sm" placeholder="Add a note about this video" value={videoNoteDraft} disabled={composeLocked} onChange={(event) => setVideoNoteDraft(event.target.value)} /> : null}
            {previewKind === "video" ? <ScrollArea role="region" aria-label="Video note preview" className={CAPTURE_PREVIEW_CLASS} viewportClassName="scroll-fade min-h-0 flex-1 overscroll-contain p-4"><NoteContent content={videoNoteDraft} format={noteFormat} /></ScrollArea> : null}
          </div>
        ) : null}
        {kind === "link" && !savingImage && !videoDraft && !hasFileBatch ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {previewKind === "link" ? (
                <span className="text-sm font-medium text-text-primary">Your note (optional)</span>
              ) : (
                <label className="text-sm font-medium text-text-primary" htmlFor="capture-link-note">Your note (optional)</label>
              )}
              <NoteEditorControls format={noteFormat} preview={previewKind === "link"} disabled={composeLocked} onFormatChange={setNoteFormat} onPreviewChange={(preview) => setPreviewKind(preview ? "link" : null)} />
            </div>
            {previewKind === "link" ? (
              <ScrollArea role="region" aria-label="Personal note preview" className={`${CAPTURE_PREVIEW_CLASS} h-28`} viewportClassName="scroll-fade min-h-0 flex-1 overscroll-contain p-4">
                <NoteContent content={linkNoteDraft} format={noteFormat} />
              </ScrollArea>
            ) : (
              <ScrollTextarea id="capture-link-note" className="ui-field min-h-28 resize-y px-3 py-2 text-sm" placeholder="Why are you saving this link?" value={linkNoteDraft} disabled={composeLocked} onChange={(event) => {
                setLinkNoteDraft(event.target.value);
                if (!event.target.value.trim()) setPreviewKind(null);
              }} />
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <input
            ref={fileInputRef}
            accept={CAPTURE_FILE_ACCEPT}
            aria-label="Choose files"
            data-capture-files
            className="sr-only"
            type="file"
            disabled={composeLocked}
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
            <UploadIcon className="size-4" />Add files
          </button>
          {videoDraft ? (
            <button className={IMAGE_ACTION_BTN} type="button" disabled={composeLocked} onClick={() => { setVideoDraft(null); if (documentDraft) { dispatch({ type: "input", text: videoNoteDraft }); setVideoNoteDraft(""); } }}>Remove video</button>
          ) : null}
          {!savingImage && !videoDraft && !documentDraft && !hasFileBatch ? (
            state.input.trim() ? <div className="ml-auto flex items-center gap-2">
              <p className="text-xs text-text-secondary">Saving as {kind}</p>
              {classified === "link" ? <CaptureTypeMenu value={kind} disabled={composeLocked}
                onChange={(next) => dispatch({ type: "override", kind: next === "link" ? null : "note" })} /> : null}
            </div> : null
          ) : (
            <p className="ml-auto text-xs text-text-secondary">
              {hasFileBatch ? "Each file saves separately" : imageLayoutRequired && imageLayout !== "gallery" ? imageLayout === "separate" ? "Separate image items" : "Choose an image layout" : videoDraft ? "Saving as video" : documentDraft && !savingImage ? "Saving as note" : imageDrafts.length > 1
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
            setCollectionInput("");
          }}
          onClearCollection={() => setDraftCollectionName(null)}
        />
        {fileProgress ? <p role="status" className="text-sm tabular-nums text-text-secondary">Saving files… {fileProgress.done} of {fileProgress.total}</p> : null}
        {state.error ? (
          <p className="text-sm text-text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        </div>
        </ScrollArea>
        <div
          className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-control bg-bg-canvas px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
          data-testid="capture-footer"
        >
          <button
            className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} mr-auto px-3 text-xs disabled:opacity-60`}
            type="button"
            disabled={composeLocked}
            onClick={() => setBulkImportOpen(true)}
          >
            Bulk import
          </button>
          <button
            className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_IDLE} px-4 disabled:opacity-60`}
            type="button"
            disabled={dismissLocked}
            onClick={() => {
              resetSession();
              dispatch({ type: "dismiss" });
            }}
          >
            {fileResults.some((result) => result.status === "saved") ? "Done" : "Cancel"}
          </button>
          <button
            className={`${SHELL_TOP_BTN} ${SHELL_TOP_BTN_ACTIVE} px-4 disabled:opacity-60`}
            type="submit"
            disabled={
              state.status === "saving" ||
              state.status === "reading" ||
              state.status === "saved" ||
              imageUpload !== null ||
              videoPreparing ||
              documentReading ||
              folderImportBusy ||
              imageLayoutRequired && !hasFileBatch && !imageLayout ||
              bookmarksImportBusy ||
              imageUploadError !== null
            }
          >
            {state.status === "saving" ? "Saving…" : fileResults.some((result) => result.status === "failed") ? "Retry failed files" : "Save"}
          </button>
          {state.status === "saved" ? (
            <p className="text-xs text-text-secondary">Saved.</p>
          ) : (
            <p className="order-first basis-full text-xs text-text-secondary">Ctrl/⌘ Enter to save</p>
          )}
        </div>
      </form>
      {isActive ? (
        <ModalDialog
          open={bulkImportOpen}
          onOpenChange={setBulkImportOpen}
          title="Bulk import"
          description="Import separate items from files, a folder, or browser bookmarks."
          busy={folderImportBusy || bookmarksImportBusy}
          footer={(
            <button
              className="ui-control min-h-10 px-4 text-sm font-medium disabled:opacity-60"
              type="button"
              disabled={folderImportBusy || bookmarksImportBusy}
              onClick={() => setBulkImportOpen(false)}
            >
              Done
            </button>
          )}
        >
          <BulkFileImport
            onSelect={(files, collectionName, quotaWarning) => {
              setBulkImportOpen(false);
              setDraftCollectionName(collectionName.trim() || null);
              setCollectionInput("");
              setFileQuotaWarning(quotaWarning);
              void stageFiles(files, true);
            }}
            buttonClassName="ui-control min-h-11 w-full px-4 text-left text-sm font-medium disabled:opacity-60"
            disabled={composeLocked}
            defaultCollectionName={draftCollectionName ?? collectionInput.trim()}
            onBusyChange={setFolderImportBusy}
          />
          <BookmarksImport
            buttonClassName="ui-control min-h-11 w-full px-4 text-left text-sm font-medium disabled:opacity-60"
            label="Import bookmarks HTML"
            disabled={composeLocked}
            onBusyChange={setBookmarksImportBusy}
          />
        </ModalDialog>
      ) : null}
      <ConfirmDialog {...dismissal.confirmationProps} />
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
