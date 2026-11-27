"use client";

import { useEffect, useRef, useState } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BookmarksImport } from "./bookmarks-import";
import { ImageFolderImport } from "./image-folder-import";
import { BackupFolderControls } from "./settings/backup-folder-controls";
import { SettingsLink } from "./settings/settings-link";
import { useRouter } from "next/navigation";
import { BackupValidationError, type BackupCounts, type BackupImportProgress } from "@/domain/backup";
import { exportKeepallArchive, prepareBackupFile, type PreparedBackup } from "@/persistence/backup-archive";
import { countCurrentLibrary } from "@/persistence/backup";
import { dispatchPreviewWelcome, ITEMS_CHANGED_EVENT } from "./items-events";
import { abortable } from "@/lib/abortable";
import { formatFileSize } from "@/lib/format-file-size";
import { useFormatLocale, useTranslations, type Translations } from "@/i18n/use-translations";
import { BackupIcon, ChevronDownIcon, CloseIcon, CollectionIcon, DownloadIcon, HashIcon, ImageIcon, ImagesIcon, LinkIcon, NoteIcon, UploadIcon, VideoIcon } from "./shell-icons";
import { buttonClassName, iconButtonClassName } from "@/components/ui/button";

type ImportMode = "merge" | "replace";
type Operation = "export" | "read-backup" | "restore";
type T = Translations<"BackupPanel">;
/** The backup file extension, kept out of the translated text. */
const BACKUP_FILE = ".keepall.zip";
function countText(t: T, counts: BackupCounts) {
  return t("counts", { total: counts.total, active: counts.active, trash: counts.trash });
}

function ImportProgress({ progress, cancelling }: { progress: BackupImportProgress | null; cancelling: boolean }) {
  const t = useTranslations("BackupPanel");
  const phase = progress?.phase ?? "preparing-media";
  const label = t(`progress.${phase}`);
  const total = progress?.total ?? 0;
  const completed = progress?.completed ?? 0;
  return <div className="space-y-3">
    <div role="status" aria-live="polite" aria-atomic="true" className="text-sm font-medium text-text-primary">
      <p className="flex items-center gap-2">
        <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-border-control border-t-text-primary motion-safe:animate-spin" />
        {cancelling ? t("cancellingImport") : label}
      </p>
      {total > 0 ? <p className="mt-1 tabular-nums text-text-secondary">{t(phase === "preparing-media" ? "mediaProcessed" : "itemsProcessed", { completed, total })}</p> : null}
    </div>
    <progress aria-label={label} value={total > 0 ? completed : undefined} max={total > 0 ? total : undefined}
      className="h-2 w-full accent-action-primary" />
    <p className="text-sm leading-6 text-text-secondary">{t("keepTabOpen")}</p>
    <p className="text-sm leading-6 text-text-secondary">{cancelling ? t("rollingBack") : t("cancelRollsBack")}</p>
  </div>;
}

const itemRows = [
  { key: "links", Icon: LinkIcon },
  { key: "notes", Icon: NoteIcon },
  { key: "images", Icon: ImageIcon },
  { key: "videos", Icon: VideoIcon },
  { key: "documents", Icon: NoteIcon },
] as const;

const detailRows = [
  { key: "tags", Icon: HashIcon },
  { key: "collections", Icon: CollectionIcon },
  { key: "imageAssets", Icon: ImagesIcon },
  { key: "videoAssets", Icon: VideoIcon },
  { key: "documentAssets", Icon: NoteIcon },
] as const;

type Props = {
  variant?: "page" | "sidebar";
  onClose?: () => void;
};

export function BackupPanel({ variant = "page", onClose }: Props) {
  const router = useRouter();
  const locale = useFormatLocale();
  const t = useTranslations("BackupPanel");
  function openImportedFolder(href: string) {
    onClose?.();
    router.push(href);
  }
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<{ backup: PreparedBackup; current: BackupCounts } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const operationRef = useRef<Operation | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const readVersion = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; readVersion.current += 1; importAbortRef.current?.abort(); };
  }, []);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [importProgress, setImportProgress] = useState<BackupImportProgress | null>(null);
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
    importAbortRef.current = null;
    if (mounted.current) { setOperation(null); setCancelling(false); }
  }
  function cancelRunningImport() {
    if (!importAbortRef.current || importAbortRef.current.signal.aborted) return;
    setCancelling(true);
    importAbortRef.current.abort();
  }
  function reportImportProgress(progress: BackupImportProgress) {
    if (mounted.current) setImportProgress(progress);
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
      setStatus(t("downloaded"));
    } catch {
      setError(t("exportError"));
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
    const controller = new AbortController();
    importAbortRef.current = controller;
    setPrepared(null);
    setConfirmReplace(false);
    setError(null);
    setStatus(null);
    try {
      const backup = await prepareBackupFile(file, controller.signal);
      if (!mounted.current || version !== readVersion.current) return;
      const current = await abortable(countCurrentLibrary(), controller.signal);
      if (mounted.current && version === readVersion.current) setPrepared({ backup, current });
    } catch (caught) {
      if (mounted.current && version === readVersion.current) {
        if (controller.signal.aborted) setStatus(t("readCancelled"));
        else setError(caught instanceof BackupValidationError
          ? t("invalidBackup", { reason: caught.message })
          : t("readError"));
      }
    } finally {
      finish();
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function cancelImportChoice() {
    if (busy || operationRef.current) {
      return;
    }
    readVersion.current += 1;
    setPrepared(null);
    setConfirmReplace(false);
    setStatus(t("importChoiceCancelled"));
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
      if (mounted.current) setError(t("countError"));
    } finally {
      finish();
    }
  }

  async function runImport(mode: ImportMode) {
    if (!prepared || !start("restore")) return;
    const selected = prepared.backup;
    const controller = new AbortController();
    importAbortRef.current = controller;
    setImportMode(mode);
    setImportProgress(null);
    setError(null);
    setStatus(null);
    try {
      if (mode === "merge") {
        const summary = await selected.merge(reportImportProgress, controller.signal);
        if (!mounted.current) return;
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        dispatchPreviewWelcome(summary.addedLinkIds);
        setStatus(t("merged", { added: summary.added, updated: summary.updated, unchanged: summary.unchanged }));
      } else {
        const linkIds = await selected.replace(reportImportProgress, controller.signal);
        if (!mounted.current) return;
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        dispatchPreviewWelcome(linkIds);
        setStatus(t("replaced"));
      }
    } catch (caught) {
      if (mounted.current) {
        if (controller.signal.aborted) setStatus(t("importCancelled"));
        else setError(caught instanceof BackupValidationError ? caught.message :
          mode === "merge" ? t("mergeError") : t("replaceError"));
      }
    } finally {
      if (mounted.current) { setPrepared(null); setConfirmReplace(false); setImportProgress(null); }
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
    buttonClassName();
  const restoring = operation === "restore";
  const operationLabel = cancelling ? t("cancellingImport") : restoring && importMode === "merge" ? t("mergingBackup") : operation ? t(`operations.${operation}`) : null;
  const backupName = prepared?.backup.name ?? t("backupFallbackName");

  const choiceDialog = (
    <>
      <ModalDialog
        open={prepared !== null && !confirmReplace} busy={busy} title={restoring ? t("mergingTitle") : t("importTitle")}
        description={restoring ? t("mergingDescription", { count: prepared?.backup.counts.total ?? 0, name: backupName }) : t("compareDescription")}
        onOpenChange={(open) => { if (!open) cancelImportChoice(); }}
        footer={<>
          <button className={dialogButtonClass} type="button" disabled={restoring ? cancelling : busy}
            onClick={restoring ? cancelRunningImport : cancelImportChoice}>{restoring ? cancelling ? t("cancelling") : t("cancelImport") : t("cancel")}</button>
          <button className={`${dialogButtonClass} border-border-danger bg-bg-danger text-text-danger`}
            type="button" disabled={busy} onClick={() => void reviewReplacement()}>{t("replaceLibrary")}</button>
          <button className={`${dialogButtonClass} ui-primary`} type="button" disabled={busy}
            onClick={() => void runImport("merge")}>{restoring ? t("mergingBackup") : t("merge")}</button>
        </>}
      >
        {restoring ? <ImportProgress progress={importProgress} cancelling={cancelling} /> : prepared ? <div className="space-y-4 text-sm text-text-primary" aria-busy={busy}>
          <div className="flex min-w-0 items-start gap-3">
            <BackupIcon className="mt-0.5 text-text-secondary" />
            <div className="min-w-0 flex-1">
              <p className="wrap-anywhere text-base font-semibold"><bdi>{prepared.backup.name}</bdi></p>
              <p className="mt-1 text-compact leading-5 text-text-secondary">{t("fileDetails", { size: formatFileSize(prepared.backup.size, locale), date: new Date(prepared.backup.exportedAt).toLocaleString(locale) })}</p>
            </div>
          </div>
          <div>
            <table className="w-full table-fixed tabular-nums" aria-label={t("comparisonLabel")}>
              <colgroup><col className="w-[48%]" /><col className="w-[26%]" /><col className="w-[26%]" /></colgroup>
              <thead><tr className="text-compact text-text-secondary">
                <th scope="col" className="pb-2 text-start font-medium">{t("contents")}</th>
                <th scope="col" className="pb-2 text-end font-medium">{t("current")}</th>
                <th scope="col" className="pb-2 text-end font-medium">{t("backup")}</th>
              </tr></thead>
              <tbody>
                <tr className="border-t border-border-control align-top">
                  <th scope="row" className="py-2 text-start text-sm font-medium">{t("allItems")}</th>
                  {[prepared.current, prepared.backup.counts].map((counts, index) => (
                    <td key={index} className="py-2 text-end">
                      <span className="block text-display font-semibold leading-none">{counts.total}</span>
                      <span className="mt-1 block text-compact text-text-secondary">{t("activeCount", { count: counts.active })}</span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border-control">
                  <th scope="row" className="pb-2 text-start text-sm font-normal">{t("inTrash")}</th>
                  <td className="pb-2 text-end text-sm">{prepared.current.trash}</td>
                  <td className="pb-2 text-end text-sm font-medium">{prepared.backup.counts.trash}</td>
                </tr>
                {itemRows.filter(({ key }) => prepared.current[key] > 0 || prepared.backup.counts[key] > 0).map(({ key, Icon }) => (
                  <tr key={key}>
                    <th scope="row" className="py-1.5 text-start text-sm font-normal"><span className="flex items-center gap-2"><Icon className="size-4 text-text-secondary" />{t(`rows.${key}`)}</span></th>
                    <td className="py-1.5 text-end text-sm">{prepared.current[key]}</td>
                    <td className="py-1.5 text-end text-sm font-medium">{prepared.backup.counts[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-compact leading-5 text-text-secondary">{t("countsIncludeTrash")}</p>
            {prepared.backup.counts.total === 0 ? <p className="mt-2 text-sm leading-5">{t("emptyBackup")}</p> : null}
          </div>
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-medium focus-visible:outline-1 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
              {t("detailsSummary")} <ChevronDownIcon className="group-open:rotate-180" />
            </summary>
            <div className="grid grid-cols-[48%_26%_26%] text-compact font-medium text-text-secondary" aria-hidden="true">
              <span>{t("details")}</span><span className="text-end">{t("current")}</span><span className="text-end">{t("backup")}</span>
            </div>
            <dl className="space-y-1 pb-1 text-sm tabular-nums">
              {detailRows.map(({ key, Icon }) => (
                <div key={key} className="grid grid-cols-[48%_26%_26%] items-center py-1">
                  <dt className="flex min-w-0 items-center gap-2"><Icon className="size-4 text-text-secondary" />{t(`rows.${key}`)}</dt>
                  <dd className="text-end" aria-label={t("currentValue", { label: t(`rows.${key}`), count: prepared.current[key] })}>{prepared.current[key]}</dd>
                  <dd className="text-end font-medium" aria-label={t("backupValue", { label: t(`rows.${key}`), count: prepared.backup.counts[key] })}>{prepared.backup.counts[key]}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className="text-sm leading-6 text-text-secondary">{t.rich("mergeHelp", { strong: (chunks) => <strong className="font-medium text-text-primary">{chunks}</strong> })}</p>
          {error ? <p role="alert" className="text-text-danger">{error}</p> : null}
        </div> : null}
      </ModalDialog>
      <ConfirmDialog
        open={prepared !== null && confirmReplace} title={restoring ? t("restoringTitle") : t("replaceTitle")}
        description={restoring ? t("restoringDescription", { count: prepared?.backup.counts.total ?? 0, name: backupName }) : prepared ? t("replaceDescription", { current: countText(t, prepared.current), backup: countText(t, prepared.backup.counts), name: prepared.backup.name }) : ""}
        confirmLabel={t("confirmReplacement")} pendingLabel={t("operations.restore")} busy={busy}
        cancelLabel={restoring ? t("cancelImport") : t("cancel")} onCancelWhileBusy={cancelRunningImport} cancelPending={cancelling}
        onConfirm={() => void runImport("replace")}
        onOpenChange={(open) => { if (!open && !operationRef.current) setConfirmReplace(false); }}
      >
        {restoring ? <ImportProgress progress={importProgress} cancelling={cancelling} /> : null}
      </ConfirmDialog>
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
          {t("heading")}
        </h2>
      </div>
      {onClose ? (
        <button
          type="button"
          className={iconButtonClassName({ size: "md", className: "size-9 shrink" })}
          aria-label={t("closeLabel")}
          disabled={busy}
          onClick={onClose}
        >
          <CloseIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );

  const buttonClass =
    variant === "sidebar"
      ? buttonClassName({ size: "none", className: "inline-block min-h-10 px-3 py-2 text-sm font-medium" })
      : buttonClassName({ size: "lg", className: "gap-2 py-2" });

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
        {t("export")}
      </button>
      <button
        className={buttonClass}
        type="button"
        disabled={busy}
        onClick={onPickImport}
      >
        {t("import")}
      </button>
      <BookmarksImport buttonClassName={buttonClass} disabled={busy} onBusyChange={setBookmarksImportBusy} />
      <ImageFolderImport buttonClassName={buttonClass} disabled={busy} onBusyChange={setImageImportBusy} onOpenFolder={openImportedFolder} />
      {fileInput}
    </div>
  );

  const feedback = (
    <>
      {(operation || status) ? <p className="mt-2 text-sm text-text-primary">{operationLabel ?? status}</p> : null}
      {operation ? <progress aria-label={operationLabel ?? undefined} className="mt-2 h-2 w-full accent-action-primary" /> : null}
      {operation === "read-backup" && prepared === null ? <button className={`mt-2 ${dialogButtonClass}`} type="button" disabled={cancelling}
        onClick={cancelRunningImport}>{cancelling ? t("cancelling") : t("cancelReading")}</button> : null}
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
    {operationLabel ?? status}
  </div>;

  const description =
    variant === "sidebar" ? (
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
        {t.rich("sidebarDescription", {
          file: BACKUP_FILE,
          strong: (chunks) => <strong className="font-medium">{chunks}</strong>,
          code: (chunks) => <code className="text-meta">{chunks}</code>,
        })}
      </p>
    ) : (
      <p className="mt-2 text-sm text-text-secondary">
        {t.rich("pageDescription", {
          file: BACKUP_FILE,
          strong: (chunks) => <strong className="font-medium">{chunks}</strong>,
          code: (chunks) => <code>{chunks}</code>,
        })}
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
          {t.rich("intro", { file: BACKUP_FILE, code: (chunks) => <code>{chunks}</code> })}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className={`${buttonClass} ui-primary`}
            type="button"
            disabled={busy}
            onClick={() => void onExport()}
          >
            <DownloadIcon className="size-4" /> {t("exportBackup")}
          </button>
          <button
            className={buttonClass}
            type="button"
            disabled={busy}
            onClick={onPickImport}
          >
            <UploadIcon className="size-4" /> {t("importBackup")}
          </button>
          {fileInput}
        </div>
        <p className="mt-3 text-xs leading-5 text-text-secondary">{t("keepOutside")}</p>
        <div className="mt-3"><SettingsLink href="/help/storage-and-backups#restore">{t("recoveryGuide")}</SettingsLink></div>
        {feedback}
        <BackupFolderControls disabled={operation !== null || imageImportBusy || bookmarksImportBusy} onBusyChange={setFolderBackupBusy} />
      </section>
      {choiceDialog}
    </>
  );
}
