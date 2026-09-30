"use client";

import { useRef, useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import type { BookmarksHtmlCollectionPolicy } from "@/domain/bookmarks-html";
import {
  formatImageFolderImportStatus,
  imageFolderImportSkippedDetail,
  suggestImageFolderCollectionName,
} from "@/domain/image-folder-import";
import { BackupValidationError } from "@/domain/backup";
import { exportKeepallArchive, importKeepallArchiveMerge, importKeepallArchiveReplace } from "@/persistence/backup-archive";
import { normalizeItem } from "@/domain/item";
import {
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
  const [feedbackSection, setFeedbackSection] =
    useState<"backup" | "import">("backup");
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setFeedbackSection("backup");
    setBusy(true);
    setError(null);
    setStatus(null);
    setLastBookmarksSummary(null);

    try {
      const blob = await exportKeepallArchive();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `keepall-backup-${Date.now()}.keepall.zip`;
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
    setFeedbackSection("backup");

    setBusy(true);
    setError(null);
    setStatus(null);
    setLastBookmarksSummary(null);

    try {
      const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (signature[0] === 0x50 && signature[1] === 0x4b) {
        setPendingRaw(file);
      } else {
        let raw: unknown;
        try {
          raw = JSON.parse(await file.text()) as unknown;
        } catch {
          throw new BackupValidationError("Backup file is not valid JSON or ZIP");
        }
        setPendingRaw(raw);
      }
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
    setFeedbackSection("import");

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
        const { summary } = raw instanceof Blob
          ? await importKeepallArchiveMerge(raw)
          : await importKeepallBackupMerge(raw);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        dispatchPreviewWelcome(summary.addedLinkIds);
        setStatus(
          `Merged: ${summary.added} added, ${summary.updated} updated, ${summary.unchanged} unchanged.`,
        );
      } else {
        const backup = raw instanceof Blob
          ? await importKeepallArchiveReplace(raw)
          : await importKeepallBackupReplace(raw);
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
    setFeedbackSection("import");

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
      accept="application/json,application/zip,.json,.keepall,.zip"
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

  const dialogButtonClass =
    "ui-control min-h-10 px-4 text-sm font-medium disabled:opacity-60";

  const imageFolderDialog = (
    <ModalDialog
      open={pendingImageFiles !== null} busy={busy} title="Import image folder"
      description={`${pendingImageFiles?.length ?? 0} file${pendingImageFiles?.length === 1 ? "" : "s"} selected. Images under 20 MiB become separate library items.`}
      onOpenChange={(open) => { if (!open) cancelImageFolderImport(); }}
      footer={<>
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
      </>}
    >

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
    </ModalDialog>
  );

  const choiceDialog = (
    <ModalDialog
      open={pendingRaw !== null} busy={busy} title="Import backup"
      description="Merge combines this file with your library. Replace removes the current library first."
      onOpenChange={(open) => { if (!open) cancelImportChoice(); }}
      footer={<>
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
      </>}
    >
    </ModalDialog>
  );

  const bookmarksDialog = (
    <ModalDialog
      open={pendingBookmarksHtml !== null} busy={busy} title="Import browser bookmarks"
      description="Choose how browser folders update collections when links already exist."
      onOpenChange={(open) => { if (!open) cancelBookmarksImport(); }}
      footer={<>
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
      </>}
    >

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
          disabled={busy}
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
          disabled={busy}
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
          disabled={busy}
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
    </ModalDialog>
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
        a <code className="text-[11px]">.keepall.zip</code> file.{" "}
        <strong className="font-medium">Browser</strong>: HTML bookmarks.{" "}
        <strong className="font-medium">Images</strong>: a folder of files (20 MiB
        each max).
      </p>
    ) : (
      <p className="mt-2 text-sm text-text-secondary">
        <strong className="font-medium">Keepall</strong> backup: export or import
        a <code>.keepall.zip</code> file. <strong className="font-medium">Browser</strong>
        : HTML bookmarks. <strong className="font-medium">Images</strong>: pick a
        folder (20 MiB per file max).
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
    <>
      <section
        className="library-panel border border-border-control bg-bg-surface p-5 sm:p-7"
        aria-labelledby="backup-heading"
      >
        {heading}
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Download a <code>.keepall.zip</code> recovery copy, or restore one into
          this browser.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className={buttonClass}
            type="button"
            disabled={busy}
            onClick={() => void onExport()}
          >
            Export backup
          </button>
          <button
            className={buttonClass}
            type="button"
            disabled={busy}
            onClick={onPickImport}
          >
            Import backup
          </button>
          {fileInput}
        </div>
        {feedbackSection === "backup" ? feedback : null}
      </section>
      <section
        className="library-panel border border-border-control bg-bg-surface p-5 sm:p-7"
        aria-labelledby="import-heading"
      >
        <h2 id="import-heading" className="text-lg font-semibold text-text-primary">
          Import
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Add browser bookmarks or an image folder to your existing library.
          Images are limited to 20 MiB per file.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
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
          {bookmarksFileInput}
          {imageFolderInput}
        </div>
        {feedbackSection === "import" ? feedback : null}
      </section>
      {choiceDialog}
      {bookmarksDialog}
      {imageFolderDialog}
    </>
  );
}
