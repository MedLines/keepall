"use client";

import { type KeyboardEvent, useState } from "react";
import { NoteContent } from "./note-content";
import { NoteFormatControl } from "./note-format-control";

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
};

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
}: Props) {
  const [preview, setPreview] = useState(false);
  const showPreview = format === "markdown" && preview;

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium" htmlFor={`edit-note-${itemId}`}>Note content</label>
        <NoteFormatControl format={format} disabled={busy} onChange={(next) => {
          onFormatChange(next);
          if (next === "plain") setPreview(false);
        }} />
      </div>
      {format === "markdown" ? (
        <div role="group" aria-label="Note editor view" className="flex gap-1">
          <button type="button" aria-pressed={!showPreview} className={`ui-control min-h-9 px-3 text-sm ${!showPreview ? "ui-selected text-text-primary" : ""}`} onClick={() => setPreview(false)}>Write</button>
          <button type="button" aria-pressed={showPreview} className={`ui-control min-h-9 px-3 text-sm ${showPreview ? "ui-selected text-text-primary" : ""}`} onClick={() => setPreview(true)}>Preview</button>
        </div>
      ) : null}
      {showPreview ? (
        <div aria-label="Markdown preview" className="min-h-32 rounded-input border border-border-control bg-bg-control p-4">
          <NoteContent content={content} format="markdown" />
        </div>
      ) : (
        <textarea
          id={`edit-note-${itemId}`}
          ref={setFirstEditField}
          className="ui-field min-h-40 w-full resize-y rounded-input px-4 py-3 text-sm disabled:opacity-60"
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
