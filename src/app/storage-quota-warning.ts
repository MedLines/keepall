import { MAX_LOCAL_IMAGE_BYTES } from "@/domain/image";

/**
 * Warn when a folder import would push browser storage near its limit.
 * Returns user-facing copy, or null when no warning is needed.
 */
export async function storageQuotaWarningForImport(
  additionalBytes: number,
): Promise<string | null> {
  if (additionalBytes <= 0) {
    return null;
  }
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    if (additionalBytes >= 50 * 1024 * 1024) {
      return "This import is large (50MB+). IndexedDB may run out of space on some browsers.";
    }
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    if (quota <= 0) {
      return null;
    }
    const projected = usage + additionalBytes;
    const ratio = projected / quota;
    if (ratio >= 0.85) {
      const pct = Math.round(ratio * 100);
      return `Storage would be about ${pct}% full after this import. Consider exporting a backup first.`;
    }
    if (additionalBytes >= 100 * 1024 * 1024 && ratio >= 0.6) {
      return "This import is large. You may want a backup before continuing.";
    }
  } catch {
    return null;
  }

  return null;
}

export function sumImportableFolderBytes(files: File[]): number {
  let total = 0;
  for (const file of files) {
    if (file.size > 0 && file.size <= MAX_LOCAL_IMAGE_BYTES) {
      total += file.size;
    }
  }
  return total;
}
