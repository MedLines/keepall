"use client";

import { useTranslations } from "@/i18n/use-translations";
import { useEffect, useState } from "react";
import { pendingFileId } from "@/domain/agent-files";
import { decodeTextDocument } from "@/domain/document";
import type { Item } from "@/domain/item";
import { getPendingFile } from "@/persistence/agent-files";
import { DocumentIcon } from "./document-icon";
import { ItemTypeBadge } from "./item-type-icon";
import { LibraryTextPreview } from "./library-text-preview";
import { NoteContent } from "./note-content";
import { VideoPlayer } from "./video-player";

/** The waiting files an unsaved item shows, or null for an item already in the library. */
export function pendingFileIds(item: Item): string[] | null {
  const assets = item.type === "image" ? item.assetIds : item.type === "video" || item.type === "document" ? [item.assetId] : [];
  const ids = assets.map(pendingFileId);
  return ids.length && ids.every((id): id is string => id !== undefined) ? ids : null;
}

const PREVIEW_CHARACTERS = 30_000;

type Loaded = { url: string; text: string | null; name: string } | "missing";

/** A waiting file as an object URL, and its text for Markdown and text files. Revoked when it's no longer shown. */
function usePendingFile(fileId: string, wantText: boolean): Loaded | null {
  const [loaded, setLoaded] = useState<{ id: string; value: Loaded } | null>(null);
  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    void getPendingFile(fileId).then((row) => {
      if (cancelled) return;
      if (!row) {
        setLoaded({ id: fileId, value: "missing" });
        return;
      }
      let text: string | null = null;
      if (wantText) {
        try { text = decodeTextDocument(row.bytes); } catch { text = null; }
      }
      if (cancelled) return;
      url = URL.createObjectURL(new Blob([row.bytes as BlobPart], { type: row.mimeType }));
      setLoaded({ id: fileId, value: { url, text, name: row.name } });
    }, () => setLoaded({ id: fileId, value: "missing" }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId, wantText]);
  return loaded?.id === fileId ? loaded.value : null;
}

function Missing() {
  const t = useTranslations("Capture");
  return <p className="flex size-full items-center justify-center p-3 text-center text-xs text-text-secondary">{t("fileMissing")}</p>;
}

/** A library-card thumbnail for an item that isn't saved yet, drawn from its waiting file. */
export function PendingFileThumbnail({ item }: { item: Item }) {
  const [fileId] = pendingFileIds(item) ?? [""];
  const isText = item.type === "document" && item.format !== "pdf";
  const file = usePendingFile(fileId, isText);
  if (file === "missing") return <Missing />;
  if (!file) return <span className="block size-full bg-bg-raised" />;
  if (item.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- A local object URL; next/image can't optimize it.
    return <img src={file.url} alt="" className="media-squircle-inset size-full object-cover" />;
  }
  if (item.type === "video") return <video src={file.url} muted preload="metadata" className="media-squircle-inset size-full object-cover" aria-hidden="true" />;
  if (item.type === "document" && isText) {
    return (
      <span className="library-reading-inset media-squircle-inset flex size-full flex-col text-left">
        <span aria-hidden="true" className="block h-8 shrink-0" />
        <LibraryTextPreview text={file.text ?? ""} markdown={item.format === "markdown"} />
        <ItemTypeBadge item={item} />
      </span>
    );
  }
  return (
    <span className="flex size-full flex-col items-center justify-center gap-2 bg-bg-raised p-3 text-center">
      {item.type === "document" ? <DocumentIcon format={item.format} className="size-8" /> : null}
      <span className="line-clamp-2 text-xs text-text-secondary">{file.name}</span>
    </span>
  );
}

/** The review's full view of an unsaved item: every image, the video, the PDF, or the rendered text. */
export function PendingFileContent({ item }: { item: Item }) {
  const ids = pendingFileIds(item) ?? [];
  if (item.type === "image") {
    return (
      <div className="grid h-full auto-rows-fr gap-2 overflow-y-auto p-4 sm:grid-cols-2">
        {ids.map((id) => <PendingImage key={id} fileId={id} />)}
      </div>
    );
  }
  return <PendingSingle item={item} fileId={ids[0] ?? ""} />;
}

function PendingImage({ fileId }: { fileId: string }) {
  const file = usePendingFile(fileId, false);
  if (file === "missing") return <Missing />;
  if (!file) return <span className="block min-h-40 rounded-control-md bg-bg-raised" />;
  // eslint-disable-next-line @next/next/no-img-element -- A local object URL; next/image can't optimize it.
  return <img src={file.url} alt={file.name} className="size-full max-h-[60dvh] rounded-control-md object-contain" />;
}

function PendingSingle({ item, fileId }: { item: Item; fileId: string }) {
  const isText = item.type === "document" && item.format !== "pdf";
  const file = usePendingFile(fileId, isText);
  const t = useTranslations("Capture");
  if (file === "missing") return <Missing />;
  if (!file) return <span className="block size-full" />;
  if (item.type === "video") return <div className="flex h-full items-center justify-center p-4"><VideoPlayer src={file.url} title={item.title} onError={() => {}} /></div>;
  if (item.type === "document" && item.format === "pdf") {
    return <iframe src={file.url} title={file.name} className="size-full border-0 bg-bg-raised" />;
  }
  // Enough to judge the file; a whole long file would hold up the review while it renders.
  const text = file.text ?? "";
  const shown = text.length > PREVIEW_CHARACTERS ? text.slice(0, text.lastIndexOf("\n", PREVIEW_CHARACTERS) + 1 || PREVIEW_CHARACTERS) : text;
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <NoteContent content={shown} format={item.type === "document" && item.format === "markdown" ? "markdown" : "plain"} allowLocalImages={false} />
      {shown.length < text.length ? <p className="mt-4 text-xs text-text-secondary">{t("previewTruncated")}</p> : null}
    </div>
  );
}
