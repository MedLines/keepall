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

  const dialogClass =
    "ui-native-dialog ui-popover fixed inset-0 z-50 m-auto h-fit w-[min(100%-2rem,30rem)] overflow-hidden p-0 text-text-primary";
  const dialogHeaderClass =
    "flex shrink-0 items-start gap-4 border-b border-border-control px-6 py-5";
  const dialogBodyClass =
    "scroll-fade min-h-0 flex-1 overflow-y-auto px-6 py-5";
  const dialogFooterClass =
    "flex shrink-0 flex-wrap justify-end gap-2 border-t border-border-control px-6 py-4";
  const dialogCloseClass =
    "ui-control flex size-10 shrink-0 items-center justify-center disabled:opacity-60";
  const dialogButtonClass =
    "ui-control min-h-10 px-4 text-sm font-medium disabled:opacity-60";

  const imageFolderDialog = (
    <dialog
      ref={imageFolderDialogRef}
      className={`${dialogClass} max-h-[min(90dvh,32rem)]`}
      aria-labelledby={imageFolderTitleId}
      onCancel={(event) => {
        event.preventDefault();
        cancelImageFolderImport();
      }}
    >
      {pendingImageFiles !== null ? (
        <div className="flex max-h-[min(90dvh,32rem)] flex-col">
          <header className={dialogHeaderClass}>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold" id={imageFolderTitleId}>
                Import image folder
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                {pendingImageFiles.length} file
                {pendingImageFiles.length === 1 ? "" : "s"} selected. Images under
                3MB become separate library items.
              </p>
            </div>
            <button
              className={dialogCloseClass}
              type="button"
              aria-label="Close image import"
              disabled={busy}
              onClick={cancelImageFolderImport}
            >
              <CloseIcon />
            </button>
          </header>
          <div className={dialogBodyClass}>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-text-primary">
                Collection (optional)
              </span>
              <input
                className="ui-field min-h-11 px-3 py-2 disabled:opacity-60"
                type="text"
                value={imageCollectionDraft}
                placeholder="e.g. Vacation 2024"
                disabled={busy}
                onChange={(event) => setImageCollectionDraft(event.target.value)}
              />
              <span className="text-xs leading-relaxed text-text-secondary">
                Leave blank to keep the images unsorted. Unsupported or larger
                files are skipped. Subfolders are not converted into collections.
              </span>
            </label>
            {imageQuotaWarning ? (
              <p className="mt-4 text-sm text-text-warning" role="status">
                {imageQuotaWarning}
              </p>
            ) : null}
          </div>
          <footer className={dialogFooterClass}>
            <button
              className={dialogButtonClass}
              type="button"
              disabled={busy}
              onClick={cancelImageFolderImport}
            >
              Cancel
            </button>
            <button
              className={`${dialogButtonClass} ui-primary`}
              type="button"
              disabled={busy}
              onClick={() => void runImageFolderImport()}
            >
              {busy && imageImportProgress
                ? `Importing… ${imageImportProgress.done} / ${imageImportProgress.total}`
                : "Import images"}
            </button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );

  const choiceDialog = (
    <dialog
      ref={choiceDialogRef}
      className={`${dialogClass} max-h-[min(90dvh,26rem)]`}
      aria-labelledby={choiceTitleId}
      onCancel={(event) => {
        event.preventDefault();
        cancelImportChoice();
      }}
    >
      {pendingRaw !== null ? (
        <div className="flex max-h-[min(90dvh,26rem)] flex-col">
          <header className={dialogHeaderClass}>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold" id={choiceTitleId}>
                Import backup
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                Merge combines this file with your library. Replace removes the
                current library first.
              </p>
            </div>
            <button
              className={dialogCloseClass}
              type="button"
              aria-label="Close backup import"
              disabled={busy}
              onClick={cancelImportChoice}
            >
              <CloseIcon />
            </button>
          </header>
          <footer className={dialogFooterClass}>
            <button
              className={dialogButtonClass}
              type="button"
              disabled={busy}
              onClick={cancelImportChoice}
            >
              Cancel
            </button>
            <button
              className={`${dialogButtonClass} border-border-danger bg-bg-danger text-text-danger`}
              type="button"
              disabled={busy}
              onClick={() => void runImport("replace")}
            >
              Replace
            </button>
            <button
              className={`${dialogButtonClass} ui-primary`}
              type="button"
              disabled={busy}
              onClick={() => void runImport("merge")}
            >
              Merge
            </button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );

  const bookmarksDialog = (
    <dialog
      ref={bookmarksDialogRef}
      className={`${dialogClass} max-h-[min(90dvh,38rem)]`}
      aria-labelledby={bookmarksTitleId}
      onCancel={(event) => {
        event.preventDefault();
        cancelBookmarksImport();
      }}
    >
      {pendingBookmarksHtml !== null ? (
        <div className="flex max-h-[min(90dvh,38rem)] flex-col">
          <header className={dialogHeaderClass}>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold" id={bookmarksTitleId}>
                Import browser bookmarks
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                Existing links are merged by URL. Nothing in Keepall is deleted.
              </p>
            </div>
            <button
              className={dialogCloseClass}
              type="button"
              aria-label="Close bookmarks import"
              disabled={busy}
              onClick={cancelBookmarksImport}
            >
              <CloseIcon />
            </button>
          </header>
          <div className={dialogBodyClass}>
          <fieldset className="flex flex-col gap-2 border-0 p-0">
            <legend className="text-sm font-medium text-text-primary">
              When a link already exists, which collection wins?
            </legend>
            <p className="text-xs leading-relaxed text-text-secondary">
              Browser tags are always added. This choice only controls browser
              folders and Keepall collections.
            </p>
            <label className="ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm has-[:checked]:bg-bg-active">
              <input
                type="radio"
                name="collection-policy"
                className="mt-0.5"
                checked={collectionPolicy === "unsorted-only"}
                onChange={() => setCollectionPolicy("unsorted-only")}
              />
              <span>
                <span className="font-medium">Browser folder → Unsorted only</span>
                <span className="mt-0.5 block text-xs text-text-secondary">
                  Already in a Keepall collection → leave it. In Keepall Unsorted
                  → file using the browser folder name.
                </span>
              </span>
            </label>
            <label className="ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm has-[:checked]:bg-bg-active">
              <input
                type="radio"
                name="collection-policy"
                className="mt-0.5"
                checked={collectionPolicy === "keep"}
                onChange={() => setCollectionPolicy("keep")}
              />
              <span>
                <span className="font-medium">Keep Keepall collections</span>
                <span className="mt-0.5 block text-xs text-text-secondary">
                  Browser folders apply only to links not in Keepall yet. Existing
                  Keepall links keep their collection.
                </span>
              </span>
            </label>
            <label className="ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm has-[:checked]:bg-bg-active">
              <input
                type="radio"
                name="collection-policy"
                className="mt-0.5"
                checked={collectionPolicy === "apply"}
                onChange={() => setCollectionPolicy("apply")}
              />
              <span>
                <span className="font-medium">Browser folders win</span>
                <span className="mt-0.5 block text-xs text-text-secondary">
                  If the browser file has a folder, move the Keepall link into
                  that collection — even when already filed.
                </span>
              </span>
            </label>
          </fieldset>
          </div>
          <footer className={dialogFooterClass}>
            <button
              className={dialogButtonClass}
              type="button"
              disabled={busy}
              onClick={cancelBookmarksImport}
            >
              Cancel
            </button>
            <button
              className={`${dialogButtonClass} ui-primary`}
              type="button"
              disabled={busy}
              onClick={() => void runBookmarksImport()}
            >
              Import bookmarks
            </button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );

  const heading = (
    <div className="flex items-start gap-2">
      <BackupIcon className="mt-0.5 size-5 shrink-0 text-text-secondary" />
      <div className="min-w-0 flex-1">
        <h2
          className={
            variant === "sidebar"
              ? "text-sm font-semibold text-text-primary"
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
          className="ui-control flex size-9 items-center justify-center"
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
      ? "ui-control min-h-10 px-3 py-2 text-sm font-medium disabled:opacity-60"
      : "ui-control min-h-10 px-4 py-2 text-sm font-medium disabled:opacity-60";

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
              variant === "sidebar" ? "text-xs text-text-primary" : "text-sm text-text-primary"
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
            className="h-2 w-full overflow-hidden rounded-full accent-action-primary"
            max={imageImportProgress.total}
            value={imageImportProgress.done}
          />
          <p
            className={
              variant === "sidebar" ? "text-[11px] text-text-secondary" : "text-xs text-text-secondary"
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
              ? "mt-2 text-xs text-text-primary"
              : "mt-2 text-sm text-text-primary"
          }
        >
          {status}
        </p>
      ) : null}
      {lastBookmarksSummary && lastBookmarksSummary.skippedRows.length > 0 ? (
        <button
          className={
            variant === "sidebar"
              ? "mt-2 text-left text-xs font-medium text-text-primary underline"
              : "mt-2 text-left text-sm font-medium text-text-primary underline"
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
              ? "mt-2 text-xs text-text-danger"
              : "mt-2 text-sm text-text-danger"
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
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
        <strong className="font-medium">Keepall</strong> backup: export or import
        a <code className="text-[11px]">.keepall</code> file.{" "}
        <strong className="font-medium">Browser</strong>: HTML bookmarks.{" "}
        <strong className="font-medium">Images</strong>: a folder of files (3MB
        each max).
      </p>
    ) : (
      <p className="mt-2 text-sm text-text-secondary">
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
    <section className="mt-10 border-t border-border-edge pt-6" aria-labelledby="backup-heading">
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
