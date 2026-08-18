"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  noteListTitle,
  NoteValidationError,
  type NoteItem,
} from "@/domain/note";
import { createNote, listNotes } from "@/persistence/notes";

export function NotesWorkspace() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;

    listNotes()
      .then((next) => {
        if (!cancelled) {
          setNotes(next);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't load notes.");
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createNote({ title, content });
      setNotes(await listNotes());
      setTitle("");
      setContent("");
    } catch (caught) {
      if (caught instanceof NoteValidationError) {
        setError(caught.message);
      } else {
        setError("Couldn't save. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="note-title">
            Title
          </label>
          <input
            className="rounded-md border border-zinc-300 bg-white px-3 py-2"
            id="note-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="note-content">
            Note
          </label>
          <textarea
            className="min-h-32 rounded-md border border-zinc-300 bg-white px-3 py-2"
            id="note-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
          />
        </div>
        <button
          className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save note"}
        </button>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <section aria-labelledby="saved-notes-heading">
        <h2 className="text-lg font-semibold" id="saved-notes-heading">
          Saved notes
        </h2>
        {loadState === "loading" ? (
          <p className="mt-3 text-sm text-zinc-600">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No notes yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {notes.map((note) => (
              <li
                className="rounded-md border border-zinc-200 p-4"
                key={note.id}
              >
                <h3 className="font-medium">{noteListTitle(note)}</h3>
                <p className="mt-2 whitespace-pre-wrap text-zinc-800">
                  {note.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
