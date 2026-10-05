"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDirtyDismissal } from "./use-dirty-dismissal";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { assertLocalImageBytes, assertLocalImageFile, ImageValidationError } from "@/domain/image";
import { NoteEditor } from "./note-editor";
import type { ImageItem } from "@/domain/image";
import type { LinkItem } from "@/domain/link";
import type { NoteItem } from "@/domain/note";
import { insertNoteImageMarker, noteImageAssetIds, noteImageMarkers, removeNoteImageMarkerAt } from "@/domain/note";
import type { VideoItem } from "@/domain/video";
import type { DocumentItem } from "@/domain/document";
import { NoteContent } from "./note-content";
import { NoteEditorControls } from "./note-editor-controls";
import { DocumentEditDialog } from "./document-edit-dialog";

export type ImageDetailsDraft = {
  title: string;
  caption: string;
  captionFormat: "plain" | "markdown";
  sourceUrl: string;
};

export type VideoDetailsDraft = {
  title: string;
  noteContent: string;
  noteFormat: "plain" | "markdown";
};

export type DocumentDetailsDraft = {
  title: string;
  content: string;
  expectedAssetId: string;
  noteContent: string;
  noteFormat: "plain" | "markdown";
};

export type LinkDetailsDraft = {
  url: string;
  title: string;
  noteContent: string;
  noteFormat: "plain" | "markdown";
};

type NoteImageUpload = { id: string; bytes: Uint8Array; mimeType: string };
type PendingNoteImage = NoteImageUpload & { url: string };

export type NoteDetailsDraft = {
  images?: NoteImageUpload[];
  content: string;
  format: "plain" | "markdown";
};

type CommonProps = {
  open: boolean;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
};

type MediaDetailsDraft = {
  title: string;
  notes: string;
  format: "plain" | "markdown";
  sourceUrl: string;
};

function MediaItemEditDialog({
  media,
  initialTitle,
  initialNotes,
  initialFormat,
  initialSourceUrl,
  open,
  busy,
  error,
  onSave,
  onOpenChange,
}: CommonProps & {
  media: "image" | "video" | "link";
  initialTitle: string;
  initialNotes: string;
  initialFormat: "plain" | "markdown";
  initialSourceUrl: string;
  onSave: (draft: MediaDetailsDraft) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes);
  const [format, setFormat] = useState(initialFormat);
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [preview, setPreview] = useState(false);
  const [baseline] = useState({ title: initialTitle, notes: initialNotes, format: initialFormat, sourceUrl: initialSourceUrl });
  const dismissal = useDirtyDismissal(title !== baseline.title || notes !== baseline.notes || format !== baseline.format || sourceUrl !== baseline.sourceUrl, () => onOpenChange(false));

  return (
    <ModalDialog
      open={open} busy={busy} onOpenChange={onOpenChange} size="editor"
      onDismiss={dismissal.requestDismiss} onFocusCapture={dismissal.rememberFocus}
      title={`Edit ${media} details`}
      description={media === "image"
        ? "Change the title, notes, or source. Gallery images stay unchanged."
        : media === "video"
          ? "Change the title or notes. The video file stays unchanged."
          : "Change the URL, title, or your note."}
      onSubmit={() => onSave({ title, notes, format, sourceUrl })}
      footer={<>
        <button
          type="button" onClick={() => onOpenChange(false)}
          className="ui-control flex min-h-10 items-center justify-center px-4 text-sm font-medium"
          disabled={busy}
        >
          Cancel
        </button>
        <button
          className="ui-primary flex min-h-10 items-center justify-center px-4 rounded-control-md text-sm font-medium disabled:opacity-60"
          type="submit"
          disabled={busy}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </>}
    >
      <label className="grid gap-2 text-sm font-medium text-text-primary">
        {media === "image" ? "Title (optional)" : "Title"}
        <input
          className="ui-field min-h-11 px-3 text-sm font-normal"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="flex min-h-[19rem] flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {preview ? (
            <span className="text-sm font-medium text-text-primary">
              {media === "link" ? "My note (optional)" : "Notes"}
            </span>
          ) : (
            <label htmlFor="item-edit-notes" className="text-sm font-medium text-text-primary">
              {media === "link" ? "My note (optional)" : "Notes"}
            </label>
          )}
          <NoteEditorControls format={format} preview={preview} disabled={busy} onFormatChange={setFormat} onPreviewChange={setPreview} />
        </div>
        {preview ? (
          <section aria-label="Notes preview" className="ui-field ui-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3 text-text-primary [scrollbar-gutter:stable]">
            <NoteContent content={notes} format={format} />
          </section>
        ) : (
          <textarea
            id="item-edit-notes"
            className="ui-field ui-scrollbar min-h-0 w-full flex-1 resize-none overflow-y-auto px-3 py-3 text-base font-normal leading-7 [scrollbar-gutter:stable]"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        )}
      </div>
      {media === "image" || media === "link" ? (
        <label className="grid gap-2 text-sm font-medium text-text-primary">
          {media === "link" ? "URL" : "Source URL (optional)"}
          <input
            className="ui-field min-h-11 px-3 text-sm font-normal"
            inputMode="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
          />
        </label>
      ) : null}
      {error ? (
        <p className="text-sm text-text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <ConfirmDialog {...dismissal.confirmationProps} />
    </ModalDialog>
  );
}

export function ImageItemEditDialog({ item, onSave, ...props }: CommonProps & {
  item: ImageItem;
  onSave: (draft: ImageDetailsDraft) => void;
}) {
  return <MediaItemEditDialog
    {...props}
    media="image"
    initialTitle={item.title}
    initialNotes={item.caption}
    initialFormat={item.captionFormat === "markdown" ? "markdown" : "plain"}
    initialSourceUrl={item.sourceUrl}
    onSave={({ title, notes, format, sourceUrl }) => onSave({
      title, caption: notes, captionFormat: format, sourceUrl,
    })}
  />;
}

export function VideoItemEditDialog({ item, onSave, ...props }: CommonProps & {
  item: VideoItem;
  onSave: (draft: VideoDetailsDraft) => void;
}) {
  return <MediaItemEditDialog
    {...props}
    media="video"
    initialTitle={item.title}
    initialNotes={item.noteContent ?? ""}
    initialFormat={item.noteFormat === "markdown" ? "markdown" : "plain"}
    initialSourceUrl=""
    onSave={({ title, notes, format }) => onSave({
      title, noteContent: notes, noteFormat: format,
    })}
  />;
}

export function DocumentItemEditDialog({ item, onSave, ...props }: CommonProps & {
  item: DocumentItem;
  onSave: (draft: DocumentDetailsDraft) => void;
}) {
  return <DocumentEditDialog {...props} item={item} onSave={onSave} />;
}

export function LinkItemEditDialog({ item, onSave, ...props }: CommonProps & {
  item: LinkItem;
  onSave: (draft: LinkDetailsDraft) => void;
}) {
  return <MediaItemEditDialog
    {...props}
    media="link"
    initialTitle={item.title}
    initialNotes={item.noteContent ?? ""}
    initialFormat={item.noteFormat === "markdown" ? "markdown" : "plain"}
    initialSourceUrl={item.url}
    onSave={({ title, notes, format, sourceUrl }) => onSave({
      url: sourceUrl, title, noteContent: notes, noteFormat: format,
    })}
  />;
}

export function NoteItemEditDialog({ item, onSave, open, busy, error, onOpenChange }: CommonProps & {
  item: NoteItem;
  onSave: (draft: NoteDetailsDraft) => void;
}) {
  const [content, setContent] = useState(item.content);
  const [format, setFormat] = useState<"plain" | "markdown">(item.format === "markdown" ? "markdown" : "plain");
  const [images, setImages] = useState<PendingNoteImage[]>([]);
  const imagesRef = useRef<PendingNoteImage[]>([]);
  const generationRef = useRef(0);
  const [preparing, setPreparing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const disabled = busy || preparing;
  const [baseline] = useState({ content: item.content, format: item.format === "markdown" ? "markdown" : "plain" });
  const dismissal = useDirtyDismissal(content !== baseline.content || format !== baseline.format || images.some((image) => noteImageAssetIds(content).includes(image.id)), () => onOpenChange(false));

  useEffect(() => () => {
    generationRef.current += 1;
    for (const image of imagesRef.current) URL.revokeObjectURL(image.url);
  }, []);

  async function addImages(files: File[], start: number, end: number) {
    const generation = generationRef.current;
    setPreparing(true);
    try {
      const validated = await Promise.all(files.map(async (file) => {
        assertLocalImageFile(file);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const mimeType = assertLocalImageBytes(bytes, file.type);
        return { file, bytes, mimeType };
      }));
      if (generation !== generationRef.current) return;
      const prepared = validated.map(({ file, bytes, mimeType }) => ({
        id: crypto.randomUUID(), bytes, mimeType, url: URL.createObjectURL(file),
      }));
      imagesRef.current = [...imagesRef.current, ...prepared];
      setImages(imagesRef.current);
      setContent((current) => {
        let next = current;
        let at = start;
        let through = end;
        for (const image of prepared) {
          next = insertNoteImageMarker(next, at, through, image.id);
          at = next.indexOf(`keepall-image:${image.id}`, at) + `keepall-image:${image.id}`.length + 1;
          through = at;
        }
        return next;
      });
      setImageError(null);
    } catch (caught) {
      if (generation === generationRef.current) {
        setImageError(caught instanceof ImageValidationError ? caught.message : "Couldn't add image.");
      }
    } finally {
      if (generation === generationRef.current) setPreparing(false);
    }
  }

  function removeImage(index: number) {
    const marker = noteImageMarkers(content)[index];
    if (!marker) return;
    const next = removeNoteImageMarkerAt(content, index);
    setContent(next);
    if (noteImageAssetIds(next).includes(marker.assetId)) return;
    const removed = imagesRef.current.find((image) => image.id === marker.assetId);
    if (!removed) return;
    URL.revokeObjectURL(removed.url);
    imagesRef.current = imagesRef.current.filter((image) => image.id !== marker.assetId);
    setImages(imagesRef.current);
  }

  function save() {
    if (disabled) return;
    const referenced = new Set(noteImageAssetIds(content));
    onSave({ content, format, images: images.filter((image) => referenced.has(image.id)).map(({ id, bytes, mimeType }) => ({ id, bytes, mimeType })) });
  }

  return (
    <ModalDialog
      open={open} busy={disabled} onOpenChange={onOpenChange}
      onDismiss={dismissal.requestDismiss} onFocusCapture={dismissal.rememberFocus}
      title="Edit note" description="Change the note, its format, or images." size="editor"
      onSubmit={save}
      footer={<>
        <button type="button" className="ui-control min-h-10 px-4 text-sm font-medium disabled:opacity-60" disabled={disabled} onClick={() => onOpenChange(false)}>Cancel edit</button>
        <button type="submit" className="ui-primary min-h-10 rounded-control-md px-4 text-sm font-medium disabled:opacity-60" disabled={disabled}>{busy ? "Saving…" : "Save note"}</button>
      </>}
    >
      <NoteEditor
        itemId={item.id} content={content} format={format} error={imageError ?? error}
        busy={disabled} saving={busy} showActions={false}
        setFirstEditField={() => {}} onContentChange={setContent} onFormatChange={setFormat}
        onSaveShortcut={(event, action) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); action(); }
        }}
        onSave={save} onCancel={() => onOpenChange(false)}
        onAddImages={(files, start, end) => void addImages(files, start, end)}
        onRemoveImage={removeImage} pendingImageUrls={new Map(images.map((image) => [image.id, image.url]))}
      />
      <ConfirmDialog {...dismissal.confirmationProps} />
    </ModalDialog>
  );
}
