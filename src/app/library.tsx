"use client";

import { useEffect, useState } from "react";
import { itemListTitle, type Item } from "@/domain/item";
import { listItems } from "@/persistence/items";
import { ITEMS_CHANGED_EVENT } from "./items-events";

export function Library() {
  const [items, setItems] = useState<Item[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function reload() {
      setLoadState("loading");
      setError(null);

      try {
        const next = await listItems();
        if (!cancelled) {
          setItems(next);
          setLoadState("ready");
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Couldn't load items.");
          setLoadState("error");
        }
      }
    }

    void reload();
    window.addEventListener(ITEMS_CHANGED_EVENT, reload);

    return () => {
      cancelled = true;
      window.removeEventListener(ITEMS_CHANGED_EVENT, reload);
    };
  }, []);

  return (
    <section className="mt-8" aria-labelledby="library-heading">
      <h2 className="text-lg font-semibold" id="library-heading">
        Library
      </h2>
      {loadState === "loading" ? (
        <p className="mt-3 text-sm text-zinc-600">Loading…</p>
      ) : loadState === "error" ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error ?? "Couldn't load items."}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">No items yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {items.map((item) => (
            <li
              className="rounded-md border border-zinc-200 bg-white p-4"
              key={item.id}
            >
              <h3 className="font-medium">{itemListTitle(item)}</h3>
              {item.type === "note" ? (
                <p className="mt-2 whitespace-pre-wrap text-zinc-800">
                  {item.content}
                </p>
              ) : (
                <p className="mt-2">
                  <a
                    className="break-all text-zinc-800 underline"
                    href={item.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {item.url}
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
