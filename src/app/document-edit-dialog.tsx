"use client";

import { useState } from "react";
import type { DocumentItem } from "@/domain/document";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { DocumentDetailsDraft } from "./item-edit-dialog";
import { DocumentText } from "./document-content";
import { NoteFormatControl } from "./note-format-control";
import { useDocumentText } from "./use-document-text";
import { useDirtyDismissal } from "./use-dirty-dismissal";

type Props = {
  item: DocumentItem; open: boolean; busy: boolean; error: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: DocumentDetailsDraft) => void;
};
const BUTTON = "ui-control inline-flex min-h-11 items-center justify-center px-4 text-sm font-medium disabled:opacity-60";

export function DocumentEditDialog(props: Props) {
  const { state, retry } = useDocumentText(props.item);
  if (state.status === "ready") return <LoadedDocumentEditor key={`${props.item.id}:${props.item.assetId}`} {...props} initialContent={state.text} />;
  return <ModalDialog open={props.open} busy={props.busy} title="Edit document" size="editor"
    description="Edit the text saved in Keepall. The file on your device stays unchanged."
    onOpenChange={props.onOpenChange} footer={<button type="button" className={BUTTON} onClick={() => props.onOpenChange(false)}>Close</button>}>
    {state.status === "loading" ? <p role="status">Loading saved text…</p> : <div className="grid justify-items-start gap-3">
      <p role="alert">Couldn&apos;t load the saved text. Try again or restore a backup.</p>
      <button type="button" className={BUTTON} onClick={retry}>Retry</button>
    </div>}
  </ModalDialog>;
}

function LoadedDocumentEditor({ item, initialContent, open, busy, error, onOpenChange, onSave }: Props & { initialContent: string }) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(initialContent);
  const [notes, setNotes] = useState(item.noteContent);
  const [noteFormat, setNoteFormat] = useState<"plain" | "markdown">(item.noteFormat ?? "plain");
  const [preview, setPreview] = useState(false);
  const dirty = title !== item.title || content !== initialContent || notes !== item.noteContent || noteFormat !== (item.noteFormat ?? "plain");
  const dismissal = useDirtyDismissal(dirty, () => onOpenChange(false));
  return <>
    <ModalDialog open={open} busy={busy} title="Edit document" size="editor"
      description="Edit the text saved in Keepall. The file on your device stays unchanged."
      onOpenChange={onOpenChange} onDismiss={dismissal.requestDismiss} onFocusCapture={dismissal.rememberFocus}
      onSubmit={() => onSave({ title, content, expectedAssetId: item.assetId, noteContent: notes, noteFormat })}
      footer={<>
        <button type="button" className={BUTTON} disabled={busy} onClick={() => dismissal.requestDismiss({ cancel: () => {} })}>Cancel</button>
        <button type="submit" className={`${BUTTON} ui-primary`} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </>}>
      <label className="grid gap-2 text-sm font-medium">Title
        <input className="ui-field min-h-11 px-3 font-normal" value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="document-edit-content" className="text-sm font-medium">{item.format === "markdown" ? "Markdown content" : "Text content"}</label>
          <button type="button" className={BUTTON} disabled={busy} aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? "Edit text" : "Preview"}</button>
        </div>
        {preview ? <section aria-label="File preview" className="rounded-input border border-border-control p-4"><DocumentText text={content} format={item.format} /></section>
          : <textarea id="document-edit-content" className="ui-field min-h-64 resize-y px-3 py-3 text-sm" value={content} disabled={busy} onChange={(event) => setContent(event.target.value)} />}
      </div>
      <details className="rounded-input border border-border-control p-4" open={Boolean(item.noteContent)}>
        <summary className="cursor-pointer text-sm font-medium">Personal note (optional)</summary>
        <div className="mt-4 grid gap-3">
          <NoteFormatControl format={noteFormat} disabled={busy} onChange={setNoteFormat} />
          <label className="grid gap-2 text-sm font-medium">My note (optional)
            <textarea className="ui-field min-h-24 resize-y px-3 py-2 font-normal" value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
      </details>
      {error ? <p role="alert" className="text-sm text-text-danger">{error}</p> : null}
    </ModalDialog>
    <ConfirmDialog {...dismissal.confirmationProps} />
  </>;
}
