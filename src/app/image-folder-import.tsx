"use client";

import { useFormatLocale, useTranslations } from "@/i18n/use-translations";
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
import { buttonClassName as controlButtonClassName } from "@/components/ui/button";

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

export function ImageFolderImport({ buttonClassName, label, disabled = false, defaultCollectionName, onBusyChange, onOpenFolder }: Props) {
  const router = useRouter();
  const t = useTranslations("ImageFolderImport");
  const locale = useFormatLocale();
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
      setStatus(t("emptyFolder"));
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
        setError(t("accessError"));
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
      setError(t("readError"));
      setPendingImageFiles(null);
    } finally {
      finish();
      if (imageFolderInputRef.current) imageFolderInputRef.current.value = "";
    }
  }

  function closeDialog() {
    if (operationRef.current) return;
    if (!completion) setStatus(t("cancelled"));
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
      setError(t("importStopped"));
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
      setError(t("openError"));
    } finally {
      finish();
    }
  }

  const dialogButtonClass = controlButtonClassName();
  const importing = imageImportProgress !== null;
  const completed = completion !== null;

  return (
    <div className="min-w-0">
      <button className={buttonClassName} type="button" disabled={disabled || busy} onClick={() => void chooseImageFolder()}>
        {label ?? t("importImages")}
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
        title={completed ? t("titleComplete") : importing ? t("titleImporting") : readingFolder ? t("titleReading") : error ? t("titleStopped") : t("title")}
        description={completed
          ? completion.savedCount > 0
            ? t("savedIn", { name: completion.collectionName ?? t("unsorted") })
            : t("noneAdded")
          : readingFolder
            ? t("finding", { name: readingFolder.name })
          : importing
            ? t("adding", { name: imageCollectionDraft.trim() || t("unsorted") })
            : t("selected", { count: pendingImageFiles?.length ?? 0 })}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
        footer={importing || readingFolder ? <span className="text-xs text-text-secondary">{readingFolder ? t("checkingFolder") : t("savingToLibrary")}</span> : <>
          <button className={dialogButtonClass} type="button" disabled={busy} onClick={closeDialog}>
            {completed ? t("done") : t("cancel")}
          </button>
          <button
            className={`${dialogButtonClass} ui-primary inline-flex items-center justify-center gap-2`}
            type="button" disabled={busy}
            onClick={() => void (completed ? openImportedFolder() : runImageFolderImport())}
          >
            {completed ? <CollectionIcon /> : null}
            {completed ? operation === "open-folder" ? t("openingFolder") : completion.collectionName ? t("openFolder") : t("openUnsorted") : error ? t("retry") : t("importImages")}
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
                <p className="text-sm text-text-primary" role="status">{t("filesFound", { count: readingFolder.count })}</p>
                <div role="progressbar" aria-label={t("readingProgressLabel")} className="h-2 overflow-hidden rounded-full bg-bg-active">
                  <div className="h-full w-1/3 bg-action-primary motion-safe:animate-pulse" />
                </div>
                <p className="min-h-5 truncate text-xs text-text-secondary">{readingFolder.currentName || t("checkingFolder")}</p>
              </div>
            ) : imageImportProgress ? (
              <div className="w-full space-y-3">
                <div className="flex items-baseline justify-between gap-3 text-sm text-text-primary" role="status" aria-live="polite">
                  <span>{t("importingProgress", { done: imageImportProgress.done, total: imageImportProgress.total })}</span>
                  <span className="tabular-nums">{new Intl.NumberFormat(locale, { style: "percent" }).format(Math.round(imageImportProgress.done / imageImportProgress.total * 100) / 100)}</span>
                </div>
                <div
                  role="progressbar" aria-label={t("importProgressLabel")}
                  aria-valuemin={0} aria-valuemax={imageImportProgress.total} aria-valuenow={imageImportProgress.done}
                  className="h-2 overflow-hidden rounded-full bg-bg-active"
                >
                  <div
                    className="h-full origin-left bg-action-primary transition-transform duration-(--motion-quick) ease-standard motion-reduce:transition-none"
                    style={{ transform: `scaleX(${imageImportProgress.done / imageImportProgress.total})` }}
                  />
                </div>
                <p className="min-h-5 truncate text-xs text-text-secondary">{imageImportProgress.currentName || t("preparing")}</p>
                <p className="text-xs text-text-secondary">{t("addedReused", { added: imageImportProgress.added, reused: imageImportProgress.reused })}</p>
              </div>
            ) : completion ? (
              <div className="space-y-2 text-center" role="status" aria-live="polite">
                <p className="text-base font-medium text-text-primary">{completion.message}</p>
                {completion.skippedDetail ? <p className="text-sm text-text-secondary">{t("skipped", { detail: completion.skippedDetail })}</p> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-text-primary">{t("collectionOptional")}</span>
              <input
                aria-label={t("collectionOptional")}
                className="ui-field min-h-11 px-3 py-2 disabled:opacity-60"
                type="text" value={imageCollectionDraft} placeholder={t("collectionPlaceholder")} disabled={busy}
                onChange={(event) => setImageCollectionDraft(event.target.value)}
              />
              <span className="text-xs leading-relaxed text-text-secondary">
                {t("collectionHelp")}
              </span>
            </label>
            {imageQuotaWarning ? <p className="text-sm text-text-warning" role="status">{imageQuotaWarning}</p> : null}
            {operation === "read-images" ? <p className="text-sm text-text-secondary" role="status">{t("readingFolder")}</p> : null}
          </>
        )}
        {error ? <p className="text-sm text-text-danger" role="alert">{error}</p> : null}
      </ModalDialog>
      {!dialogOpen && status ? <p className="mt-2 text-sm text-text-primary" role="status">{status}</p> : null}
      {!dialogOpen && error ? <p className="mt-2 text-sm text-text-danger" role="alert">{error}</p> : null}
    </div>
  );
}
