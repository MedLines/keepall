"use client";

import { useEffect } from "react";
import { supportsFolderBackups } from "@/persistence/backup-settings";
import { startBackupScheduler } from "@/persistence/backup-scheduler";

export function AutomaticBackupRunner() {
  useEffect(() => {
    // Extension bridge frames save library data but must not start a backup job.
    if (window.self === window.top && supportsFolderBackups()) return startBackupScheduler();
  }, []);
  return null;
}
