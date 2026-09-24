import { assetToBlob, getAsset } from "@/persistence/assets";
import { getThumbnail } from "@/persistence/thumbnails";

const MAX_IDLE_URLS = 16;
const IDLE_URL_TTL_MS = 30_000;

type CacheEntry = {
  key: string;
  refs: number;
  url: string | null;
  promise: Promise<string | null>;
  disposeTimer: ReturnType<typeof setTimeout> | null;
  releasedAt: number;
};

const entries = new Map<string, CacheEntry>();

function dispose(entry: CacheEntry): void {
  if (entry.refs > 0 || entries.get(entry.key) !== entry) return;
  if (entry.disposeTimer) clearTimeout(entry.disposeTimer);
  if (entry.url) URL.revokeObjectURL(entry.url);
  entries.delete(entry.key);
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

function createEntry(key: string, loadBlob: () => Promise<Blob | null>): CacheEntry {
  const entry: CacheEntry = {
    key,
    refs: 0,
    url: null,
    promise: Promise.resolve(null),
    disposeTimer: null,
    releasedAt: 0,
  };
  entries.set(key, entry);
  entry.promise = loadBlob()
    .then((blob) => {
      if (!blob || entries.get(key) !== entry) return null;
      entry.url = URL.createObjectURL(blob);
      return entry.url;
    })
    .catch(() => {
      if (entries.get(key) === entry) entries.delete(key);
      return null;
    });
  return entry;
}

function acquireObjectUrl(key: string, loadBlob: () => Promise<Blob | null>): {
  promise: Promise<string | null>;
  release: () => void;
} {
  const entry = entries.get(key) ?? createEntry(key, loadBlob);
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

export function acquireAssetObjectUrl(id: string) {
  return acquireObjectUrl(`asset:${id}`, async () => {
    const asset = await getAsset(id);
    return asset ? assetToBlob(asset) : null;
  });
}

export function acquireThumbnailObjectUrl(id: string) {
  return acquireObjectUrl(`thumbnail:${id}`, () => getThumbnail(id));
}

export function clearAssetObjectUrlCache(): void {
  for (const entry of entries.values()) {
    entry.refs = 0;
    dispose(entry);
  }
}
