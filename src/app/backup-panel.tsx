"use client";

import { useEffect, useRef, useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BookmarksImport } from "./bookmarks-import";
import { ImageFolderImport } from "./image-folder-import";
import { BackupFolderControls } from "./settings/backup-folder-controls";
import { SettingsLink } from "./settings/settings-link";
import { useRouter } from "next/navigation";
import { BackupValidationError, type BackupCounts } from "@/domain/backup";
import { exportKeepallArchive, prepareBackupFile, type PreparedBackup } from "@/persistence/backup-archive";
import { countCurrentLibrary } from "@/persistence/backup";
import { dispatchPreviewWelcome, ITEMS_CHANGED_EVENT } from "./items-events";
import { BackupIcon, ChevronDownIcon, CloseIcon, CollectionIcon, DownloadIcon, HashIcon, ImageIcon, ImagesIcon, LinkIcon, NoteIcon, UploadIcon, VideoIcon } from "./shell-icons";

type ImportMode = "merge" | "replace";
type Operation = "export" | "read-backup" | "restore";
const operationLabels: Record<Operation, string> = {
  export: "Preparing backup…", "read-backup": "Reading backup…", restore: "Restoring library…",
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

const itemRows = [
  { label: "Links", key: "links", Icon: LinkIcon },
  { label: "Notes", key: "notes", Icon: NoteIcon },
  { label: "Images", key: "images", Icon: ImageIcon },
  { label: "Videos", key: "videos", Icon: VideoIcon },
] as const;

const detailRows = [
  { label: "Tags", key: "tags", Icon: HashIcon },
  { label: "Collections", key: "collections", Icon: CollectionIcon },
  { label: "Image files", key: "imageAssets", Icon: ImagesIcon },
  { label: "Video files", key: "videoAssets", Icon: VideoIcon },
] as const;

type Props = {
  variant?: "page" | "sidebar";
  onClose?: () => void;
};

export function BackupPanel({ variant = "page", onClose }: Props) {
  const router = useRouter();
  function openImportedFolder(href: string) {
    onClose?.();
    router.push(href);
  }
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<{ backup: PreparedBackup; current: BackupCounts } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const operationRef = useRef<Operation | null>(null);
  const readVersion = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; readVersion.current += 1; };
  }, []);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [imageImportBusy, setImageImportBusy] = useState(false);
  const [bookmarksImportBusy, setBookmarksImportBusy] = useState(false);
  const [folderBackupBusy, setFolderBackupBusy] = useState(false);
  const busy = operation !== null || imageImportBusy || bookmarksImportBusy || folderBackupBusy;
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
    if (!start("export")) return;
    setError(null);
    setStatus(null);

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

  async function onFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !start("read-backup")) return;
    const version = ++readVersion.current;
    setPrepared(null);
    setConfirmReplace(false);
    setError(null);
    setStatus(null);
    try {
      const backup = await prepareBackupFile(file);
      if (!mounted.current || version !== readVersion.current) return;
      const current = await countCurrentLibrary();
      if (mounted.current && version === readVersion.current) setPrepared({ backup, current });
    } catch (caught) {
      if (mounted.current && version === readVersion.current) {
        setError(caught instanceof BackupValidationError
          ? `${caught.message}. Choose another Keepall backup.`
          : "Couldn't read backup file. Try again or choose another file.");
      }
    } finally {
      finish();
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      if (mounted.current) setError("Couldn't count the current library. Try Replace library again.");
    } finally {
      finish();
    }
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

  const dialogButtonClass =
    "ui-control min-h-10 px-4 text-sm font-medium disabled:opacity-60";

  const choiceDialog = (
    <>
      <ModalDialog
        open={prepared !== null && !confirmReplace} busy={busy} title="Import backup"
        description="Compare this backup with your library."
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
          <div className="flex min-w-0 items-start gap-3">
            <BackupIcon className="mt-0.5 text-text-secondary" />
            <div className="min-w-0 flex-1">
              <p className="[overflow-wrap:anywhere] text-base font-semibold"><bdi>{prepared.backup.name}</bdi></p>
              <p className="mt-1 text-[13px] leading-5 text-text-secondary">{formatFileSize(prepared.backup.size)} · Exported {new Date(prepared.backup.exportedAt).toLocaleString()}</p>
            </div>
          </div>
          <div>
            <table className="w-full table-fixed tabular-nums" aria-label="Backup contents comparison">
              <colgroup><col className="w-[48%]" /><col className="w-[26%]" /><col className="w-[26%]" /></colgroup>
              <thead><tr className="text-[13px] text-text-secondary">
                <th scope="col" className="pb-2 text-start font-medium">Contents</th>
                <th scope="col" className="pb-2 text-end font-medium">Current</th>
                <th scope="col" className="pb-2 text-end font-medium">Backup</th>
              </tr></thead>
              <tbody>
                <tr className="border-t border-border-control align-top">
                  <th scope="row" className="py-2 text-start text-sm font-medium">All items</th>
                  {[prepared.current, prepared.backup.counts].map((counts, index) => (
                    <td key={index} className="py-2 text-end">
                      <span className="block text-[26px] font-semibold leading-none">{counts.total}</span>
                      <span className="mt-1 block text-[13px] text-text-secondary">{counts.active} active</span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border-control">
                  <th scope="row" className="pb-2 text-start text-sm font-normal">In Trash</th>
                  <td className="pb-2 text-end text-sm">{prepared.current.trash}</td>
                  <td className="pb-2 text-end text-sm font-medium">{prepared.backup.counts.trash}</td>
                </tr>
                {itemRows.filter(({ key }) => prepared.current[key] > 0 || prepared.backup.counts[key] > 0).map(({ label, key, Icon }) => (
                  <tr key={key}>
                    <th scope="row" className="py-1.5 text-start text-sm font-normal"><span className="flex items-center gap-2"><Icon className="size-4 text-text-secondary" />{label}</span></th>
                    <td className="py-1.5 text-end text-sm">{prepared.current[key]}</td>
                    <td className="py-1.5 text-end text-sm font-medium">{prepared.backup.counts[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[13px] leading-5 text-text-secondary">Item counts include Trash.</p>
            {prepared.backup.counts.total === 0 ? <p className="mt-2 text-sm leading-5">This backup has no items. Replacing will remove your current library.</p> : null}
          </div>
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-medium focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
              Organization and media details <ChevronDownIcon className="group-open:rotate-180" />
            </summary>
            <div className="grid grid-cols-[48%_26%_26%] text-[13px] font-medium text-text-secondary" aria-hidden="true">
              <span>Details</span><span className="text-end">Current</span><span className="text-end">Backup</span>
            </div>
            <dl className="space-y-1 pb-1 text-sm tabular-nums">
              {detailRows.map(({ label, key, Icon }) => (
                <div key={key} className="grid grid-cols-[48%_26%_26%] items-center py-1">
                  <dt className="flex min-w-0 items-center gap-2"><Icon className="size-4 text-text-secondary" />{label}</dt>
                  <dd className="text-end" aria-label={`Current ${label}: ${prepared.current[key]}`}>{prepared.current[key]}</dd>
                  <dd className="text-end font-medium" aria-label={`Backup ${label}: ${prepared.backup.counts[key]}`}>{prepared.backup.counts[key]}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className="text-sm leading-6 text-text-secondary"><strong className="font-medium text-text-primary">Merge:</strong> Adds missing items. Matching items may use newer details. Tags combine; the newer item&apos;s collection wins.</p>
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
      : "ui-control inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-60";

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
      <BookmarksImport buttonClassName={buttonClass} disabled={busy} onBusyChange={setBookmarksImportBusy} />
      <ImageFolderImport buttonClassName={buttonClass} disabled={busy} onBusyChange={setImageImportBusy} onOpenFolder={openImportedFolder} />
      {fileInput}
    </div>
  );

  const feedback = (
    <>
      {(operation || status) ? <p className="mt-2 text-sm text-text-primary">{operation ? operationLabels[operation] : status}</p> : null}
      {operation ? <progress aria-label={operationLabels[operation]} className="mt-2 h-2 w-full accent-action-primary" /> : null}
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
    {operation ? operationLabels[operation] : status}
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
      </section>
    );
  }

  return (
    <>
      {liveStatus}
      <section
        className="library-panel border border-border-control bg-bg-surface p-5 sm:p-7"
        aria-labelledby="backup-heading"
        aria-busy={operation !== null || folderBackupBusy}
      >
        {heading}
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          A <code>.keepall.zip</code> copy of your library, media, and Trash.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className={`${buttonClass} ui-primary`}
            type="button"
            disabled={busy}
            onClick={() => void onExport()}
          >
            <DownloadIcon className="size-4" /> Export backup
          </button>
          <button
            className={buttonClass}
            type="button"
            disabled={busy}
            onClick={onPickImport}
          >
            <UploadIcon className="size-4" /> Import backup
          </button>
          {fileInput}
        </div>
        <p className="mt-3 text-xs leading-5 text-text-secondary">Keep exported files outside the browser. Use Import backup to recover or move your library.</p>
        <div className="mt-3"><SettingsLink href="/help/storage-and-backups#restore">Recovery guide</SettingsLink></div>
        {feedback}
        <BackupFolderControls disabled={operation !== null || imageImportBusy || bookmarksImportBusy} onBusyChange={setFolderBackupBusy} />
      </section>
      {choiceDialog}
    </>
  );
}
