export const PREVIEW_WELCOME_STORAGE_KEY = "keepall:preview-welcome-batch";

export type StoredWelcomeBatch = {
  total: number;
  done: number;
  remainingLinkIds: string[];
};

export function readStoredWelcomeBatch(): StoredWelcomeBatch | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(PREVIEW_WELCOME_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredWelcomeBatch;
    if (
      typeof parsed.total !== "number" ||
      typeof parsed.done !== "number" ||
      !Array.isArray(parsed.remainingLinkIds)
    ) {
      return null;
    }
    if (parsed.remainingLinkIds.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredWelcomeBatch(batch: StoredWelcomeBatch | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!batch || batch.remainingLinkIds.length === 0) {
    window.localStorage.removeItem(PREVIEW_WELCOME_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(PREVIEW_WELCOME_STORAGE_KEY, JSON.stringify(batch));
}

export function clearStoredWelcomeBatch(): void {
  writeStoredWelcomeBatch(null);
}
