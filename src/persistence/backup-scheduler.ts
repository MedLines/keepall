import { observeBackupFolderSettings, runScheduledFolderBackup } from "./backup-settings";

/** Timers may be throttled; startup and visibility checks catch up when the app returns. */
export function startBackupScheduler(): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let connectionId: string | undefined;

  async function check() {
    if (stopped || controller || document.visibilityState !== "visible") return;
    const job = new AbortController();
    controller = job;
    try { await runScheduledFolderBackup(Date.now(), job.signal); }
    catch { /* A transient database failure is retried at the next check. */ }
    finally { if (controller === job) controller = null; }
  }
  const resume = () => { void check(); };
  const stopObserving = observeBackupFolderSettings((settings) => {
    if (!settings?.enabled || (connectionId && connectionId !== settings.connectionId)) controller?.abort();
    connectionId = settings?.connectionId;
    resume();
  }, () => {});
  const timer = window.setInterval(resume, 60_000);
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", resume);
  resume();
  return () => {
    stopped = true;
    controller?.abort();
    stopObserving();
    window.clearInterval(timer);
    window.removeEventListener("focus", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}
