"use client";

import { useRef, useState } from "react";
import { BackupValidationError } from "@/domain/backup";
import {
  exportKeepallBackup,
  importKeepallBackupReplace,
  libraryHasLocalData,
} from "@/persistence/backup";
import { ITEMS_CHANGED_EVENT } from "./items-events";

export function BackupPanel({ variant = "page" }: { variant?: "page" | "sidebar" }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function onPickFile() {
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
      if (await libraryHasLocalData()) {
        const confirmed = window.confirm(
          "Replace all local Keepall data with this backup? This cannot be undone.",
        );
        if (!confirmed) {
          setStatus("Import canceled.");
          return;
        }
      }

      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        throw new BackupValidationError("Backup file is not valid JSON");
      }

      await importKeepallBackupReplace(raw);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      setStatus("Backup imported.");
    } catch (caught) {
      if (caught instanceof BackupValidationError) {
        setError(caught.message);
      } else {
        setError("Couldn't import backup.");
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  if (variant === "sidebar") {
    return (
      <section aria-labelledby="backup-heading">
        <h2 className="text-sm font-semibold text-zinc-900" id="backup-heading">
          Backup
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          Export a versioned <code className="text-[11px]">.keepall</code> file, or
          replace this browser&apos;s library from one.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            className="rounded-[10px] border border-zinc-200/80 bg-white px-3 py-2 text-sm font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
            type="button"
            disabled={busy}
            onClick={() => void onExport()}
          >
            Export backup
          </button>
          <button
            className="rounded-[10px] border border-zinc-200/80 bg-white px-3 py-2 text-sm font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
            type="button"
            disabled={busy}
            onClick={() => void onPickFile()}
          >
            Import backup
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json,.keepall"
            onChange={(event) => void onFileChange(event.target.files)}
          />
        </div>
        {status ? <p className="mt-2 text-xs text-zinc-700">{status}</p> : null}
        {error ? (
          <p className="mt-2 text-xs text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6" aria-labelledby="backup-heading">
      <h2 className="text-lg font-semibold" id="backup-heading">
        Backup
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        Export a versioned <code>.keepall</code> file, or replace this browser's
        library from one. Import replaces everything after validation.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
          type="button"
          disabled={busy}
          onClick={() => void onExport()}
        >
          Export backup
        </button>
        <button
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60"
          type="button"
          disabled={busy}
          onClick={() => void onPickFile()}
        >
          Import backup
        </button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="application/json,.json,.keepall"
          onChange={(event) => void onFileChange(event.target.files)}
        />
      </div>
      {status ? <p className="mt-2 text-sm text-zinc-700">{status}</p> : null}
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
