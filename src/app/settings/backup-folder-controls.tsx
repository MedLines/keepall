"use client";

import { useEffect, useRef, useState } from "react";
import { BackupFolderError } from "@/persistence/backup-folder";
import { BackupIcon, ClockIcon, EditIcon } from "../shell-icons";
import {
  backupFailureMessage, chooseBackupFolder, connectBackupFolder, disableBackupFolder,
  observeBackupFolderStatus, saveFolderBackup, supportsFolderBackups,
  type BackupFolderHandle, type BackupFolderSettings,
} from "@/persistence/backup-settings";

type View = { supported: boolean; settings?: BackupFolderSettings; permission: PermissionState; hasPendingChanges?: boolean };
type Action = "choose" | "save" | "reconnect";

function useBackupFolderView() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError("Couldn't read the backup folder settings. Reload this page to try again.");
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
  return { view, error };
}

function useBackupFolderActions(disabled: boolean, onBusyChange?: (busy: boolean) => void) {
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
        throw new BackupFolderError("permission-required", "Folder access wasn't granted. Reconnect again or export a backup.");
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
    catch { setError("Couldn't turn off folder backups. Try again."); }
    finally { setTurningOff(false); }
  }

  return { action, turningOff, error, choose, reconnect, turnOff, save: () => void run("save", saveFolderBackup) };
}

function statusLabel(settings: BackupFolderSettings | undefined, action: Action | null, permission: PermissionState, failed: boolean) {
  if (settings && !settings.enabled) return "Off";
  if (action === "choose") return "Choosing folder…";
  if (action === "reconnect") return "Reconnecting…";
  if (action === "save") return "Saving…";
  if (!settings?.enabled) return "Off";
  if (permission !== "granted") return "Reconnect needed";
  return failed ? "Backup failed" : "Connected";
}

function FolderBackupDetails({ settings, hasPendingChanges }: { settings: BackupFolderSettings; hasPendingChanges?: boolean }) {
  const lastBackup = settings.completed.at(-1);
  return <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2" aria-live="polite">
    <div className="min-w-0"><dt className="text-xs text-text-secondary">Backup folder</dt>
      <dd className="mt-1 [overflow-wrap:anywhere] font-medium"><bdi>{settings.directory.name}</bdi></dd></div>
    <div><dt className="text-xs text-text-secondary">Last verified backup</dt>
      <dd className="mt-1 font-medium">{lastBackup ? <time dateTime={new Date(lastBackup.completedAt).toISOString()}>{new Date(lastBackup.completedAt).toLocaleString()}</time> : "No completed backup yet"}</dd></div>
    {settings.enabled && lastBackup ? <div className="sm:col-span-2"><dt className="text-xs text-text-secondary">Backup coverage</dt>
      <dd className="mt-1 flex items-center gap-2 font-medium">{hasPendingChanges ? <><EditIcon className="size-4 text-text-secondary" />Changes waiting for backup</> : <><BackupIcon className="size-4 text-text-secondary" />Up to date</>}</dd></div> : null}
  </dl>;
}

const buttonClass = "ui-control min-h-10 px-4 py-2 text-sm font-medium disabled:opacity-60";

function FolderBackupButtons({ settings, needsAccess, disabled, actions }: {
  settings?: BackupFolderSettings;
  needsAccess: boolean;
  disabled: boolean;
  actions: ReturnType<typeof useBackupFolderActions>;
}) {
  const busy = actions.action !== null || actions.turningOff;
  if (!settings) return <div className="mt-4">
    <button type="button" className={`${buttonClass} ui-primary`} disabled={disabled || busy} onClick={actions.choose}>Choose backup folder</button>
  </div>;
  return <div className="mt-4 flex flex-wrap gap-2">
    {settings.enabled && !needsAccess ? <button type="button" className={buttonClass} disabled={disabled || busy} onClick={actions.save}>Back up now</button> :
      <button type="button" className={buttonClass} disabled={disabled || busy} onClick={() => actions.reconnect(settings.directory)}>{settings.enabled ? "Reconnect folder" : "Enable folder backups"}</button>}
    <button type="button" className={buttonClass} disabled={disabled || busy} onClick={actions.choose}>Change folder</button>
    {settings.enabled ? <button type="button" className={buttonClass} disabled={disabled || actions.turningOff} onClick={() => void actions.turnOff()}>Turn off folder backups</button> : null}
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
  return <>
    <p className="mt-3 text-xs leading-5 text-text-secondary">
      Use a dedicated, empty <span className="font-medium">Keepall Backups</span> folder.
      Keepall gets read and write access to everything inside it. Your browser may remember access for future visits and app updates.
    </p>
    {settings ? <FolderBackupDetails settings={settings} hasPendingChanges={view.hasPendingChanges} /> : null}
    <FolderBackupButtons settings={settings} needsAccess={needsAccess} disabled={disabled} actions={actions} />
    {actions.action ? <progress className="mt-3 h-2 w-full accent-action-primary" aria-label={actions.action === "save" ? "Saving folder backup" : status} /> : null}
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-text-primary" aria-label="Folder backup schedule">
      <li className="flex items-center gap-2"><ClockIcon className="size-4" />Every 30 minutes</li>
      <li className="flex items-center gap-2"><EditIcon className="size-4" />Changes only</li>
      <li className="flex items-center gap-2"><BackupIcon className="size-4" />Latest 3 copies</li>
    </ul>
    <p className="mt-3 text-xs leading-5 text-text-secondary">Runs while Keepall is open. Sleeping or inactive tabs may delay it. Background checks never ask for permission.</p>
    {settings && !enabled ? <p className="mt-2 text-xs leading-5 text-text-secondary">Folder backups are off. Saved files stay in your folder.</p> : null}
    {settings?.cleanupWarning && enabled ? <p className="mt-2 text-sm text-text-secondary">{settings.cleanupWarning}</p> : null}
  </>;
}

export function BackupFolderControls({ disabled = false, onBusyChange }: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { view, error } = useBackupFolderView();
  const actions = useBackupFolderActions(disabled, onBusyChange);
  const settings = view?.settings;
  const enabled = settings?.enabled ?? false;
  const failure = actions.error ?? error ?? (enabled ? settings?.lastError : null);
  const status = statusLabel(settings, actions.action, view?.permission ?? "prompt", !!failure);

  return (
    <div className="mt-6 border-t border-border-control pt-5" aria-labelledby="folder-backups-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="folder-backups-heading" className="text-sm font-semibold text-text-primary">Folder backups</h3>
        {view?.supported ? <span className="text-xs text-text-secondary" aria-live="polite">{status}</span> : null}
      </div>
      <p className="mt-1 text-sm leading-6 text-text-secondary">Automatically save recovery copies to a folder on this device.</p>
      {!view ? <p className="mt-3 text-sm text-text-secondary">Checking folder backups…</p> : !view.supported ? (
        <p className="mt-3 text-sm leading-6 text-text-secondary">Folder backups are not supported in this browser. Use Export backup above to download a recovery copy.</p>
      ) : <FolderBackupContent view={view} disabled={disabled} actions={actions} status={status} />}
      {failure ? <p className="mt-3 text-sm text-text-danger" role="alert">{failure}</p> : null}
    </div>
  );
}
