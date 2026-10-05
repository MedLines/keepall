"use client";

import { useEffect, useRef, useState } from "react";
import { CAPTURE_FILE_ACCEPT, classifyCaptureFile } from "@/domain/capture-file";
import { readImageDirectory as readDirectory, type ImageDirectoryPicker } from "./read-image-directory";
import { storageQuotaWarningForImport } from "./storage-quota-warning";

type Props = {
  buttonClassName: string;
  disabled?: boolean;
  defaultCollectionName?: string;
  onBusyChange: (busy: boolean) => void;
  onSelect: (files: File[], collectionName: string, quotaWarning: string | null) => void;
};
export function BulkFileImport({ buttonClassName, disabled = false, defaultCollectionName = "", onBusyChange, onSelect }: Props) {
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const readingRef = useRef(false);
  const [reading, setReading] = useState<{ name: string; count: number; currentName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const locked = reading !== null;

  useEffect(() => {
    onBusyChange(locked);
    return () => onBusyChange(false);
  }, [locked, onBusyChange]);

  async function prepare(files: File[], folderName?: string) {
    if (!files.length) {
      setStatus("This folder is empty. Choose a folder containing files.");
      return;
    }
    const total = files.reduce((sum, file) => classifyCaptureFile(file).kind === "unsupported" ? sum : sum + file.size, 0);
    const quotaWarning = await storageQuotaWarningForImport(total);
    const collectionName = defaultCollectionName || folderName || "";
    onSelect(files, collectionName, quotaWarning);
  }

  async function chooseFolder() {
    const picker = (window as Window & { showDirectoryPicker?: ImageDirectoryPicker }).showDirectoryPicker;
    if (!picker) {
      folderInput.current?.click();
      return;
    }
    if (readingRef.current) return;
    readingRef.current = true;
    setError(null);
    setStatus(null);
    setReading({ name: "the selected folder", count: 0, currentName: "" });
    try {
      const directory = await picker.call(window, { mode: "read", id: "keepall-import-folder" });
      setReading({ name: directory.name, count: 0, currentName: "" });
      const files = await readDirectory(directory, (count, currentName) => setReading({ name: directory.name, count, currentName }));
      await prepare(files, directory.name);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError("Couldn't read the folder. Select it again to retry.");
      }
    } finally {
      readingRef.current = false;
      setReading(null);
    }
  }

  async function onFiles(files: FileList | null, folder: boolean) {
    if (!files?.length || readingRef.current) return;
    readingRef.current = true;
    setError(null);
    setStatus(null);
    setReading({ name: folder ? "the selected folder" : "the selected files", count: files.length, currentName: "" });
    try {
      const selected = Array.from(files);
      const folderName = folder ? selected[0].webkitRelativePath?.split("/")[0] || "Imported files" : undefined;
      await prepare(selected, folderName);
    } catch {
      setError("Couldn't read the selected files. Select them again to retry.");
    } finally {
      readingRef.current = false;
      setReading(null);
    }
  }

  return (
    <div className="grid gap-3">
      <button type="button" className={buttonClassName} disabled={disabled || locked} onClick={() => filesInput.current?.click()}>Import files</button>
      <button type="button" className={buttonClassName} disabled={disabled || locked} onClick={() => void chooseFolder()}>Import folder</button>
      <input
        ref={filesInput} hidden aria-hidden="true" tabIndex={-1} type="file" multiple accept={CAPTURE_FILE_ACCEPT} data-bulk-files
        onChange={(event) => { void onFiles(event.target.files, false); event.target.value = ""; }}
      />
      <input
        ref={folderInput} hidden aria-hidden="true" tabIndex={-1} type="file" multiple
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(event) => { void onFiles(event.target.files, true); event.target.value = ""; }}
      />
      {reading ? <div className="rounded-input border border-border-control p-3">
        <progress aria-label="Folder reading progress" className="h-2 w-full accent-action-primary" />
        <p role="status" className="mt-2 text-sm text-text-secondary">
          Reading {reading.name}… {reading.count} {reading.count === 1 ? "file" : "files"} found{reading.currentName ? ` · ${reading.currentName}` : ""}
        </p>
      </div> : null}
      {error ? <p role="alert" className="text-sm text-text-danger">{error}</p> : null}
      {!locked && status ? <p role="status" className="text-sm text-text-secondary">{status}</p> : null}
    </div>
  );
}
