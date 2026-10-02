"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { normalizeCollectionName } from "@/domain/collection";
import { formatImageFolderImportStatus, imageFolderImportSkippedDetail, suggestImageFolderCollectionName } from "@/domain/image-folder-import";
import { listCollections } from "@/persistence/collections";
import { importImageFolder } from "@/persistence/image-folder-import";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { CollectionIcon, RefreshIcon, SelectionCheckedIcon } from "./shell-icons";
import { storageQuotaWarningForImport, sumImportableFolderBytes } from "./storage-quota-warning";
import { readImageDirectory, type ImageDirectoryPicker } from "./read-image-directory";

type Operation = "read-images" | "import-images" | "open-folder";
type ImportProgress = { done: number; total: number; currentName: string; added: number; reused: number };
type Completion = { message: string; skippedDetail: string | null; collectionName: string | null; savedCount: number };
type Props = {
  buttonClassName: string;
  label?: string;
  disabled?: boolean;
  defaultCollectionName?: string | null;
  onBusyChange: (busy: boolean) => void;
  onOpenFolder?: (href: string) => void;
};

export function ImageFolderImport({ buttonClassName, label = "Import images", disabled = false, defaultCollectionName, onBusyChange, onOpenFolder }: Props) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const imageFolderInputRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef<Operation | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[] | null>(null);
  const [imageCollectionDraft, setImageCollectionDraft] = useState("");
  const [imageQuotaWarning, setImageQuotaWarning] = useState<string | null>(null);
  const [imageImportProgress, setImageImportProgress] = useState<ImportProgress | null>(null);
  const [readingFolder, setReadingFolder] = useState<{ name: string; count: number; currentName: string } | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = operation !== null;
  const dialogOpen = pendingImageFiles !== null || completion !== null || readingFolder !== null;
  useEffect(() => {
    onBusyChange(busy || pendingImageFiles !== null);
  }, [busy, pendingImageFiles, onBusyChange]);

  function start(next: Operation): boolean {
    if (operationRef.current) return false;
    operationRef.current = next;
    setOperation(next);
    return true;
  }
  function finish() {
    operationRef.current = null;
    setOperation(null);
  }

  async function prepareImageFolder(files: File[], folderName?: string) {
    if (files.length === 0) {
      setStatus("This folder is empty. Choose a folder containing images.");
      return;
    }
    setPendingImageFiles(files);
    setImageCollectionDraft(normalizeCollectionName(defaultCollectionName || folderName || suggestImageFolderCollectionName(files)));
    setImageQuotaWarning(await storageQuotaWarningForImport(sumImportableFolderBytes(files)));
  }

  async function chooseImageFolder() {
    const picker = (window as Window & { showDirectoryPicker?: ImageDirectoryPicker }).showDirectoryPicker;
    if (!picker) {
      imageFolderInputRef.current?.click();
      return;
    }
    if (!start("read-images")) return;
    setError(null);
    setStatus(null);
    setCompletion(null);
    try {
      const directory = await picker.call(window, { mode: "read", id: "keepall-image-folder" });
      setReadingFolder({ name: directory.name, count: 0, currentName: "" });
      const files = await readImageDirectory(directory, (count, currentName) => {
        setReadingFolder({ name: directory.name, count, currentName });
      });
      await prepareImageFolder(files, directory.name);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError("Couldn't read the folder. Allow folder access, then select it again.");
      }
      setPendingImageFiles(null);
    } finally {
      setReadingFolder(null);
      finish();
    }
  }

  async function onImageFolderChange(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !start("read-images")) return;
    setError(null);
    setStatus(null);
    setCompletion(null);

    try {
      await prepareImageFolder(Array.from(fileList));
    } catch {
      setError("Couldn't read the folder. Select it again to retry.");
      setPendingImageFiles(null);
    } finally {
      finish();
      if (imageFolderInputRef.current) imageFolderInputRef.current.value = "";
    }
  }

  function closeDialog() {
    if (operationRef.current) return;
    if (!completion) setStatus("Image import canceled.");
    setPendingImageFiles(null);
    setCompletion(null);
    setImageCollectionDraft("");
    setImageQuotaWarning(null);
    setError(null);
  }

  async function runImageFolderImport() {
    if (pendingImageFiles === null || !start("import-images")) return;
    const files = pendingImageFiles;
    const collectionName = normalizeCollectionName(imageCollectionDraft) || undefined;
    setImageQuotaWarning(null);
    setImageImportProgress({ done: 0, total: files.length, currentName: "", added: 0, reused: 0 });
    setError(null);
    setStatus(null);

    try {
      const summary = await importImageFolder(files, {
        collectionName,
        batchEvery: 8,
        onBatch: () => window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT)),
        onProgress: setImageImportProgress,
      });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      const message = formatImageFolderImportStatus(summary);
      const skippedDetail = imageFolderImportSkippedDetail(summary);
      setCompletion({ message, skippedDetail, collectionName: collectionName ?? null, savedCount: summary.added + summary.reused });
      setStatus(skippedDetail ? `${message} (${skippedDetail})` : message);
      setPendingImageFiles(null);
    } catch {
      setError("Import stopped. Try again. Images already saved won't be duplicated.");
    } finally {
      setImageImportProgress(null);
      finish();
    }
  }

  async function openImportedFolder() {
    if (!completion || !start("open-folder")) return;
    setError(null);
    try {
      let href = "/?unsorted=1";
      if (completion.collectionName) {
        const collection = (await listCollections()).find((row) => row.name === completion.collectionName);
        if (!collection) throw new Error("Collection not found");
        href = `/?collection=${encodeURIComponent(collection.id)}`;
      }
      finish();
      closeDialog();
      if (onOpenFolder) onOpenFolder(href);
      else router.push(href);
    } catch {
      setError("Couldn't open the folder. Try again, or open it from the sidebar.");
    } finally {
      finish();
    }
  }

  const dialogButtonClass = "ui-control min-h-10 px-4 text-sm font-medium disabled:opacity-60";
  const importing = imageImportProgress !== null;
  const completed = completion !== null;

  return (
    <div className="min-w-0">
      <button className={buttonClassName} type="button" disabled={disabled || busy} onClick={() => void chooseImageFolder()}>
        {label}
      </button>
      <input
        ref={imageFolderInputRef}
        hidden aria-hidden="true" tabIndex={-1} type="file" multiple
        onChange={(event) => void onImageFolderChange(event.target.files)}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
      />
      <ModalDialog
        open={dialogOpen}
        busy={busy}
        title={completed ? "Import complete" : importing ? "Importing images" : readingFolder ? "Reading image folder" : error ? "Import stopped" : "Import image folder"}
        description={completed
          ? completion.savedCount > 0
            ? `Images are saved in ${completion.collectionName ?? "Unsorted"}.`
            : "No images were added. Review the skipped files below."
          : readingFolder
            ? `Finding files in ${readingFolder.name}.`
          : importing
            ? `Adding images to ${imageCollectionDraft.trim() || "Unsorted"}. Keep this window open until the import finishes.`
            : `${pendingImageFiles?.length ?? 0} file${pendingImageFiles?.length === 1 ? "" : "s"} selected. Images under 20 MiB become separate library items.`}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
        footer={importing || readingFolder ? <span className="text-xs text-text-secondary">{readingFolder ? "Checking the selected folder…" : "Saving to your library…"}</span> : <>
          <button className={dialogButtonClass} type="button" disabled={busy} onClick={closeDialog}>
            {completed ? "Done" : "Cancel"}
          </button>
          <button
            className={`${dialogButtonClass} ui-primary inline-flex items-center justify-center gap-2`}
            type="button" disabled={busy}
            onClick={() => void (completed ? openImportedFolder() : runImageFolderImport())}
          >
            {completed ? <CollectionIcon /> : null}
            {completed ? operation === "open-folder" ? "Opening folder…" : completion.collectionName ? "Open folder" : "Open Unsorted" : error ? "Retry import" : "Import images"}
          </button>
        </>}
      >
        {importing || completed || readingFolder ? (
          <div className="flex flex-col items-center gap-5 py-3">
            <div className="relative grid size-14 place-items-center rounded-panel bg-bg-active text-text-primary" aria-hidden="true">
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={completed ? "complete" : "importing"}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                  transition={{ type: "spring", duration: reducedMotion ? 0 : 0.3, bounce: 0 }}
                >
                  {completed ? <SelectionCheckedIcon className="size-7" /> : <RefreshIcon className="size-7 motion-safe:animate-spin" />}
                </motion.span>
              </AnimatePresence>
            </div>
            {readingFolder ? (
              <div className="w-full space-y-3">
                <p className="text-sm text-text-primary" role="status">{readingFolder.count} file{readingFolder.count === 1 ? "" : "s"} found</p>
                <div role="progressbar" aria-label="Reading image folder progress" className="h-2 overflow-hidden rounded-full bg-bg-active">
                  <div className="h-full w-1/3 bg-action-primary motion-safe:animate-pulse" />
                </div>
                <p className="min-h-5 truncate text-xs text-text-secondary">{readingFolder.currentName || "Checking the selected folder…"}</p>
              </div>
            ) : imageImportProgress ? (
              <div className="w-full space-y-3">
                <div className="flex items-baseline justify-between gap-3 text-sm text-text-primary" role="status" aria-live="polite">
                  <span>Importing images… {imageImportProgress.done} of {imageImportProgress.total}</span>
                  <span className="tabular-nums">{Math.round(imageImportProgress.done / imageImportProgress.total * 100)}%</span>
                </div>
                <div
                  role="progressbar" aria-label="Image folder import progress"
                  aria-valuemin={0} aria-valuemax={imageImportProgress.total} aria-valuenow={imageImportProgress.done}
                  className="h-2 overflow-hidden rounded-full bg-bg-active"
                >
                  <div
                    className="h-full origin-left bg-action-primary transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
                    style={{ transform: `scaleX(${imageImportProgress.done / imageImportProgress.total})` }}
                  />
                </div>
                <p className="min-h-5 truncate text-xs text-text-secondary">{imageImportProgress.currentName || "Preparing images…"}</p>
                <p className="text-xs text-text-secondary">{imageImportProgress.added} added · {imageImportProgress.reused} already in library</p>
              </div>
            ) : completion ? (
              <div className="space-y-2 text-center" role="status" aria-live="polite">
                <p className="text-base font-medium text-text-primary">{completion.message}</p>
                {completion.skippedDetail ? <p className="text-sm text-text-secondary">Skipped: {completion.skippedDetail}.</p> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-text-primary">Collection (optional)</span>
              <input
                aria-label="Collection (optional)"
                className="ui-field min-h-11 px-3 py-2 disabled:opacity-60"
                type="text" value={imageCollectionDraft} placeholder="e.g. Vacation 2024" disabled={busy}
                onChange={(event) => setImageCollectionDraft(event.target.value)}
              />
              <span className="text-xs leading-relaxed text-text-secondary">
                Leave blank to keep the images unsorted. Unsupported or larger files are skipped. Subfolders are not converted into collections.
              </span>
            </label>
            {imageQuotaWarning ? <p className="text-sm text-text-warning" role="status">{imageQuotaWarning}</p> : null}
            {operation === "read-images" ? <p className="text-sm text-text-secondary" role="status">Reading image folder…</p> : null}
          </>
        )}
        {error ? <p className="text-sm text-text-danger" role="alert">{error}</p> : null}
      </ModalDialog>
      {!dialogOpen && status ? <p className="mt-2 text-sm text-text-primary" role="status">{status}</p> : null}
      {!dialogOpen && error ? <p className="mt-2 text-sm text-text-danger" role="alert">{error}</p> : null}
    </div>
  );
}
