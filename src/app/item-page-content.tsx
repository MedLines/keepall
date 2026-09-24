"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getItem } from "@/persistence/items";
import { ImageItemPage } from "./image-item-page";
import { LinkItemPage } from "./link-item-page";
import { NoteItemPage } from "./note-item-page";
import { VideoItemPage } from "./video-item-page";

export function ItemPageContent({ itemId, returnHref }: { itemId: string; returnHref: string }) {
  const [type, setType] = useState<"loading" | "image" | "link" | "note" | "video" | "missing" | "error">("loading");

  useEffect(() => {
    let active = true;
    void getItem(itemId)
      .then((item) => {
        if (active) {
          setType(
            item?.type === "image" || item?.type === "link" || item?.type === "note" || item?.type === "video"
              ? item.type
              : "missing",
          );
        }
      })
      .catch(() => {
        if (active) setType("error");
      });
    return () => {
      active = false;
    };
  }, [itemId]);

  if (type === "image") return <ImageItemPage itemId={itemId} returnHref={returnHref} />;
  if (type === "link") return <LinkItemPage itemId={itemId} returnHref={returnHref} />;
  if (type === "note") return <NoteItemPage itemId={itemId} returnHref={returnHref} />;
  if (type === "video") return <VideoItemPage itemId={itemId} returnHref={returnHref} />;
  const message =
    type === "loading"
      ? "Loading item…"
      : type === "error"
        ? "Couldn't load this item."
        : "Item not found.";
  return (
    <main className="grid min-h-dvh place-items-center bg-bg-canvas p-5">
      <div className="text-center">
        <p className="text-text-secondary">{message}</p>
        <Link
          href={returnHref}
          className="ui-control mt-5 inline-flex min-h-10 items-center px-4"
        >
          Return to library
        </Link>
      </div>
    </main>
  );
}
