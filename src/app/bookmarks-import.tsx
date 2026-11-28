"use client";

import { useTranslations } from "@/i18n/use-translations";
import { useEffect, useId, useRef, useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import type { BookmarksHtmlCollectionPolicy } from "@/domain/bookmarks-html";
import { BookmarksHtmlParseError, formatSkippedBookmarksLog, importBookmarksHtmlMerge, type BookmarksHtmlImportSummary } from "@/persistence/bookmarks-html-import";
import { dispatchPreviewWelcome, ITEMS_CHANGED_EVENT } from "./items-events";
import { abortable } from "@/lib/abortable";
import { buttonClassName as controlButtonClassName } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

type Operation = "read-bookmarks" | "import-bookmarks";
type Props = {
  buttonClassName: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
};

export function BookmarksImport({ buttonClassName, label, description, disabled = false, onBusyChange }: Props) {
  const t = useTranslations("BookmarksImport");
  const descriptionId = useId();
  const bookmarksFileInputRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef<Operation | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [pendingBookmarksHtml, setPendingBookmarksHtml] = useState<string | null>(null);
  const [collectionPolicy, setCollectionPolicy] = useState<BookmarksHtmlCollectionPolicy>("unsorted-only");
  const [lastBookmarksSummary, setLastBookmarksSummary] = useState<BookmarksHtmlImportSummary | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = operation !== null;
  useEffect(() => {
    onBusyChange(busy || pendingBookmarksHtml !== null);
  }, [busy, pendingBookmarksHtml, onBusyChange]);

  function start(next: Operation): boolean {
    if (operationRef.current) return false;
    operationRef.current = next;
    setOperation(next);
    abortRef.current = new AbortController();
    setCancelling(false);
    setProgress(null);
    return true;
  }
  function finish() {
    operationRef.current = null;
    abortRef.current = null;
    setOperation(null);
    setCancelling(false);
    setProgress(null);
  }
  function cancelRunningImport() {
    if (!abortRef.current || abortRef.current.signal.aborted) return;
    setCancelling(true);
    abortRef.current.abort();
  }

  async function onBookmarksFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    if (!start("read-bookmarks")) return;
    const signal = abortRef.current!.signal;
    setError(null);
    setStatus(null);
    setLastBookmarksSummary(null);

    try {
      setPendingBookmarksHtml(await abortable(file.text(), signal));
      setCollectionPolicy("unsorted-only");
    } catch {
      if (signal.aborted) setStatus(t("readCancelled"));
      else setError(t("readError"));
    } finally {
      finish();
      if (bookmarksFileInputRef.current) {
        bookmarksFileInputRef.current.value = "";
      }
    }
  }

  function cancelBookmarksImport() {
    if (busy) {
      return;
    }
    setPendingBookmarksHtml(null);
    setStatus(t("choiceCancelled"));
  }

  async function runBookmarksImport() {
    if (pendingBookmarksHtml === null) {
      return;
    }

    const html = pendingBookmarksHtml;
    if (!start("import-bookmarks")) return;
    const signal = abortRef.current!.signal;
    setError(null);
    setStatus(null);

    try {
      const summary = await importBookmarksHtmlMerge(html, { collectionPolicy, signal, onProgress: (done, total) => setProgress({ done, total }) });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      dispatchPreviewWelcome(summary.addedLinkIds);
      setLastBookmarksSummary(summary);
      setStatus(t(summary.cancelled ? "summaryCancelled" : "summary", { added: summary.added, merged: summary.merged, skipped: summary.skipped }));
      setPendingBookmarksHtml(null);
    } catch (caught) {
      if (caught instanceof BookmarksHtmlParseError) {
        setError(caught.message);
      } else {
        setError(t("importError"));
      }
      setPendingBookmarksHtml(null);
    } finally {
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

  const dialogButtonClass = controlButtonClassName();

  const bookmarksDialog = (
    <ModalDialog
      open={pendingBookmarksHtml !== null} busy={busy} title={t("dialogTitle")}
      description={t("dialogDescription")}
      onOpenChange={(open) => { if (!open) cancelBookmarksImport(); }}
      footer={<>
        <button
          className={dialogButtonClass}
          type="button"
          disabled={cancelling}
          onClick={busy ? cancelRunningImport : cancelBookmarksImport}
        >
          {busy ? cancelling ? t("cancelling") : t("cancelImport") : t("cancel")}
        </button>
        <button
          className={`${dialogButtonClass} ui-primary`}
          type="button"
          disabled={busy}
          onClick={() => void runBookmarksImport()}
        >
          {operation === "import-bookmarks" ? t("importing") : t("importBookmarks")}
        </button>
      </>}
    >

    {operation === "import-bookmarks" ? <div className="space-y-2">
      <p role="status" aria-live="polite">{progress
        ? t(cancelling ? "cancellingImportProgress" : "importingProgress", { done: progress.done, total: progress.total })
        : t(cancelling ? "cancellingImport" : "importing")}</p>
      <progress aria-label={t("progressLabel")} value={progress?.done} max={progress?.total || undefined} className="h-2 w-full accent-action-primary" />
      <p className="text-xs leading-relaxed text-text-secondary">{t("cancelNote")}</p>
    </div> : null}

    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm font-medium text-text-primary">
        {t("policyLegend")}
      </legend>
      <p className="text-xs leading-relaxed text-text-secondary">
        {t("policyNote")}
      </p>
      <RadioCard className="bookmark-import-option" inputClassName="mt-0.5" name="collection-policy" disabled={busy} checked={collectionPolicy === "unsorted-only"} onChange={() => setCollectionPolicy("unsorted-only")}>
        <span>
          <span className="font-medium">{t("unsortedOnlyTitle")}</span>
          <span className="mt-0.5 block text-xs text-text-secondary">
            {t("unsortedOnlyDescription")}
          </span>
        </span>
      </RadioCard>
      <RadioCard className="bookmark-import-option" inputClassName="mt-0.5" name="collection-policy" disabled={busy} checked={collectionPolicy === "keep"} onChange={() => setCollectionPolicy("keep")}>
        <span>
          <span className="font-medium">{t("keepTitle")}</span>
          <span className="mt-0.5 block text-xs text-text-secondary">
            {t("keepDescription")}
          </span>
        </span>
      </RadioCard>
      <RadioCard className="bookmark-import-option" inputClassName="mt-0.5" name="collection-policy" disabled={busy} checked={collectionPolicy === "apply"} onChange={() => setCollectionPolicy("apply")}>
        <span>
          <span className="font-medium">{t("applyTitle")}</span>
          <span className="mt-0.5 block text-xs text-text-secondary">
            {t("applyDescription")}
          </span>
        </span>
      </RadioCard>
    </fieldset>
    </ModalDialog>
  );

  return (
    <div className="min-w-0">
      <button className={buttonClassName} type="button" aria-describedby={description ? descriptionId : undefined} disabled={disabled || busy} onClick={() => bookmarksFileInputRef.current?.click()}>
        {label ?? t("importBookmarks")}
      </button>
      {description ? <p id={descriptionId} className="mt-2 text-xs leading-relaxed text-text-secondary">{description}</p> : null}
      {bookmarksFileInput}
      {bookmarksDialog}
      {operation || status ? (
        <p className="mt-2 text-sm text-text-primary" role="status" aria-live="polite">
          {operation === "read-bookmarks" ? t("reading") : operation ? t("importing") : status}
        </p>
      ) : null}
      {operation ? <progress aria-label={t("progressLabel")} className="mt-2 h-2 w-full accent-action-primary" /> : null}
      {operation === "read-bookmarks" ? <button className={`${dialogButtonClass} mt-2`} type="button" disabled={cancelling}
        onClick={cancelRunningImport}>{cancelling ? t("cancelling") : t("cancelReading")}</button> : null}
      {lastBookmarksSummary && lastBookmarksSummary.skippedRows.length > 0 ? (
        <button className="mt-2 text-left text-sm font-medium text-text-primary underline" type="button" onClick={onDownloadSkippedLog}>
          {t("downloadSkipped")}
        </button>
      ) : null}
      {error ? <p className="mt-2 text-sm text-text-danger" role="alert">{error}</p> : null}
    </div>
  );
}
