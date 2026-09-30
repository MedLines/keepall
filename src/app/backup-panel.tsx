"use client";

import { useEffect, useRef, useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BookmarksHtmlCollectionPolicy } from "@/domain/bookmarks-html";
import {
  formatImageFolderImportStatus,
  imageFolderImportSkippedDetail,
  suggestImageFolderCollectionName,
} from "@/domain/image-folder-import";
import { BackupValidationError, type BackupCounts } from "@/domain/backup";
import { exportKeepallArchive, prepareBackupFile, type PreparedBackup } from "@/persistence/backup-archive";
import { countCurrentLibrary } from "@/persistence/backup";
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
import { BackupIcon, CloseIcon, CollectionIcon, HashIcon, ImageIcon, ImagesIcon, LinkIcon, NoteIcon, VideoIcon } from "./shell-icons";

type ImportMode = "merge" | "replace";
type Operation = "export" | "read-backup" | "restore" | "read-bookmarks" | "import-bookmarks" | "read-images" | "import-images";
const operationLabels: Record<Operation, string> = {
  export: "Preparing backup…", "read-backup": "Reading backup…", restore: "Restoring library…",
  "read-bookmarks": "Reading bookmarks…", "import-bookmarks": "Importing bookmarks…",
  "read-images": "Reading image folder…", "import-images": "Importing images…",
};
function countText(counts: BackupCounts) {
  return `${counts.total} items (${counts.active} active, ${counts.trash} in Trash)`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  const unit = bytes < 1024 * 1024 ? "KB" : "MB";
  const value = bytes / (unit === "KB" ? 1024 : 1024 * 1024);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)} ${unit}`;
}

const comparisonRows = [
  { label: "Links", key: "links", Icon: LinkIcon },
  { label: "Notes", key: "notes", Icon: NoteIcon },
  { label: "Images", key: "images", Icon: ImageIcon },
  { label: "Videos", key: "videos", Icon: VideoIcon },
  { label: "Tags", key: "tags", Icon: HashIcon },
  { label: "Collections", key: "collections", Icon: CollectionIcon },
  { label: "Image files", key: "imageAssets", Icon: ImagesIcon },
  { label: "Video files", key: "videoAssets", Icon: VideoIcon },
] as const;

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
  const [prepared, setPrepared] = useState<{ backup: PreparedBackup; current: BackupCounts } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const operationRef = useRef<Operation | null>(null);
  const readVersion = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; readVersion.current += 1; };
  }, []);
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
  const [operation, setOperation] = useState<Operation | null>(null);
  const busy = operation !== null;
  function start(next: Operation): boolean {
    if (operationRef.current) return false;
    operationRef.current = next;
    setOperation(next);
    return true;
  }
  function finish() {
    operationRef.current = null;
    if (mounted.current) setOperation(null);
  }

  async function onExport() {
    setFeedbackSection("backup");
    if (!start("export")) return;
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
      finish();
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
    if (!file || !start("read-backup")) return;
    const version = ++readVersion.current;
    setFeedbackSection("backup");
    setPrepared(null);
    setConfirmReplace(false);
    setError(null);
    setStatus(null);
    setLastBookmarksSummary(null);
    try {
      const backup = await prepareBackupFile(file);
      if (!mounted.current || version !== readVersion.current) return;
      const current = await countCurrentLibrary();
      if (mounted.current && version === readVersion.current) setPrepared({ backup, current });
    } catch (caught) {
      if (mounted.current && version === readVersion.current) {
        setError(caught instanceof BackupValidationError ? caught.message : "Couldn't read backup file.");
      }
    } finally {
      finish();
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onBookmarksFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setFeedbackSection("import");

    if (!start("read-bookmarks")) return;
    setError(null);
    setStatus(null);
    setLastBookmarksSummary(null);

    try {
      setPendingBookmarksHtml(await file.text());
      setCollectionPolicy("unsorted-only");
    } catch {
      setError("Couldn't read bookmarks file.");
    } finally {
      finish();
      if (bookmarksFileInputRef.current) {
        bookmarksFileInputRef.current.value = "";
      }
    }
  }

  function cancelImportChoice() {
    if (busy) {
      return;
    }
    readVersion.current += 1;
    setPrepared(null);
    setConfirmReplace(false);
    setStatus("Import canceled.");
  }

  async function reviewReplacement() {
    if (!prepared || !start("read-backup")) return;
    try {
      const current = await countCurrentLibrary();
      if (mounted.current) {
        setPrepared({ backup: prepared.backup, current });
        setConfirmReplace(true);
      }
    } catch {
      if (mounted.current) setError("Couldn't count the current library.");
    } finally {
      finish();
    }
  }

  function cancelBookmarksImport() {
    if (busy) {
      return;
    }
    setPendingBookmarksHtml(null);
    setStatus("Bookmarks import canceled.");
  }

  async function runImport(mode: ImportMode) {
    if (!prepared || !start("restore")) return;
    const selected = prepared.backup;
    setError(null);
    setStatus(null);
    try {
      if (mode === "merge") {
        const summary = await selected.merge();
        if (!mounted.current) return;
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        dispatchPreviewWelcome(summary.addedLinkIds);
        setStatus(`Merged: ${summary.added} added, ${summary.updated} updated, ${summary.unchanged} unchanged.`);
      } else {
        const linkIds = await selected.replace();
        if (!mounted.current) return;
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        dispatchPreviewWelcome(linkIds);
        setStatus("Library replaced from backup.");
      }
    } catch (caught) {
      if (mounted.current) setError(caught instanceof BackupValidationError ? caught.message :
        mode === "merge" ? "Couldn't merge backup." : "Couldn't replace library.");
    } finally {
      if (mounted.current) { setPrepared(null); setConfirmReplace(false); }
      finish();
    }
  }

  async function runBookmarksImport() {
    if (pendingBookmarksHtml === null) {
      return;
    }

    const html = pendingBookmarksHtml;
    if (!start("import-bookmarks")) return;
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
      finish();
    }
  }

  async function onImageFolderChange(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    setFeedbackSection("import");

    if (!start("read-images")) return;
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
      finish();
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
    if (!start("import-images")) return;

    const files = pendingImageFiles;
    const collectionName = imageCollectionDraft.trim() || undefined;
    const total = files.length;

    setPendingImageFiles(null);
    setImageQuotaWarning(null);
    setImageImportProgress({ done: 0, total, currentName: "", added: 0, reused: 0 });
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
      finish();
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
      hidden
      aria-hidden="true"
      tabIndex={-1}
      type="file"
      accept="application/json,application/zip,.json,.keepall,.zip"
      onChange={(event) => void onFileChange(event.target.files)}
    />
  );

  const bookmarksFileInput = (
    <input
      ref={bookmarksFileInputRef}
      hidden
      aria-hidden="true"
      tabIndex={-1}
      type="file"
      accept=".html,text/html,.htm"
      onChange={(event) => void onBookmarksFileChange(event.target.files)}
    />
  );

  const imageFolderInput = (
    <input
      ref={imageFolderInputRef}
      hidden
      aria-hidden="true"
      tabIndex={-1}
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
    <>
      <ModalDialog
        open={prepared !== null && !confirmReplace} busy={busy} title="Import backup"
        description="Review this validated file before choosing how to restore it."
        onOpenChange={(open) => { if (!open) cancelImportChoice(); }}
        footer={<>
          <button className={dialogButtonClass} type="button" disabled={busy} onClick={cancelImportChoice}>Cancel</button>
          <button className={`${dialogButtonClass} border-border-danger bg-bg-danger text-text-danger`}
            type="button" disabled={busy} onClick={() => void reviewReplacement()}>Replace library</button>
          <button className={`${dialogButtonClass} ui-primary`} type="button" disabled={busy}
            onClick={() => void runImport("merge")}>Merge</button>
        </>}
      >
        {prepared ? <div className="space-y-4 text-sm text-text-primary" aria-busy={busy}>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Selected backup</p>
            <p className="mt-1 [overflow-wrap:anywhere] text-base font-semibold">{prepared.backup.name}</p>
            <p className="mt-1 text-xs text-text-secondary">{formatFileSize(prepared.backup.size)} · Exported {new Date(prepared.backup.exportedAt).toLocaleString()}</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border-control border-y border-border-control" role="group" aria-label="Library totals">
            {([{ label: "Current library", counts: prepared.current }, { label: "Incoming backup", counts: prepared.backup.counts }] as const).map(({ label, counts }) => (
              <div key={label} className="min-w-0 px-3 py-3 first:pl-0 last:pr-0">
                <p className="text-xs font-medium text-text-secondary">{label}</p>
                <p className="mt-1 text-3xl font-semibold leading-none tabular-nums">{counts.total}<span className="ml-1 text-xs font-normal text-text-secondary">{counts.total === 1 ? "item" : "items"} total</span></p>
                <p className="mt-2 text-xs tabular-nums text-text-secondary">{counts.active} active · {counts.trash} in Trash</p>
              </div>
            ))}
          </div>
          <table className="w-full table-fixed text-sm tabular-nums" aria-label="Backup contents comparison">
            <colgroup><col className="w-[48%]" /><col className="w-[26%]" /><col className="w-[26%]" /></colgroup>
            <thead><tr className="text-xs text-text-secondary">
              <th scope="col" className="pb-2 text-left font-medium">Contents</th>
              <th scope="col" className="pb-2 text-right font-medium">Current</th>
              <th scope="col" className="pb-2 text-right font-medium">Incoming</th>
            </tr></thead>
            <tbody>
              {comparisonRows.map(({ label, key, Icon }, index) => (
                <tr key={key} className={index === 4 ? "border-t border-border-control" : undefined}>
                  <th scope="row" className="py-1.5 text-left font-normal"><span className="flex items-center gap-2"><Icon className="size-4 text-text-secondary" />{label}</span></th>
                  <td className="py-1.5 text-right">{prepared.current[key]}</td>
                  <td className="py-1.5 text-right font-medium">{prepared.backup.counts[key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs leading-relaxed text-text-secondary">Merge adds missing items. Matching items may take newer saved details; tags combine. Collections follow the newer item.</p>
          <p role="status" aria-live="polite">{operation === "restore" ? "Restoring library…" : ""}</p>
          {error ? <p role="alert" className="text-text-danger">{error}</p> : null}
        </div> : null}
      </ModalDialog>
      <ConfirmDialog
        open={prepared !== null && confirmReplace} title="Replace library?"
        description={prepared ? `Replace the current ${countText(prepared.current)} with ${countText(prepared.backup.counts)} from ${prepared.backup.name}? This removes the current library and cannot be undone.` : ""}
        confirmLabel="Confirm replacement" pendingLabel="Restoring library…" busy={busy}
        onConfirm={() => void runImport("replace")}
        onOpenChange={(open) => { if (!open) setConfirmReplace(false); }}
      />
    </>
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
    {operation === "import-bookmarks" ? "Importing bookmarks…" : "Import bookmarks"}
        </button>
      </>}
    >

    <p role="status" aria-live="polite">{operation === "import-bookmarks" ? "Importing bookmarks…" : ""}</p>

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
      {(operation || status) ? <p className="mt-2 text-sm text-text-primary">{operation ? operationLabels[operation] : status}</p> : null}
      {operation && operation !== "import-images" ? <progress aria-label={operationLabels[operation]} className="mt-2 h-2 w-full accent-action-primary" /> : null}
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

  const liveStatus = <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {operation === "import-images" && imageImportProgress
      ? `Importing images… ${Math.min(imageImportProgress.total, Math.floor(imageImportProgress.done / 8) * 8)} of ${imageImportProgress.total}`
      : operation ? operationLabels[operation] : status}
  </div>;

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
      <section aria-labelledby="backup-heading" aria-busy={busy}>
        {liveStatus}
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
      {liveStatus}
      <section
        className="library-panel border border-border-control bg-bg-surface p-5 sm:p-7"
        aria-labelledby="backup-heading"
        aria-busy={operation === "export" || operation === "read-backup" || operation === "restore"}
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
        aria-busy={operation === "read-bookmarks" || operation === "import-bookmarks" || operation === "read-images" || operation === "import-images"}
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
