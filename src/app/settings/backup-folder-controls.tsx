"use client";

import { useFormatLocale, useTranslations, type Translations } from "@/i18n/use-translations";
import { useEffect, useRef, useState } from "react";
import { BackupFolderError } from "@/persistence/backup-folder";
import { BackupIcon, ClockIcon, EditIcon } from "../shell-icons";
import {
  backupFailureMessage, chooseBackupFolder, connectBackupFolder, disableBackupFolder,
  observeBackupFolderStatus, saveFolderBackup, supportsFolderBackups,
  type BackupFolderHandle, type BackupFolderSettings,
} from "@/persistence/backup-settings";
import { buttonClassName } from "@/components/ui/button";

type View = { supported: boolean; settings?: BackupFolderSettings; permission: PermissionState; hasPendingChanges?: boolean };
type Action = "choose" | "save" | "reconnect";
type T = Translations<"BackupFolder">;

function useBackupFolderView(t: T) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<"read" | null>(null);

  useEffect(() => {
    let mounted = true;
    let version = 0;
    let settings: BackupFolderSettings | undefined;
    let hasPendingChanges = true;
    async function refresh() {
      const currentVersion = ++version;
      let permission: PermissionState = "prompt";
      if (settings?.enabled) {
        try { permission = await settings.directory.queryPermission({ mode: "readwrite" }); }
        catch { permission = "denied"; }
      }
      if (mounted && version === currentVersion) setView({ supported: supportsFolderBackups(), settings, permission, hasPendingChanges });
    }
    const stop = observeBackupFolderStatus((next) => { settings = next.settings; hasPendingChanges = next.hasPendingChanges; void refresh(); }, () => {
      if (mounted) {
        setView({ supported: supportsFolderBackups(), permission: "prompt" });
        setError("read");
      }
    });
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      mounted = false;
      stop();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return { view, error: error === "read" ? t("readError") : null };
}

function useBackupFolderActions(t: T, disabled: boolean, onBusyChange?: (busy: boolean) => void) {
  const [action, setAction] = useState<Action | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
    onBusyChange?.(false);
  }, [onBusyChange]);

  async function run(next: Action, job: (signal: AbortSignal) => Promise<void>) {
    if (active.current || disabled || turningOff) return;
    const controller = new AbortController();
    active.current = controller;
    setAction(next);
    setError(null);
    onBusyChange?.(true);
    try { await job(controller.signal); }
    catch (caught) {
      if (!controller.signal.aborted) setError(backupFailureMessage(caught));
    } finally {
      if (active.current === controller) {
        active.current = null;
        setAction(null);
        onBusyChange?.(false);
      }
    }
  }

  function choose() {
    void run("choose", async (signal) => {
      const directory = await chooseBackupFolder();
      if (directory) {
        signal.throwIfAborted();
        setAction("save");
        await connectBackupFolder(directory, signal);
      }
    });
  }

  function reconnect(directory: BackupFolderHandle) {
    void run("reconnect", async (signal) => {
      // Request access only here, while handling the user's reconnect/enable click.
      if (await directory.requestPermission({ mode: "readwrite" }) !== "granted") {
        throw new BackupFolderError("permission-required", t("permissionNotGranted"));
      }
      signal.throwIfAborted();
      setAction("save");
      await connectBackupFolder(directory, signal);
    });
  }

  async function turnOff() {
    if (turningOff || disabled) return;
    active.current?.abort();
    setTurningOff(true);
    setError(null);
    try { await disableBackupFolder(); }
    catch { setError(t("turnOffError")); }
    finally { setTurningOff(false); }
  }

  return { action, turningOff, error, choose, reconnect, turnOff, save: () => void run("save", saveFolderBackup) };
}

function statusLabel(t: T, settings: BackupFolderSettings | undefined, action: Action | null, permission: PermissionState, failed: boolean) {
  if (settings && !settings.enabled) return t("status.off");
  if (action === "choose") return t("status.choosing");
  if (action === "reconnect") return t("status.reconnecting");
  if (action === "save") return t("status.saving");
  if (!settings?.enabled) return t("status.off");
  if (permission !== "granted") return t("status.reconnectNeeded");
  return failed ? t("status.failed") : t("status.connected");
}

function FolderBackupDetails({ settings, hasPendingChanges }: { settings: BackupFolderSettings; hasPendingChanges?: boolean }) {
  const lastBackup = settings.completed.at(-1);
  const locale = useFormatLocale();
  const t = useTranslations("BackupFolder");
  return <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2" aria-live="polite">
    <div className="min-w-0"><dt className="text-xs text-text-secondary">{t("folder")}</dt>
      <dd className="mt-1 wrap-anywhere font-medium"><bdi>{settings.directory.name}</bdi></dd></div>
    <div><dt className="text-xs text-text-secondary">{t("lastVerified")}</dt>
      <dd className="mt-1 font-medium">{lastBackup ? <time dateTime={new Date(lastBackup.completedAt).toISOString()}>{new Date(lastBackup.completedAt).toLocaleString(locale)}</time> : t("noBackupYet")}</dd></div>
    {settings.enabled && lastBackup ? <div className="sm:col-span-2"><dt className="text-xs text-text-secondary">{t("coverage")}</dt>
      <dd className="mt-1 flex items-center gap-2 font-medium">{hasPendingChanges ? <><EditIcon className="size-4 text-text-secondary" />{t("pendingChanges")}</> : <><BackupIcon className="size-4 text-text-secondary" />{t("upToDate")}</>}</dd></div> : null}
  </dl>;
}

const buttonClass = buttonClassName({ className: "py-2" });

function FolderBackupButtons({ settings, needsAccess, disabled, actions }: {
  settings?: BackupFolderSettings;
  needsAccess: boolean;
  disabled: boolean;
  actions: ReturnType<typeof useBackupFolderActions>;
}) {
  const busy = actions.action !== null || actions.turningOff;
  const t = useTranslations("BackupFolder");
  if (!settings) return <div className="mt-4">
    <button type="button" className={`${buttonClass} ui-primary`} disabled={disabled || busy} onClick={actions.choose}>{t("choose")}</button>
  </div>;
  return <div className="mt-4 flex flex-wrap gap-2">
    {settings.enabled && !needsAccess ? <button type="button" className={buttonClass} disabled={disabled || busy} onClick={actions.save}>{t("backUpNow")}</button> :
      <button type="button" className={buttonClass} disabled={disabled || busy} onClick={() => actions.reconnect(settings.directory)}>{settings.enabled ? t("reconnect") : t("enable")}</button>}
    <button type="button" className={buttonClass} disabled={disabled || busy} onClick={actions.choose}>{t("changeFolder")}</button>
    {settings.enabled ? <button type="button" className={buttonClass} disabled={disabled || actions.turningOff} onClick={() => void actions.turnOff()}>{t("turnOff")}</button> : null}
  </div>;
}

function FolderBackupContent({ view, disabled, actions, status }: {
  view: View;
  disabled: boolean;
  actions: ReturnType<typeof useBackupFolderActions>;
  status: string;
}) {
  const settings = view.settings;
  const enabled = settings?.enabled ?? false;
  const needsAccess = enabled && view.permission !== "granted";
  const t = useTranslations("BackupFolder");
  return <>
    <p className="mt-3 text-xs leading-5 text-text-secondary">
      {t.rich("intro", { name: (chunks) => <span className="font-medium">{chunks}</span> })}
    </p>
    {settings ? <FolderBackupDetails settings={settings} hasPendingChanges={view.hasPendingChanges} /> : null}
    <FolderBackupButtons settings={settings} needsAccess={needsAccess} disabled={disabled} actions={actions} />
    {actions.action ? <progress className="mt-3 h-2 w-full accent-action-primary" aria-label={actions.action === "save" ? t("savingProgress") : status} /> : null}
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-text-primary" aria-label={t("schedule")}>
      <li className="flex items-center gap-2"><ClockIcon className="size-4" />{t("every30Minutes")}</li>
      <li className="flex items-center gap-2"><EditIcon className="size-4" />{t("changesOnly")}</li>
      <li className="flex items-center gap-2"><BackupIcon className="size-4" />{t("latestCopies")}</li>
    </ul>
    <p className="mt-3 text-xs leading-5 text-text-secondary">{t("runsWhileOpen")}</p>
    {settings && !enabled ? <p className="mt-2 text-xs leading-5 text-text-secondary">{t("offNote")}</p> : null}
    {settings?.cleanupWarning && enabled ? <p className="mt-2 text-sm text-text-secondary">{settings.cleanupWarning}</p> : null}
  </>;
}

export function BackupFolderControls({ disabled = false, onBusyChange }: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useTranslations("BackupFolder");
  const { view, error } = useBackupFolderView(t);
  const actions = useBackupFolderActions(t, disabled, onBusyChange);
  const settings = view?.settings;
  const enabled = settings?.enabled ?? false;
  const failure = actions.error ?? error ?? (enabled ? settings?.lastError : null);
  const status = statusLabel(t, settings, actions.action, view?.permission ?? "prompt", !!failure);

  return (
    <div className="mt-6 border-t border-border-control pt-5" aria-labelledby="folder-backups-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="folder-backups-heading" className="text-sm font-semibold text-text-primary">{t("heading")}</h3>
        {view?.supported ? <span className="text-xs text-text-secondary" aria-live="polite">{status}</span> : null}
      </div>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{t("description")}</p>
      {!view ? <p className="mt-3 text-sm text-text-secondary">{t("checking")}</p> : !view.supported ? (
        <p className="mt-3 text-sm leading-6 text-text-secondary">{t("unsupported")}</p>
      ) : <FolderBackupContent view={view} disabled={disabled} actions={actions} status={status} />}
      {failure ? <p className="mt-3 text-sm text-text-danger" role="alert">{failure}</p> : null}
    </div>
  );
}
