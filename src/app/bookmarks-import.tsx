"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import type { BookmarksHtmlCollectionPolicy } from "@/domain/bookmarks-html";
import { BookmarksHtmlParseError, formatSkippedBookmarksLog, importBookmarksHtmlMerge, type BookmarksHtmlImportSummary } from "@/persistence/bookmarks-html-import";
import { dispatchPreviewWelcome, ITEMS_CHANGED_EVENT } from "./items-events";
import { abortable } from "@/lib/abortable";

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

export function BookmarksImport({ buttonClassName, label = "Import bookmarks", description, disabled = false, onBusyChange }: Props) {
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
      if (signal.aborted) setStatus("Bookmarks reading canceled.");
      else setError("Couldn't read bookmarks file.");
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
    setStatus("Bookmarks import canceled.");
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
      setStatus(
        `${summary.cancelled ? "Bookmark import canceled. Completed bookmarks are kept." : "Bookmarks:"} ${summary.added} added, ${summary.merged} merged, ${summary.skipped} skipped.`,
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

  const dialogButtonClass = "ui-control min-h-10 px-4 text-sm font-medium disabled:opacity-60";

  const bookmarksDialog = (
    <ModalDialog
      open={pendingBookmarksHtml !== null} busy={busy} title="Import browser bookmarks"
      description="Choose how browser folders update collections when links already exist."
      onOpenChange={(open) => { if (!open) cancelBookmarksImport(); }}
      footer={<>
        <button
          className={dialogButtonClass}
          type="button"
          disabled={cancelling}
          onClick={busy ? cancelRunningImport : cancelBookmarksImport}
        >
          {busy ? cancelling ? "Canceling…" : "Cancel import" : "Cancel"}
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

    {operation === "import-bookmarks" ? <div className="space-y-2">
      <p role="status" aria-live="polite">{cancelling ? "Canceling import… Finishing the current bookmark." : "Importing bookmarks…"}{progress ? ` ${progress.done} of ${progress.total} bookmarks processed.` : ""}</p>
      <progress aria-label="Bookmark import progress" value={progress?.done} max={progress?.total || undefined} className="h-2 w-full accent-action-primary" />
      <p className="text-xs leading-relaxed text-text-secondary">Cancel stops before the next bookmark. Completed bookmarks stay in your library.</p>
    </div> : null}

    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm font-medium text-text-primary">
        When a link already exists, which collection wins?
      </legend>
      <p className="text-xs leading-relaxed text-text-secondary">
        Browser tags are always added. This choice only controls browser
        folders and Keepall collections.
      </p>
      <label className="bookmark-import-option ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm has-[:checked]:bg-bg-active">
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
      <label className="bookmark-import-option ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm has-[:checked]:bg-bg-active">
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
      <label className="bookmark-import-option ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm has-[:checked]:bg-bg-active">
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

  return (
    <div className="min-w-0">
      <button className={buttonClassName} type="button" aria-describedby={description ? descriptionId : undefined} disabled={disabled || busy} onClick={() => bookmarksFileInputRef.current?.click()}>
        {label}
      </button>
      {description ? <p id={descriptionId} className="mt-2 text-xs leading-relaxed text-text-secondary">{description}</p> : null}
      {bookmarksFileInput}
      {bookmarksDialog}
      {operation || status ? (
        <p className="mt-2 text-sm text-text-primary" role="status" aria-live="polite">
          {operation === "read-bookmarks" ? "Reading bookmarks…" : operation ? "Importing bookmarks…" : status}
        </p>
      ) : null}
      {operation ? <progress aria-label="Bookmark import progress" className="mt-2 h-2 w-full accent-action-primary" /> : null}
      {operation === "read-bookmarks" ? <button className={`${dialogButtonClass} mt-2`} type="button" disabled={cancelling}
        onClick={cancelRunningImport}>{cancelling ? "Canceling…" : "Cancel reading"}</button> : null}
      {lastBookmarksSummary && lastBookmarksSummary.skippedRows.length > 0 ? (
        <button className="mt-2 text-left text-sm font-medium text-text-primary underline" type="button" onClick={onDownloadSkippedLog}>
          Download skipped links (.txt)
        </button>
      ) : null}
      {error ? <p className="mt-2 text-sm text-text-danger" role="alert">{error}</p> : null}
    </div>
  );
}
