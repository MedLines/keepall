"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getItem } from "@/persistence/items";
import { ImageItemPage } from "./image-item-page";
import { LinkItemPage } from "./link-item-page";
import { NoteItemPage } from "./note-item-page";
import { VideoItemPage } from "./video-item-page";
import { DocumentItemPage } from "./document-item-page";

import { readItemNavigation } from "./item-navigation-snapshot";
import { ItemPageLoading } from "./library-loading-content";

export function ItemPageContent({ itemId, returnHref }: { itemId: string; returnHref: string }) {
  const [initialSnapshot] = useState(() => readItemNavigation(itemId));
  const [loadedType, setType] = useState<"loading" | "image" | "link" | "note" | "video" | "document" | "missing" | "error">(initialSnapshot?.item.type ?? "loading");

  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadedItemId, setLoadedItemId] = useState(itemId);
  const type = loadedItemId === itemId ? loadedType : "loading";

  useEffect(() => {
    let active = true;
    void getItem(itemId)
      .then((item) => {
        if (active) {
          setLoadedItemId(itemId);
          setType(
            item?.type === "image" || item?.type === "link" || item?.type === "note" || item?.type === "video" || item?.type === "document"
              ? item.type
              : "missing",
          );
        }
      })
      .catch(() => {
        if (active) { setLoadedItemId(itemId); setType("error"); }
      });
    return () => {
      active = false;
    };
  }, [itemId, loadAttempt]);

  if (type === "image") return <ImageItemPage key={itemId} itemId={itemId} returnHref={returnHref} initialSnapshot={initialSnapshot} />;
  if (type === "link") return <LinkItemPage itemId={itemId} returnHref={returnHref} />;
  if (type === "note") return <NoteItemPage key={itemId} itemId={itemId} returnHref={returnHref} initialSnapshot={initialSnapshot} />;
  if (type === "video") return <VideoItemPage itemId={itemId} returnHref={returnHref} />;
  if (type === "document") return <DocumentItemPage key={itemId} itemId={itemId} returnHref={returnHref} initialSnapshot={initialSnapshot} />;
  if (type === "loading") return <ItemPageLoading returnHref={returnHref} />;
  const message =
    type === "error"
        ? "Couldn't load this item. Try loading again."
        : "Item not found. It may be in Trash.";
  return (
    <main className="grid min-h-dvh place-items-center bg-bg-canvas p-5">
      <div className="text-center">
        <p role={type === "error" ? "alert" : "status"} className="text-text-secondary">{message}</p>
        {type === "error" ? <button type="button" className="ui-control mt-5 inline-flex min-h-10 items-center px-4" onClick={() => { setType("loading"); setLoadAttempt(attempt => attempt + 1); }}>Retry</button> : null}
        <Link
          href={returnHref}
          className="ui-control mt-5 inline-flex min-h-10 items-center px-4"
        >
          Return to library
        </Link>
        {type === "missing" ? <Link href="/trash" className="ui-control ml-2 inline-flex min-h-10 items-center px-4">Open Trash</Link> : null}
      </div>
    </main>
  );
}
