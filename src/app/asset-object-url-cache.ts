import { assetToBlob, getAsset } from "@/persistence/assets";

const MAX_IDLE_URLS = 16;
const IDLE_URL_TTL_MS = 30_000;

type CacheEntry = {
  id: string;
  refs: number;
  url: string | null;
  promise: Promise<string | null>;
  disposeTimer: ReturnType<typeof setTimeout> | null;
  releasedAt: number;
};

const entries = new Map<string, CacheEntry>();

function dispose(entry: CacheEntry): void {
  if (entry.refs > 0 || entries.get(entry.id) !== entry) return;
  if (entry.disposeTimer) clearTimeout(entry.disposeTimer);
  if (entry.url) URL.revokeObjectURL(entry.url);
  entries.delete(entry.id);
}

function trimIdleEntries(): void {
  const idle = [...entries.values()]
    .filter((entry) => entry.refs === 0)
    .sort((left, right) => left.releasedAt - right.releasedAt);
  for (const entry of idle.slice(0, Math.max(0, idle.length - MAX_IDLE_URLS))) {
    dispose(entry);
  }
}

function scheduleDispose(entry: CacheEntry): void {
  entry.releasedAt = Date.now();
  if (entry.disposeTimer) clearTimeout(entry.disposeTimer);
  entry.disposeTimer = setTimeout(() => dispose(entry), IDLE_URL_TTL_MS);
  trimIdleEntries();
}

function createEntry(id: string): CacheEntry {
  const entry: CacheEntry = {
    id,
    refs: 0,
    url: null,
    promise: Promise.resolve(null),
    disposeTimer: null,
    releasedAt: 0,
  };
  entries.set(id, entry);
  entry.promise = getAsset(id)
    .then((asset) => {
      if (!asset || entries.get(id) !== entry) return null;
      entry.url = URL.createObjectURL(assetToBlob(asset));
      return entry.url;
    })
    .catch(() => {
      if (entries.get(id) === entry) entries.delete(id);
      return null;
    });
  return entry;
}

export function acquireAssetObjectUrl(id: string): {
  promise: Promise<string | null>;
  release: () => void;
} {
  const entry = entries.get(id) ?? createEntry(id);
  entry.refs += 1;
  if (entry.disposeTimer) {
    clearTimeout(entry.disposeTimer);
    entry.disposeTimer = null;
  }
  let released = false;

  return {
    promise: entry.promise,
    release: () => {
      if (released) return;
      released = true;
      entry.refs = Math.max(0, entry.refs - 1);
      if (entry.refs === 0) scheduleDispose(entry);
    },
  };
}

export function clearAssetObjectUrlCache(): void {
  for (const entry of entries.values()) {
    entry.refs = 0;
    dispose(entry);
  }
}
