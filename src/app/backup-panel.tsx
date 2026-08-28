"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { BookmarksHtmlCollectionPolicy } from "@/domain/bookmarks-html";
import {
  formatImageFolderImportStatus,
  imageFolderImportSkippedDetail,
  suggestImageFolderCollectionName,
} from "@/domain/image-folder-import";
import { BackupValidationError } from "@/domain/backup";
import { normalizeItem } from "@/domain/item";
import {
  exportKeepallBackup,
  importKeepallBackupMerge,
  importKeepallBackupReplace,
} from "@/persistence/backup";
import {
  BookmarksHtmlParseError,
  formatSkippedBookmarksLog,
  importBookmarksHtmlMerge,
  type BookmarksHtmlImportSummary,
} from "@/persistence/bookmarks-html-import";
import { importImageFolder } from "@/persistence/image-folder-import";
import { dispatchPreviewWelcome, ITEMS_CHANGED_EVENT } from "./items-events";
import {
  storageQuotaWarningForImport,
  sumImportableFolderBytes,
} from "./storage-quota-warning";
import { BackupIcon, CloseIcon } from "./shell-icons";

type ImportMode = "merge" | "replace";

type Props = {
  variant?: "page" | "sidebar";
  onClose?: () => void;
};

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BackupPanel({ variant = "page", onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bookmarksFileInputRef = useRef<HTMLInputElement>(null);
  const imageFolderInputRef = useRef<HTMLInputElement>(null);
  const choiceDialogRef = useRef<HTMLDialogElement>(null);
  const bookmarksDialogRef = useRef<HTMLDialogElement>(null);
  const imageFolderDialogRef = useRef<HTMLDialogElement>(null);
  const choiceTitleId = useId();
  const bookmarksTitleId = useId();
  const imageFolderTitleId = useId();
  const [pendingRaw, setPendingRaw] = useState<unknown | null>(null);
  const [pendingBookmarksHtml, setPendingBookmarksHtml] = useState<string | null>(
    null,
  );
  const [pendingImageFiles, setPendingImageFiles] = useState<File[] | null>(
    null,
  );
  const [imageCollectionDraft, setImageCollectionDraft] = useState("");
  const [imageQuotaWarning, setImageQuotaWarning] = useState<string | null>(
    null,
  );
  const [imageImportProgress, setImageImportProgress] = useState<{
    done: number;
    total: number;
    currentName: string;
    added: number;
    reused: number;
  } | null>(null);
  const [collectionPolicy, setCollectionPolicy] =
    useState<BookmarksHtmlCollectionPolicy>("unsorted-only");
  const [lastBookmarksSummary, setLastBookmarksSummary] =
    useState<BookmarksHtmlImportSummary | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = choiceDialogRef.current;
    if (!dialog) {
      return;
    }
    if (pendingRaw !== null && !dialog.open) {
      dialog.showModal();
    }
    if (pendingRaw === null && dialog.open) {
      dialog.close();
    }
  }, [pendingRaw]);

  useEffect(() => {
    const dialog = bookmarksDialogRef.current;
    if (!dialog) {
      return;
    }
    if (pendingBookmarksHtml !== null && !dialog.open) {
      dialog.showModal();
    }
    if (pendingBookmarksHtml === null && dialog.open) {
      dialog.close();
    }
  }, [pendingBookmarksHtml]);

  useEffect(() => {
    const dialog = imageFolderDialogRef.current;
    if (!dialog) {
      return;
    }
    if (pendingImageFiles !== null && !dialog.open) {
      dialog.showModal();
    }
    if (pendingImageFiles === null && dialog.open) {
      dialog.close();
    }
  }, [pendingImageFiles]);

  async function onExport() {
    setBusy(true);
    setError(null);
    setStatus(null);
    setLastBookmarksSummary(null);

    try {
      const backup = await exportKeepallBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `keepall-backup-${backup.exportedAt}.keepall.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Backup downloaded.");
    } catch {
      setError("Couldn't export backup.");
    } finally {
      setBusy(false);
    }
  }

  function onPickImport() {
    fileInputRef.current?.click();
  }

  function onPickBookmarksImport() {
    bookmarksFileInputRef.current?.click();
  }

  function onPickImageFolder() {
    imageFolderInputRef.current?.click();
  }

  async function onFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);
    setLastBookmarksSummary(null);

    try {
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        throw new BackupValidationError("Backup file is not valid JSON");
      }
      setPendingRaw(raw);
    } catch (caught) {
      if (caught instanceof BackupValidationError) {
        setError(caught.message);
      } else {
        setError("Couldn't read backup file.");
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function onBookmarksFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);
    setLastBookmarksSummary(null);

    try {
      setPendingBookmarksHtml(await file.text());
      setCollectionPolicy("unsorted-only");
    } catch {
      setError("Couldn't read bookmarks file.");
    } finally {
      setBusy(false);
      if (bookmarksFileInputRef.current) {
        bookmarksFileInputRef.current.value = "";
      }
    }
  }

  function cancelImportChoice() {
    if (busy) {
      return;
    }
    setPendingRaw(null);
    setStatus("Import canceled.");
  }

  function cancelBookmarksImport() {
    if (busy) {
      return;
    }
    setPendingBookmarksHtml(null);
    setStatus("Bookmarks import canceled.");
  }

  async function runImport(mode: ImportMode) {
    if (pendingRaw === null) {
      return;
    }

    const raw = pendingRaw;
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      if (mode === "merge") {
        const { summary } = await importKeepallBackupMerge(raw);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        dispatchPreviewWelcome(summary.addedLinkIds);
        setStatus(
          `Merged: ${summary.added} added, ${summary.updated} updated, ${summary.unchanged} unchanged.`,
        );
      } else {
        const backup = await importKeepallBackupReplace(raw);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        dispatchPreviewWelcome(
          backup.items
            .map((item) => normalizeItem(item))
            .filter((item) => item.type === "link")
            .map((item) => item.id),
        );
        setStatus("Library replaced from backup.");
      }
      setPendingRaw(null);
    } catch (caught) {
      if (caught instanceof BackupValidationError) {
        setError(caught.message);
      } else {
        setError(
          mode === "merge" ? "Couldn't merge backup." : "Couldn't replace library.",
        );
      }
      setPendingRaw(null);
    } finally {
      setBusy(false);
    }
  }

  async function runBookmarksImport() {
    if (pendingBookmarksHtml === null) {
      return;
    }

    const html = pendingBookmarksHtml;
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const summary = await importBookmarksHtmlMerge(html, { collectionPolicy });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      dispatchPreviewWelcome(summary.addedLinkIds);
      setLastBookmarksSummary(summary);
      setStatus(
        `Bookmarks: ${summary.added} added, ${summary.merged} merged, ${summary.skipped} skipped.`,
      );
      setPendingBookmarksHtml(null);
    } catch (caught) {
      if (caught instanceof BookmarksHtmlParseError) {
        setError(caught.message);
      } else {
        setError("Couldn't import bookmarks.");
      }
      setPendingBookmarksHtml(null);
    } finally {
      setBusy(false);
    }
  }

  async function onImageFolderChange(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);
    setLastBookmarksSummary(null);

    try {
      const files = Array.from(fileList);
      setPendingImageFiles(files);
      setImageCollectionDraft(suggestImageFolderCollectionName(files));
      const importableBytes = sumImportableFolderBytes(files);
      setImageQuotaWarning(
        await storageQuotaWarningForImport(importableBytes),
      );
    } catch {
      setError("Couldn't read folder.");
    } finally {
      setBusy(false);
      if (imageFolderInputRef.current) {
        imageFolderInputRef.current.value = "";
      }
    }
  }

  function cancelImageFolderImport() {
    if (busy) {
      return;
    }
    setPendingImageFiles(null);
    setImageCollectionDraft("");
    setImageQuotaWarning(null);
    setStatus("Image import canceled.");
  }

  async function runImageFolderImport() {
    if (pendingImageFiles === null) {
      return;
    }

    const files = pendingImageFiles;
    const collectionName = imageCollectionDraft.trim() || undefined;
    const total = files.length;

    setPendingImageFiles(null);
    setImageQuotaWarning(null);
    setImageImportProgress({ done: 0, total, currentName: "", added: 0, reused: 0 });
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const summary = await importImageFolder(files, {
        collectionName,
        batchEvery: 8,
        onBatch: () => window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT)),
        onProgress: ({ done, total: progressTotal, currentName, added, reused }) => {
          setImageImportProgress({
            done,
            total: progressTotal,
            currentName,
            added,
            reused,
          });
        },
      });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      let message = formatImageFolderImportStatus(summary);
      const skippedDetail = imageFolderImportSkippedDetail(summary);
      if (skippedDetail) {
        message = `${message} (${skippedDetail})`;
      }
      setStatus(message);
      setImageCollectionDraft("");
    } catch {
      setError("Couldn't import images.");
    } finally {
      setImageImportProgress(null);
      setBusy(false);
    }
  }

  function onDownloadSkippedLog() {
    if (!lastBookmarksSummary || lastBookmarksSummary.skippedRows.length === 0) {
      return;
    }
    downloadTextFile(
      `keepall-skipped-bookmarks-${Date.now()}.txt`,
      formatSkippedBookmarksLog(lastBookmarksSummary.skippedRows),
    );
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      className="sr-only"
      type="file"
      accept="application/json,.json,.keepall"
      onChange={(event) => void onFileChange(event.target.files)}
    />
  );

  const bookmarksFileInput = (
    <input
      ref={bookmarksFileInputRef}
      className="sr-only"
      type="file"
      accept=".html,text/html,.htm"
      onChange={(event) => void onBookmarksFileChange(event.target.files)}
    />
  );

  const imageFolderInput = (
    <input
      ref={imageFolderInputRef}
      className="sr-only"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
      multiple
      onChange={(event) => void onImageFolderChange(event.target.files)}
      {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
    />
  );

  const imageFolderDialog = (
    <dialog
      ref={imageFolderDialogRef}
      className="fixed inset-0 z-50 m-auto h-fit max-h-[min(90dvh,28rem)] w-[min(100%-2rem,28rem)] overflow-y-auto rounded-[12px] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_16px_40px_rgba(0,0,0,0.16)] [&::backdrop]:bg-zinc-900/35 [&::backdrop]:backdrop-blur-[1px]"
      aria-labelledby={imageFolderTitleId}
      onCancel={(event) => {
        event.preventDefault();
        cancelImageFolderImport();
      }}
    >
      {pendingImageFiles !== null ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2
              className="text-lg font-semibold tracking-tight"
              id={imageFolderTitleId}
            >
              Import image folder
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {pendingImageFiles.length} file
              {pendingImageFiles.length === 1 ? "" : "s"} selected. Each image
              under 3MB becomes its own library item. Larger or unsupported
              files are skipped.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Subfolders are not turned into collections — only one optional
              collection for the whole import (prefilled from the folder name).
              Nested collections are not supported.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-900">
              Collection for all imports (optional)
            </span>
            <input
              className="rounded-[10px] border border-zinc-200 px-3 py-2 disabled:opacity-60"
              type="text"
              value={imageCollectionDraft}
              placeholder="e.g. Vacation 2024"
              disabled={busy}
              onChange={(event) => setImageCollectionDraft(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Leave blank to keep images unsorted. Clear the field to skip a
              collection.
            </span>
          </label>
          {imageQuotaWarning ? (
            <p className="text-sm text-amber-800" role="status">
              {imageQuotaWarning}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <button
              className="rounded-[10px] bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
              type="button"
              disabled={busy}
              onClick={() => void runImageFolderImport()}
            >
              {busy && imageImportProgress
                ? `Importing… ${imageImportProgress.done} / ${imageImportProgress.total}`
                : "Import images"}
            </button>
            <button
              className="rounded-[10px] px-3 py-2 text-sm font-medium text-zinc-600 transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
              type="button"
              disabled={busy}
              onClick={cancelImageFolderImport}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );

  const choiceDialog = (
    <dialog
      ref={choiceDialogRef}
      className="fixed inset-0 z-50 m-auto h-fit max-h-[min(90dvh,24rem)] w-[min(100%-2rem,24rem)] overflow-y-auto rounded-[12px] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_16px_40px_rgba(0,0,0,0.16)] [&::backdrop]:bg-zinc-900/35 [&::backdrop]:backdrop-blur-[1px]"
      aria-labelledby={choiceTitleId}
      onCancel={(event) => {
        event.preventDefault();
        cancelImportChoice();
      }}
    >
      {pendingRaw !== null ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" id={choiceTitleId}>
              Import backup
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Merge keeps your current library and combines this file. Replace
              wipes this library, then loads only the file.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              className="rounded-[10px] bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
              type="button"
              disabled={busy}
              onClick={() => void runImport("merge")}
            >
              Merge — keep both
            </button>
            <button
              className="rounded-[10px] border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
              type="button"
              disabled={busy}
              onClick={() => void runImport("replace")}
            >
              Replace current data
            </button>
            <button
              className="rounded-[10px] px-3 py-2 text-sm font-medium text-zinc-600 transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
              type="button"
              disabled={busy}
              onClick={cancelImportChoice}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );

  const bookmarksDialog = (
    <dialog
      ref={bookmarksDialogRef}
      className="fixed inset-0 z-50 m-auto h-fit max-h-[min(90dvh,32rem)] w-[min(100%-2rem,28rem)] overflow-y-auto rounded-[12px] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_16px_40px_rgba(0,0,0,0.16)] [&::backdrop]:bg-zinc-900/35 [&::backdrop]:backdrop-blur-[1px]"
      aria-labelledby={bookmarksTitleId}
      onCancel={(event) => {
        event.preventDefault();
        cancelBookmarksImport();
      }}
    >
      {pendingBookmarksHtml !== null ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight" id={bookmarksTitleId}>
              Import browser bookmarks
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Adds links from your <strong className="font-medium">browser</strong>{" "}
              export into <strong className="font-medium">Keepall</strong>. Nothing
              in Keepall is deleted. Same URL in both places → one Keepall link.
            </p>
          </div>
          <fieldset className="flex flex-col gap-2 border-0 p-0">
            <legend className="text-sm font-medium text-zinc-900">
              Link already in Keepall — what about collections?
            </legend>
            <p className="text-xs leading-relaxed text-zinc-600">
              Browser <em>tags</em> from the file are always added in Keepall.
              This choice is only about Keepall <em>collections</em> vs browser{" "}
              <em>folders</em>.
            </p>
            <label className="flex cursor-pointer gap-2 rounded-[10px] border border-zinc-200 px-3 py-2 text-sm">
              <input
                type="radio"
                name="collection-policy"
                className="mt-0.5"
                checked={collectionPolicy === "unsorted-only"}
                onChange={() => setCollectionPolicy("unsorted-only")}
              />
              <span>
                <span className="font-medium">Browser folder → Unsorted only</span>
                <span className="mt-0.5 block text-xs text-zinc-600">
                  Already in a Keepall collection → leave it. In Keepall Unsorted
                  → file using the browser folder name.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-2 rounded-[10px] border border-zinc-200 px-3 py-2 text-sm">
              <input
                type="radio"
                name="collection-policy"
                className="mt-0.5"
                checked={collectionPolicy === "keep"}
                onChange={() => setCollectionPolicy("keep")}
              />
              <span>
                <span className="font-medium">Keep Keepall collections</span>
                <span className="mt-0.5 block text-xs text-zinc-600">
                  Browser folders apply only to links not in Keepall yet. Existing
                  Keepall links keep their collection.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-2 rounded-[10px] border border-zinc-200 px-3 py-2 text-sm">
              <input
                type="radio"
                name="collection-policy"
                className="mt-0.5"
                checked={collectionPolicy === "apply"}
                onChange={() => setCollectionPolicy("apply")}
              />
              <span>
                <span className="font-medium">Browser folders win</span>
                <span className="mt-0.5 block text-xs text-zinc-600">
                  If the browser file has a folder, move the Keepall link into
                  that collection — even when already filed.
                </span>
              </span>
            </label>
          </fieldset>
          <div className="flex flex-col gap-2">
            <button
              className="rounded-[10px] bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
              type="button"
              disabled={busy}
              onClick={() => void runBookmarksImport()}
            >
              Import bookmarks
            </button>
            <button
              className="rounded-[10px] px-3 py-2 text-sm font-medium text-zinc-600 transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
              type="button"
              disabled={busy}
              onClick={cancelBookmarksImport}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );

  const heading = (
    <div className="flex items-start gap-2">
      <BackupIcon className="mt-0.5 size-5 shrink-0 text-zinc-500" />
      <div className="min-w-0 flex-1">
        <h2
          className={
            variant === "sidebar"
              ? "text-sm font-semibold text-zinc-900"
              : "text-lg font-semibold"
          }
          id="backup-heading"
        >
          Backup
        </h2>
      </div>
      {onClose ? (
        <button
          type="button"
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
          aria-label="Close backup"
          onClick={onClose}
        >
          <CloseIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );

  const buttonClass =
    variant === "sidebar"
      ? "rounded-[10px] border border-zinc-200/80 bg-white px-3 py-2 text-sm font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
      : "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60";

  const actions = (
    <div
      className={
        variant === "sidebar" ? "mt-3 flex flex-col gap-2" : "mt-3 flex flex-wrap gap-3"
      }
    >
      <button
        className={buttonClass}
        type="button"
        disabled={busy}
        onClick={() => void onExport()}
      >
        Export
      </button>
      <button
        className={buttonClass}
        type="button"
        disabled={busy}
        onClick={onPickImport}
      >
        Import
      </button>
      <button
        className={buttonClass}
        type="button"
        disabled={busy}
        onClick={onPickBookmarksImport}
      >
        Import bookmarks
      </button>
      <button
        className={buttonClass}
        type="button"
        disabled={busy}
        onClick={onPickImageFolder}
      >
        Import images
      </button>
      {fileInput}
      {bookmarksFileInput}
      {imageFolderInput}
    </div>
  );

  const feedback = (
    <>
      {imageImportProgress ? (
        <div
          className={
            variant === "sidebar" ? "mt-2 space-y-1" : "mt-3 space-y-2"
          }
          role="status"
          aria-live="polite"
        >
          <p
            className={
              variant === "sidebar" ? "text-xs text-zinc-700" : "text-sm text-zinc-700"
            }
          >
            Importing images… {imageImportProgress.done} /{" "}
            {imageImportProgress.total}
            {imageImportProgress.reused > 0
              ? ` · ${imageImportProgress.reused} already in library`
              : ""}
            {imageImportProgress.currentName
              ? ` — ${imageImportProgress.currentName}`
              : ""}
          </p>
          <progress
            className="h-2 w-full overflow-hidden rounded-full accent-zinc-900"
            max={imageImportProgress.total}
            value={imageImportProgress.done}
          />
          <p
            className={
              variant === "sidebar" ? "text-[11px] text-zinc-500" : "text-xs text-zinc-500"
            }
          >
            {imageImportProgress.added > 0
              ? "New images appear as they import. "
              : ""}
            Same file bytes are reused — the library count should not double.
          </p>
        </div>
      ) : null}
      {status && !imageImportProgress ? (
        <p
          className={
            variant === "sidebar"
              ? "mt-2 text-xs text-zinc-700"
              : "mt-2 text-sm text-zinc-700"
          }
        >
          {status}
        </p>
      ) : null}
      {lastBookmarksSummary && lastBookmarksSummary.skippedRows.length > 0 ? (
        <button
          className={
            variant === "sidebar"
              ? "mt-2 text-left text-xs font-medium text-zinc-800 underline"
              : "mt-2 text-left text-sm font-medium text-zinc-800 underline"
          }
          type="button"
          onClick={onDownloadSkippedLog}
        >
          Download skipped links (.txt)
        </button>
      ) : null}
      {error ? (
        <p
          className={
            variant === "sidebar"
              ? "mt-2 text-xs text-red-700"
              : "mt-2 text-sm text-red-700"
          }
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </>
  );

  const description =
    variant === "sidebar" ? (
      <p className="mt-2 text-xs leading-relaxed text-zinc-600">
        <strong className="font-medium">Keepall</strong> backup: export or import
        a <code className="text-[11px]">.keepall</code> file.{" "}
        <strong className="font-medium">Browser</strong>: HTML bookmarks.{" "}
        <strong className="font-medium">Images</strong>: a folder of files (3MB
        each max).
      </p>
    ) : (
      <p className="mt-2 text-sm text-zinc-600">
        <strong className="font-medium">Keepall</strong> backup: export or import
        a <code>.keepall</code> file. <strong className="font-medium">Browser</strong>
        : HTML bookmarks. <strong className="font-medium">Images</strong>: pick a
        folder (3MB per file max).
      </p>
    );

  if (variant === "sidebar") {
    return (
      <section aria-labelledby="backup-heading">
        {heading}
        {description}
        {actions}
        {feedback}
        {choiceDialog}
        {bookmarksDialog}
        {imageFolderDialog}
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6" aria-labelledby="backup-heading">
      {heading}
      {description}
      {actions}
      {feedback}
      {choiceDialog}
      {bookmarksDialog}
      {imageFolderDialog}
    </section>
  );
}
