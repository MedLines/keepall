"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BackupValidationError } from "@/domain/backup";
import {
  exportKeepallBackup,
  importKeepallBackupMerge,
  importKeepallBackupReplace,
} from "@/persistence/backup";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { BackupIcon, CloseIcon } from "./shell-icons";

type ImportMode = "merge" | "replace";

type Props = {
  variant?: "page" | "sidebar";
  onClose?: () => void;
};

export function BackupPanel({ variant = "page", onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const choiceDialogRef = useRef<HTMLDialogElement>(null);
  const choiceTitleId = useId();
  const [pendingRaw, setPendingRaw] = useState<unknown | null>(null);
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

  async function onExport() {
    setBusy(true);
    setError(null);
    setStatus(null);

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

  async function onFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

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

  function cancelImportChoice() {
    if (busy) {
      return;
    }
    setPendingRaw(null);
    setStatus("Import canceled.");
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
        setStatus(
          `Merged: ${summary.added} added, ${summary.updated} updated, ${summary.unchanged} unchanged.`,
        );
      } else {
        await importKeepallBackupReplace(raw);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
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

  const fileInput = (
    <input
      ref={fileInputRef}
      className="sr-only"
      type="file"
      accept="application/json,.json,.keepall"
      onChange={(event) => void onFileChange(event.target.files)}
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

  const actions = (
    <div
      className={
        variant === "sidebar" ? "mt-3 flex flex-col gap-2" : "mt-3 flex flex-wrap gap-3"
      }
    >
      <button
        className={
          variant === "sidebar"
            ? "rounded-[10px] border border-zinc-200/80 bg-white px-3 py-2 text-sm font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
            : "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
        }
        type="button"
        disabled={busy}
        onClick={() => void onExport()}
      >
        Export
      </button>
      <button
        className={
          variant === "sidebar"
            ? "rounded-[10px] border border-zinc-200/80 bg-white px-3 py-2 text-sm font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
            : "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
        }
        type="button"
        disabled={busy}
        onClick={onPickImport}
      >
        Import
      </button>
      {fileInput}
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

  if (variant === "sidebar") {
    return (
      <section aria-labelledby="backup-heading">
        {heading}
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          Export a <code className="text-[11px]">.keepall</code> file, or import
          one to merge with this library or replace it.
        </p>
        {actions}
        {feedback}
        {choiceDialog}
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6" aria-labelledby="backup-heading">
      {heading}
      <p className="mt-2 text-sm text-zinc-600">
        Export a versioned <code>.keepall</code> file, or import one to merge
        with this library (laptop ↔ PC) or replace it.
      </p>
      {actions}
      {feedback}
      {choiceDialog}
    </section>
  );
}
