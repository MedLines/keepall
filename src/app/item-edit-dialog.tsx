"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tooltip } from "@base-ui/react/tooltip";
import { useState } from "react";
import type { ImageItem } from "@/domain/image";
import type { LinkItem } from "@/domain/link";
import type { NoteItem } from "@/domain/note";
import { noteImageMarkers, removeNoteImageMarkerAt } from "@/domain/note";
import type { VideoItem } from "@/domain/video";
import { CloseIcon, EditIcon, EyeIcon } from "./shell-icons";
import { NoteContent } from "./note-content";
import { NoteFormatControl } from "./note-format-control";

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

export type LinkDetailsDraft = {
  url: string;
  title: string;
  noteContent: string;
  noteFormat: "plain" | "markdown";
};

export type NoteDetailsDraft = {
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
  media: "image" | "video" | "link" | "note";
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
  const noteImages = media === "note" ? noteImageMarkers(notes) : [];

  return (
    <Dialog.Root
      open={open}
      disablePointerDismissal={busy}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen && busy) {
          eventDetails.cancel();
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="ui-backdrop fixed inset-0 z-[80]" />
        <Dialog.Viewport className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4">
          <Dialog.Popup className="ui-popover flex h-[min(44rem,calc(100dvh-2rem))] w-full max-w-[42rem] flex-col overflow-hidden p-0 outline-none">
            <header className="flex shrink-0 items-start gap-4 border-b border-border-control px-5 py-5 sm:px-6">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-xl font-semibold text-text-primary">
                  {media === "note" ? "Edit note" : `Edit ${media} details`}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {media === "image"
                    ? "Change the title, notes, or source. Gallery images stay unchanged."
                    : media === "video"
                      ? "Change the title or notes. The video file stays unchanged."
                      : media === "link"
                        ? "Change the URL, title, or your note."
                        : "Change the note and its format."}
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="ui-control flex size-10 shrink-0 items-center justify-center"
                aria-label="Close"
                disabled={busy}
              >
                <CloseIcon />
              </Dialog.Close>
            </header>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.requestSubmit();
                }
              }}
              onSubmit={(event) => {
                event.preventDefault();
                onSave({ title, notes, format, sourceUrl });
              }}
            >
              <div className="scroll-fade flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">
                {media !== "note" ? (
                  <label className="grid gap-2 text-sm font-medium text-text-primary">
                    {media === "image" ? "Title (optional)" : "Title"}
                    <input
                      className="ui-field min-h-11 px-3 text-sm font-normal"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </label>
                ) : null}
                <div className="flex min-h-[19rem] flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {preview ? (
                      <span className="text-sm font-medium text-text-primary">
                        {media === "note" ? "Note content" : media === "link" ? "My note (optional)" : "Notes"}
                      </span>
                    ) : (
                      <label htmlFor="item-edit-notes" className="text-sm font-medium text-text-primary">
                        {media === "note" ? "Note content" : media === "link" ? "My note (optional)" : "Notes"}
                      </label>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <NoteFormatControl format={format} onChange={setFormat} disabled={busy} />
                      <Tooltip.Provider delay={350}>
                        <div role="group" aria-label="Notes mode" data-selected={preview ? "end" : "start"} className="icon-segmented-switch squircle-panel relative isolate flex h-11 rounded-control-lg bg-bg-raised p-0.5">
                          <span aria-hidden="true" className="icon-segmented-thumb squircle-panel ui-selected pointer-events-none absolute left-0.5 top-0.5 h-10 w-[42px] rounded-control-sm" />
                          {([
                            { value: "edit", label: "Edit", hint: "Edit notes", icon: <EditIcon /> },
                            { value: "view", label: "View", hint: "View formatted notes", icon: <EyeIcon /> },
                          ] as const).map((option) => {
                            const selected = preview === (option.value === "view");
                            return (
                              <Tooltip.Root key={option.value}>
                                <Tooltip.Trigger
                                  type="button"
                                  aria-label={option.label}
                                  aria-pressed={selected}
                                  disabled={busy}
                                  className={`squircle-panel relative flex size-10 w-[42px] items-center justify-center rounded-control-sm disabled:opacity-60 ${selected ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
                                  onClick={() => setPreview(option.value === "view")}
                                >
                                  {option.icon}
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                  <Tooltip.Positioner side="top" sideOffset={8} className="z-[100]">
                                    <Tooltip.Popup className="rounded-control-sm border border-border-control bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-menu transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0">
                                      {option.hint}
                                    </Tooltip.Popup>
                                  </Tooltip.Positioner>
                                </Tooltip.Portal>
                              </Tooltip.Root>
                            );
                          })}
                        </div>
                      </Tooltip.Provider>
                    </div>
                  </div>
                  {preview ? (
                    <section aria-label="Notes preview" className="ui-field ui-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3 text-text-primary [scrollbar-gutter:stable]">
                      <NoteContent content={notes} format={format} />
                    </section>
                  ) : (
                    <textarea
                      id="item-edit-notes"
                      autoFocus={media === "note"}
                      className="ui-field ui-scrollbar min-h-0 w-full flex-1 resize-none overflow-y-auto px-3 py-3 text-base font-normal leading-7 [scrollbar-gutter:stable]"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  )}
                </div>
                {media === "note" && noteImages.length > 0 ? (
                  <section aria-label="Images in this note" className="border-t border-border-control pt-3">
                    <p className="mb-2 text-sm font-medium">{noteImages.length} {noteImages.length === 1 ? "image" : "images"} in this note</p>
                    <ul className="grid gap-2">
                      {noteImages.map((marker, index) => (
                        <li key={`${marker.assetId}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                          <span>Image {index + 1}</span>
                          <button type="button" className="ui-control min-h-9 px-3" disabled={busy} aria-label={`Remove image ${index + 1}`} onClick={() => setNotes(removeNoteImageMarkerAt(notes, index))}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
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
              </div>

              <footer className="flex shrink-0 justify-end gap-2 border-t border-border-control px-5 py-4 sm:px-6">
                <Dialog.Close
                  className="ui-control flex h-10 w-32 items-center justify-center text-sm font-medium"
                  disabled={busy}
                >
                  {media === "note" ? "Cancel edit" : "Cancel"}
                </Dialog.Close>
                <button
                  className="ui-primary flex h-10 w-32 items-center justify-center rounded-control-md text-sm font-medium disabled:opacity-60"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Saving…" : media === "note" ? "Save note" : "Save changes"}
                </button>
              </footer>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
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

export function NoteItemEditDialog({ item, onSave, ...props }: CommonProps & {
  item: NoteItem;
  onSave: (draft: NoteDetailsDraft) => void;
}) {
  return <MediaItemEditDialog
    {...props}
    media="note"
    initialTitle=""
    initialNotes={item.content}
    initialFormat={item.format === "markdown" ? "markdown" : "plain"}
    initialSourceUrl=""
    onSave={({ notes, format }) => onSave({ content: notes, format })}
  />;
}
