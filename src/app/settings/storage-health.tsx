"use client";

import { useEffect, useState } from "react";
import { RefreshIcon } from "../shell-icons";

type StorageHealthSnapshot = {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
};

async function readStorageHealth(): Promise<StorageHealthSnapshot> {
  const storage =
    typeof navigator === "undefined" ? undefined : navigator.storage;
  const [estimateResult, persistedResult] = await Promise.allSettled([
    Promise.resolve().then(() => storage?.estimate?.()),
    Promise.resolve().then(() => storage?.persisted?.()),
  ]);
  const estimate =
    estimateResult.status === "fulfilled" ? estimateResult.value : undefined;
  const persisted =
    persistedResult.status === "fulfilled" ? persistedResult.value : undefined;

  return {
    usage:
      typeof estimate?.usage === "number" &&
      Number.isFinite(estimate.usage) &&
      estimate.usage >= 0
        ? estimate.usage
        : null,
    quota:
      typeof estimate?.quota === "number" &&
      Number.isFinite(estimate.quota) &&
      estimate.quota > 0
        ? estimate.quota
        : null,
    persisted: typeof persisted === "boolean" ? persisted : null,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
  return `${formatted} ${units[unit]}`;
}

export function StorageHealth() {
  const [snapshot, setSnapshot] = useState<StorageHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const placeholder = loading && !snapshot ? "Checking…" : "Unavailable";
  const usage =
    snapshot?.usage == null ? placeholder : formatBytes(snapshot.usage);
  const quota =
    snapshot?.quota == null ? placeholder : formatBytes(snapshot.quota);
  const persistence =
    snapshot?.persisted == null
      ? placeholder
      : snapshot.persisted
        ? "Granted"
        : "Not granted";
  const usedPercent = snapshot?.usage != null && snapshot.quota != null
    ? Math.min(100, snapshot.usage / snapshot.quota * 100)
    : null;

  useEffect(() => {
    let cancelled = false;
    void readStorageHealth().then((next) => {
      if (cancelled) return;
      setSnapshot(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    const next = await readStorageHealth();
    setSnapshot(next);
    setLoading(false);
  }

  return (
    <div className="mt-5 border-t border-border-control pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-primary">
          Browser storage health
        </p>
        <button
          className="ui-control inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium"
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshIcon className="size-4" />
          {loading && snapshot ? "Refreshing…" : "Refresh storage status"}
        </button>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3" aria-live="polite">
        <div>
          <dt className="text-xs text-text-secondary">Site storage used</dt>
          <dd className="mt-1 text-sm font-medium text-text-primary">{usage}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-secondary">Estimated allowance</dt>
          <dd className="mt-1 text-sm font-medium text-text-primary">{quota}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-secondary">Persistent storage</dt>
          <dd className="mt-1 text-sm font-medium text-text-primary">
            {persistence}
          </dd>
        </div>
      </dl>
      {usedPercent !== null ? <div
        role="meter"
        aria-label="Estimated storage usage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usedPercent}
        aria-valuetext={`${usage} used out of ${quota}`}
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg-raised"
      ><div className="h-full rounded-full bg-text-primary" style={{ width: `${usedPercent}%` }} /></div> : null}
      <p className="mt-4 text-xs leading-5 text-text-secondary">
        Usage and allowance are estimates, including offline files. Persistent
        storage reduces automatic clearing; it is not a backup.
      </p>
    </div>
  );
}
