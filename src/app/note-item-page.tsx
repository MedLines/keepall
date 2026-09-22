"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  NoteValidationError,
  noteListTitle,
  noteReadingBody,
  type NoteItem,
} from "@/domain/note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteItem, getItem, updateNote } from "@/persistence/items";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { NoteContent } from "./note-content";
import { NoteEditor } from "./note-editor";
import { ArrowLeftIcon, DeleteIcon, EditIcon, NoteIcon } from "./shell-icons";

type LoadState =
  | { status: "loading" | "missing" | "error" }
  | { status: "ready"; note: NoteItem };

export function NoteItemPage({
  itemId,
  returnHref,
}: {
  itemId: string;
  returnHref: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [format, setFormat] = useState<"plain" | "markdown">("plain");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getItem(itemId)
      .then((item) => {
        if (!active) return;
        setState(
          item?.type === "note"
            ? { status: "ready", note: item }
            : { status: "missing" },
        );
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [itemId]);

  if (state.status !== "ready") {
    const message =
      state.status === "loading"
        ? "Loading note…"
        : state.status === "missing"
          ? "Note not found."
          : "Couldn't load this note.";
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

  const note = state.note;
  const title = noteListTitle(note);

  async function save() {
    if (saving || state.status !== "ready") return;
    setSaving(true);
    setEditError(null);
    try {
      const updated = await updateNote(itemId, { content: draft, format });
      setState({ status: "ready", note: updated });
      setEditing(false);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (error) {
      setEditError(
        error instanceof NoteValidationError
          ? error.message
          : "Couldn't save note.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteItem(itemId);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      router.push(returnHref);
    } catch {
      setDeleteError("Couldn't delete note.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="ui-scrollbar h-full overflow-y-auto bg-bg-canvas text-text-primary">
      <header className="sticky top-0 z-10 border-b border-border-control bg-bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center gap-3 px-4 sm:px-6">
          <Link
            href={returnHref}
            aria-label="Back to library"
            className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm"
          >
            <ArrowLeftIcon />
            <span className="hidden sm:inline">Library</span>
          </Link>
          <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
            Note
          </span>
          <button
            type="button"
            aria-label="Edit note"
            className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm"
            disabled={saving || deleting}
            onClick={() => {
              setDraft(note.content);
              setFormat(note.format === "markdown" ? "markdown" : "plain");
              setEditError(null);
              setEditing(true);
            }}
          >
            <EditIcon />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            type="button"
            aria-label="Delete note"
            className="ui-control inline-flex min-h-10 items-center px-3 text-text-danger"
            disabled={saving || deleting}
            onClick={() => setDeleteOpen(true)}
          >
            <DeleteIcon />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <div className="mb-7 flex items-center gap-2 text-sm text-text-secondary">
          <NoteIcon className="size-4" />
          Saved note
          <span aria-hidden="true">·</span>
          Edited
          <time dateTime={new Date(note.updatedAt).toISOString()}>
            {new Date(note.updatedAt).toLocaleDateString()}
          </time>
        </div>
        <h1 className="text-pretty text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        {editing ? (
          <div className="mt-9">
            <NoteEditor
              key={itemId}
              itemId={itemId}
              content={draft}
              format={format}
              error={editError}
              busy={saving}
              saving={saving}
              setFirstEditField={() => {}}
              onContentChange={setDraft}
              onFormatChange={setFormat}
              onSaveShortcut={(event, action) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  action();
                }
              }}
              onSave={() => void save()}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <article className="mt-9 border-t border-border-control pt-8">
            <NoteContent
              content={noteReadingBody(note)}
              format={note.format === "markdown" ? "markdown" : "plain"}
              headingStart={2}
            />
          </article>
        )}
      </main>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this note?"
        description={`Delete “${title}”? This cannot be undone.`}
        confirmLabel="Confirm delete"
        pendingLabel="Deleting…"
        busy={deleting}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteError(null);
        }}
      />
    </div>
  );
}
