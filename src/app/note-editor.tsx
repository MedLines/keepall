"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollTextarea } from "@/components/ui/scroll-textarea";

import { type KeyboardEvent, useRef, useState } from "react";
import { noteImageMarkers, removeNoteImageMarkerAt } from "@/domain/note";
import { NoteContent } from "./note-content";
import { NoteEditorControls } from "./note-editor-controls";
import { useAssetObjectUrl } from "./use-asset-object-url";

type Props = {
  itemId: string;
  showActions?: boolean;
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
        <img src={url} alt="" className="media-outline size-12 shrink-0 rounded-control object-cover" />
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
  showActions = true,
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

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium" htmlFor={`edit-note-${itemId}`}>Note content</label>
        <NoteEditorControls format={format} preview={preview} disabled={busy} onFormatChange={onFormatChange} onPreviewChange={setPreview} />
      </div>
      {onAddImages ? (
        <div>
          <p className="mb-2 text-sm text-text-secondary">Place the cursor between paragraphs, then add an image.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
            multiple
            disabled={busy}
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
        <ScrollArea role="region" aria-label="Note preview" className="h-64 min-h-40 rounded-input border border-border-control bg-bg-control" viewportClassName="scroll-fade">
        <div className="p-4">
          <NoteContent content={content} format={format} pendingImageUrls={pendingImageUrls} />
        </div></ScrollArea>
      ) : (
        <ScrollTextarea
          id={`edit-note-${itemId}`}
          ref={(node) => {
            textareaRef.current = node;
            setFirstEditField(node);
          }}
          autoFocus
          className="ui-field ui-scrollbar h-64 min-h-40 w-full resize-none overflow-y-auto rounded-input px-4 py-3 text-sm disabled:opacity-60"
          value={content}
          disabled={busy}
          onChange={(event) => onContentChange(event.target.value)}
          onKeyDown={(event) => onSaveShortcut(event, onSave)}
        />
      )}
      {error ? <p className="text-sm text-text-danger" role="alert">{error}</p> : null}
      {showActions ? <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="ui-control min-h-10 rounded-control px-4 text-sm font-medium disabled:opacity-60" disabled={busy} onClick={onCancel}>Cancel edit</button>
        <button type="button" className="ui-primary min-h-10 rounded-control px-4 text-sm font-medium disabled:opacity-60" disabled={busy} onClick={onSave}>{saving ? "Saving…" : "Save note"}</button>
      </div> : null}
    </div>
  );
}
