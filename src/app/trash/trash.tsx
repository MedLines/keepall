"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { itemListTitle, type Item } from "@/domain/item";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { listTrashedItems, permanentlyDeleteItem, restoreItem } from "@/persistence/items";
import { ITEMS_CHANGED_EVENT } from "../items-events";
import { ArrowLeftIcon, DeleteIcon } from "../shell-icons";
import { ThemeControl } from "../theme-control";

export function Trash() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [target, setTarget] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(50);
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    let generation = 0;
    function load() {
      const request = ++generation;
      void listTrashedItems().then((rows) => {
        if (!active || request !== generation) return;
        setItems(rows);
        setLoadError(null);
      }).catch(() => {
        if (active && request === generation) setLoadError("Couldn't load Trash. Try again.");
      }).finally(() => {
        if (active && request === generation) setLoading(false);
      });
    }
    load();
    window.addEventListener(ITEMS_CHANGED_EVENT, load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener(ITEMS_CHANGED_EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, []);

  async function act(item: Item, permanently: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (permanently) await permanentlyDeleteItem(item.id);
      else await restoreItem(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setTarget(null);
      setNotice(`${itemListTitle(item)} ${permanently ? "permanently deleted" : "restored to your library"}.`);
      heading.current?.focus();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setError(permanently ? "Couldn't permanently delete this item. Try again." : "Couldn't restore this item. Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="ui-scrollbar h-dvh overflow-y-auto bg-bg-shell p-2.5">
      <div className="library-panel min-h-full bg-bg-canvas px-5 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto w-full max-w-3xl pb-12">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="ui-control inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium">
              <ArrowLeftIcon className="size-4" />Back to library
            </Link>
            <ThemeControl />
          </header>
          <h1 ref={heading} tabIndex={-1} className="mt-10 text-3xl font-semibold tracking-tight outline-none">Trash</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Restore items to your library or delete them permanently. Items stay here until you remove them and still use storage on this device.
          </p>
          <p role="status" className="mt-3 text-sm text-text-secondary">{notice}</p>
          {loadError ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm text-text-danger">{loadError}</p>
              <button type="button" className="ui-control min-h-11 px-3 text-sm" onClick={() => window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT))}>Try again</button>
            </div>
          ) : null}
          {error && !target ? <p role="alert" className="mt-5 text-sm text-text-danger">{error}</p> : null}
          {loading ? <p className="mt-8 text-text-secondary">Loading Trash…</p> : null}
          {!loading && !loadError && items.length === 0 ? (
            <div className="library-panel mt-8 border border-border-control p-8 text-center">
              <DeleteIcon className="mx-auto size-7 text-text-secondary" />
              <h2 className="mt-3 text-lg font-medium">Trash is empty</h2>
              <p className="mt-2 text-sm text-text-secondary">Items you delete from your library will appear here.</p>
            </div>
          ) : null}
          {items.length > 0 ? (
            <section className="mt-8" aria-label="Trashed items">
              <p className="mb-3 text-sm text-text-secondary">{items.length} item{items.length === 1 ? "" : "s"}</p>
              <ul className="divide-y divide-border-control">
                {items.slice(0, limit).map((item) => (
                  <li key={item.id} className="py-5">
                    <h2 className="break-words text-base font-medium [overflow-wrap:anywhere]">{itemListTitle(item)}</h2>
                    <p className="mt-1 text-xs text-text-secondary">
                      <span className="capitalize">{item.type}</span> · Deleted {new Date(item.deletedAt!).toLocaleDateString()}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} className="ui-control min-h-11 px-4 text-sm font-medium disabled:opacity-60" onClick={() => void act(item, false)}>Restore</button>
                      <button type="button" disabled={busy} className="ui-control inline-flex min-h-11 items-center gap-2 px-4 text-sm text-text-danger disabled:opacity-60" onClick={() => { setError(null); setTarget(item); }}>
                        <DeleteIcon className="size-4" />Delete permanently
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {items.length > limit ? <button type="button" className="ui-control mt-4 min-h-11 px-4 text-sm" onClick={() => setLimit((current) => current + 50)}>Show more</button> : null}
            </section>
          ) : null}
        </div>
      </div>
      <ConfirmDialog open={target !== null} title="Permanently delete this item?"
        description={target ? `Delete “${itemListTitle(target)}” and its unshared media from this device? This cannot be undone.` : ""}
        confirmLabel="Delete permanently" pendingLabel="Deleting…" busy={busy} error={error}
        onConfirm={() => { if (target) void act(target, true); }}
        onOpenChange={(open) => { if (!open) { setTarget(null); setError(null); } }} />
    </main>
  );
}
