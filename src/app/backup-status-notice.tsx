"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { observeBackupFolderSettings, supportsFolderBackups, type BackupFolderSettings } from "@/persistence/backup-settings";

type Issue = { key: string; needsAccess: boolean };

export function BackupStatusNotice() {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!supportsFolderBackups()) return;
    let mounted = true;
    let version = 0;
    let settings: BackupFolderSettings | undefined;
    async function refresh() {
      const current = ++version;
      let permission: PermissionState = "granted";
      if (settings?.enabled) {
        try { permission = await settings.directory.queryPermission({ mode: "readwrite" }); }
        catch { permission = "denied"; }
      }
      if (!mounted || current !== version) return;
      const needsAccess = permission !== "granted";
      const next = settings?.enabled && (needsAccess || settings.lastError) ? {
        key: JSON.stringify([settings.connectionId, needsAccess, settings.lastError]), needsAccess,
      } : null;
      setIssue(next);
      // Recovery ends the dismissed episode, even if the same problem returns later.
      if (!next) setDismissed(null);
    }
    const stop = observeBackupFolderSettings((next) => { settings = next; void refresh(); }, () => {
      ++version;
      if (mounted) setIssue(null);
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

  if (!issue || issue.key === dismissed) return null;
  return <aside aria-label="Folder backup needs attention" className="mb-3 flex flex-wrap items-center gap-3 rounded-control-lg border border-border-control bg-bg-raised p-3 text-sm">
    <p role="status" className="min-w-0 flex-1 basis-48 text-text-secondary">
      {issue.needsAccess ? "Folder backups paused. Reconnect your folder to resume." : "Folder backup failed. Check folder access and disk space, then try again or export a backup."}
    </p>
    <Link href="/settings#backup-heading" className="ui-control inline-flex min-h-10 items-center px-3 font-medium">
      {issue.needsAccess ? "Reconnect folder" : "Review backups"}
    </Link>
    <button type="button" className="ui-control min-h-10 px-3" onClick={() => setDismissed(issue.key)}>Dismiss</button>
  </aside>;
}
