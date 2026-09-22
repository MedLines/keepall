"use client";

import { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { noteImageMarkers, removeNoteImageMarkerAt } from "@/domain/note";
import { NoteContent } from "./note-content";
import { NoteFormatControl } from "./note-format-control";
import { useAssetObjectUrl } from "./use-asset-object-url";

type Props = {
  itemId: string;
  content: string;
  format: "plain" | "markdown";
  error: string | null;
  busy: boolean;
  saving: boolean;
  setFirstEditField: (node: HTMLTextAreaElement | null) => void;
  onContentChange: (content: string) => void;
  onFormatChange: (format: "plain" | "markdown") => void;
  onSaveShortcut: (event: KeyboardEvent<HTMLTextAreaElement>, save: () => void) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddImages?: (files: File[], start: number, end: number) => void;
  onRemoveImage?: (index: number) => void;
  pendingImageUrls?: ReadonlyMap<string, string>;
};

function NoteEditorImageRow({ assetId, index, pendingImageUrls, busy, onRemove }: {
  assetId: string;
  index: number;
  pendingImageUrls?: ReadonlyMap<string, string>;
  busy: boolean;
  onRemove: () => void;
}) {
  const pendingUrl = pendingImageUrls?.get(assetId);
  const savedUrl = useAssetObjectUrl(pendingUrl ? null : assetId);
  const url = pendingUrl ?? savedUrl;

  return (
    <li className="flex items-center gap-3 border-t border-border-control py-2 first:border-t-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local IndexedDB object URL
        <img src={url} alt="" className="size-12 shrink-0 rounded-control border border-border-control object-cover" />
      ) : (
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-control border border-border-control bg-bg-control text-xs text-text-secondary">Image</span>
      )}
      <span className="min-w-0 flex-1 text-sm">Image {index + 1}</span>
      <button
        type="button"
        className="ui-control min-h-9 rounded-control px-3 text-sm"
        aria-label={`Remove image ${index + 1}`}
        disabled={busy}
        onClick={onRemove}
      >
        Remove
      </button>
    </li>
  );
}

export function NoteEditor({
  itemId,
  content,
  format,
  error,
  busy,
  saving,
  setFirstEditField,
  onContentChange,
  onFormatChange,
  onSaveShortcut,
  onSave,
  onCancel,
  onAddImages,
  onRemoveImage,
  pendingImageUrls,
}: Props) {
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef({ start: content.length, end: content.length });
  const showPreview = preview;
  const imageMarkers = noteImageMarkers(content);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [content, showPreview]);

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium" htmlFor={`edit-note-${itemId}`}>Note content</label>
        <NoteFormatControl format={format} disabled={busy} onChange={onFormatChange} />
      </div>
      <div role="group" aria-label="Note editor view" className="flex gap-1">
        <button type="button" aria-pressed={!showPreview} className={`ui-control min-h-9 px-3 text-sm ${!showPreview ? "ui-selected text-text-primary" : ""}`} onClick={() => setPreview(false)}>Write</button>
        <button type="button" aria-pressed={showPreview} className={`ui-control min-h-9 px-3 text-sm ${showPreview ? "ui-selected text-text-primary" : ""}`} onClick={() => setPreview(true)}>Preview</button>
      </div>
      {onAddImages ? (
        <div>
          <p className="mb-2 text-sm text-text-secondary">In Write, place the cursor between paragraphs. Then add an image.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
            multiple
            className="sr-only"
            aria-label="Choose note images"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) onAddImages(files, selectionRef.current.start, selectionRef.current.end);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="ui-control min-h-9 rounded-control px-3 text-sm"
            disabled={busy || showPreview}
            onClick={() => {
              const textarea = textareaRef.current;
              if (textarea) selectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
              fileInputRef.current?.click();
            }}
          >
            Add image at cursor
          </button>
        </div>
      ) : null}
      {imageMarkers.length > 0 ? (
        <section aria-label="Images in this note" className="border-y border-border-control py-3">
          <p role="status" className="mb-2 text-sm font-medium">
            {imageMarkers.length} {imageMarkers.length === 1 ? "image" : "images"} in this note
          </p>
          <ul>
            {imageMarkers.map((marker, index) => (
              <NoteEditorImageRow
                key={`${marker.assetId}-${index}`}
                assetId={marker.assetId}
                index={index}
                pendingImageUrls={pendingImageUrls}
                busy={busy}
                onRemove={() => onRemoveImage
                  ? onRemoveImage(index)
                  : onContentChange(removeNoteImageMarkerAt(content, index))}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {showPreview ? (
        <div aria-label="Note preview" className="min-h-32 rounded-input border border-border-control bg-bg-control p-4">
          <NoteContent content={content} format={format} pendingImageUrls={pendingImageUrls} />
        </div>
      ) : (
        <textarea
          id={`edit-note-${itemId}`}
          ref={(node) => {
            textareaRef.current = node;
            setFirstEditField(node);
          }}
          className="ui-field min-h-40 w-full resize-none overflow-hidden rounded-input px-4 py-3 text-sm disabled:opacity-60"
          value={content}
          disabled={busy}
          onChange={(event) => onContentChange(event.target.value)}
          onKeyDown={(event) => onSaveShortcut(event, onSave)}
        />
      )}
      {error ? <p className="text-sm text-text-danger" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ui-primary min-h-10 rounded-control px-4 text-sm font-medium disabled:opacity-60" disabled={busy} onClick={onSave}>{saving ? "Saving…" : "Save note"}</button>
        <button type="button" className="ui-control min-h-10 rounded-control px-4 text-sm font-medium disabled:opacity-60" disabled={busy} onClick={onCancel}>Cancel edit</button>
      </div>
    </div>
  );
}
