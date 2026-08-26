export type PersistentStorageStatus = "granted" | "denied" | "unavailable";

/**
 * Ask the browser to keep this origin's storage (including IndexedDB)
 * when under pressure. Never throws.
 */
export async function requestPersistentStorage(): Promise<PersistentStorageStatus> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return "unavailable";
  }

  try {
    const persisted = await navigator.storage.persist();
    return persisted ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

export function persistentStorageMessage(
  status: PersistentStorageStatus,
): string {
  switch (status) {
    case "granted":
      return "Storage on this device is marked persistent.";
    case "denied":
      return "Storage may be cleared under browser pressure.";
    case "unavailable":
      return "Persistent storage is not available in this browser.";
  }
}
