"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { BookmarksHtmlCollectionPolicy } from "@/domain/bookmarks-html";
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
import { dispatchPreviewWelcome, ITEMS_CHANGED_EVENT } from "./items-events";
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
  const choiceDialogRef = useRef<HTMLDialogElement>(null);
  const bookmarksDialogRef = useRef<HTMLDialogElement>(null);
  const choiceTitleId = useId();
  const bookmarksTitleId = useId();
  const [pendingRaw, setPendingRaw] = useState<unknown | null>(null);
  const [pendingBookmarksHtml, setPendingBookmarksHtml] = useState<string | null>(
    null,
  );
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
      {fileInput}
      {bookmarksFileInput}
    </div>
  );

  const feedback = (
    <>
      {status ? (
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
        <strong className="font-medium">Browser</strong>: import an HTML export
        into Keepall (merge only — never wipes).
      </p>
    ) : (
      <p className="mt-2 text-sm text-zinc-600">
        <strong className="font-medium">Keepall</strong> backup: export or import
        a <code>.keepall</code> file. <strong className="font-medium">Browser</strong>
        : import an HTML export into Keepall (merge only — never wipes).
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
    </section>
  );
}
