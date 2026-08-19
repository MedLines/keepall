"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { itemListTitle, type Item } from "@/domain/item";
import { LinkValidationError } from "@/domain/link";
import { NoteValidationError } from "@/domain/note";
import {
  deleteItem,
  listItems,
  updateLink,
  updateNote,
} from "@/persistence/items";
import { ITEMS_CHANGED_EVENT } from "./items-events";

export function Library() {
  const [items, setItems] = useState<Item[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editTitleDraft, setEditTitleDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const deleteInFlightRef = useRef(false);
  const editInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function reload() {
      setLoadState("loading");
      setError(null);

      try {
        const next = await listItems();
        if (!cancelled) {
          setItems(next);
          setLoadState("ready");
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Couldn't load items.");
          setLoadState("error");
        }
      }
    }

    void reload();
    window.addEventListener(ITEMS_CHANGED_EVENT, reload);

    return () => {
      cancelled = true;
      window.removeEventListener(ITEMS_CHANGED_EVENT, reload);
    };
  }, []);

  function clearEdit() {
    setEditingId(null);
    setEditDraft("");
    setEditTitleDraft("");
    setEditError(null);
  }

  function onEditSaveShortcut(
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    save: () => void,
  ) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      save();
    }
  }

  async function confirmDelete(id: string) {
    if (deleteInFlightRef.current) {
      return;
    }

    deleteInFlightRef.current = true;
    setDeleteError(null);

    try {
      await deleteItem(id);
      setPendingDeleteId(null);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setDeleteError("Couldn't delete item.");
    } finally {
      deleteInFlightRef.current = false;
    }
  }

  async function saveNoteEdit(id: string) {
    if (editInFlightRef.current) {
      return;
    }

    editInFlightRef.current = true;
    setEditError(null);

    try {
      await updateNote(id, { content: editDraft });
      clearEdit();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof NoteValidationError) {
        setEditError(caught.message);
      } else {
        setEditError("Couldn't save note.");
      }
    } finally {
      editInFlightRef.current = false;
    }
  }

  async function saveLinkEdit(id: string) {
    if (editInFlightRef.current) {
      return;
    }

    editInFlightRef.current = true;
    setEditError(null);

    try {
      await updateLink(id, { url: editDraft, title: editTitleDraft });
      clearEdit();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof LinkValidationError) {
        setEditError(caught.message);
      } else {
        setEditError("Couldn't save link.");
      }
    } finally {
      editInFlightRef.current = false;
    }
  }

  return (
    <section className="mt-8" aria-labelledby="library-heading">
      <h2 className="text-lg font-semibold" id="library-heading">
        Library
      </h2>
      {loadState === "loading" ? (
        <p className="mt-3 text-sm text-zinc-600">Loading…</p>
      ) : loadState === "error" ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error ?? "Couldn't load items."}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">No items yet.</p>
      ) : (
        <>
          {deleteError ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {deleteError}
            </p>
          ) : null}
          <ul className="mt-3 flex flex-col gap-4">
            {items.map((item) => (
              <li
                className="rounded-md border border-zinc-200 bg-white p-4"
                key={item.id}
              >
                <h3 className="font-medium">{itemListTitle(item)}</h3>
                {item.type === "note" && editingId === item.id ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`edit-note-${item.id}`}
                    >
                      Note content
                    </label>
                    <textarea
                      className="min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2"
                      id={`edit-note-${item.id}`}
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      onKeyDown={(event) =>
                        onEditSaveShortcut(event, () =>
                          void saveNoteEdit(item.id),
                        )
                      }
                    />
                    {editError ? (
                      <p className="text-sm text-red-700" role="alert">
                        {editError}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white"
                        type="button"
                        onClick={() => void saveNoteEdit(item.id)}
                      >
                        Save note
                      </button>
                      <button
                        className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium"
                        type="button"
                        onClick={() => clearEdit()}
                      >
                        Cancel edit
                      </button>
                    </div>
                  </div>
                ) : item.type === "link" && editingId === item.id ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`edit-link-url-${item.id}`}
                    >
                      URL
                    </label>
                    <input
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                      id={`edit-link-url-${item.id}`}
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      onKeyDown={(event) =>
                        onEditSaveShortcut(event, () =>
                          void saveLinkEdit(item.id),
                        )
                      }
                    />
                    <label
                      className="text-sm font-medium"
                      htmlFor={`edit-link-title-${item.id}`}
                    >
                      Title
                    </label>
                    <input
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                      id={`edit-link-title-${item.id}`}
                      value={editTitleDraft}
                      onChange={(event) => setEditTitleDraft(event.target.value)}
                      onKeyDown={(event) =>
                        onEditSaveShortcut(event, () =>
                          void saveLinkEdit(item.id),
                        )
                      }
                    />
                    {editError ? (
                      <p className="text-sm text-red-700" role="alert">
                        {editError}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white"
                        type="button"
                        onClick={() => void saveLinkEdit(item.id)}
                      >
                        Save link
                      </button>
                      <button
                        className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium"
                        type="button"
                        onClick={() => clearEdit()}
                      >
                        Cancel edit
                      </button>
                    </div>
                  </div>
                ) : item.type === "note" ? (
                  <p className="mt-2 whitespace-pre-wrap text-zinc-800">
                    {item.content}
                  </p>
                ) : (
                  <p className="mt-2">
                    <a
                      className="break-all text-zinc-800 underline"
                      href={item.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {item.url}
                    </a>
                  </p>
                )}
                {pendingDeleteId === item.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-zinc-700">Delete this item?</p>
                    <button
                      className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
                      type="button"
                      onClick={() => void confirmDelete(item.id)}
                    >
                      Confirm delete
                    </button>
                    <button
                      className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium"
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : editingId === item.id ? null : (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium"
                      type="button"
                      onClick={() => {
                        setPendingDeleteId(null);
                        setDeleteError(null);
                        setEditError(null);
                        setEditingId(item.id);
                        if (item.type === "note") {
                          setEditDraft(item.content);
                          setEditTitleDraft("");
                        } else {
                          setEditDraft(item.url);
                          setEditTitleDraft(item.title);
                        }
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium"
                      type="button"
                      onClick={() => {
                        clearEdit();
                        setDeleteError(null);
                        setPendingDeleteId(item.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
