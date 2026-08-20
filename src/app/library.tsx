"use client";

import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { resolveItemTagNames, type Item } from "@/domain/item";
import { LinkValidationError } from "@/domain/link";
import { NoteValidationError } from "@/domain/note";
import { TagValidationError, type Tag } from "@/domain/tag";
import {
  assignTagToItem,
  deleteItem,
  listItems,
  updateLink,
  updateNote,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { LibraryItem, type PendingMutation } from "./library-item";

type RestoreFocus = { id: string; action: "edit" | "delete" };

export function Library() {
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
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
  const [tagErrorItemId, setTagErrorItemId] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(
    null,
  );

  const libraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstEditFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(
    null,
  );
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<RestoreFocus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function reload() {
      setLoadState("loading");
      setError(null);

      try {
        const [nextItems, nextTags] = await Promise.all([
          listItems(),
          listTags(),
        ]);
        if (!cancelled) {
          setItems(nextItems);
          setTags(nextTags);
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

  useLayoutEffect(() => {
    if (editingId) {
      firstEditFieldRef.current?.focus();
      return;
    }

    if (pendingDeleteId) {
      confirmDeleteRef.current?.focus();
      return;
    }

    const restore = restoreFocusRef.current;
    if (!restore) {
      return;
    }

    const button = document.querySelector<HTMLButtonElement>(
      `button[data-focus-return="${restore.action}:${restore.id}"]`,
    );
    button?.focus();
    restoreFocusRef.current = null;
  }, [editingId, pendingDeleteId, items]);

  const mutationBusy = pendingMutation !== null;
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));

  function clearEdit(options?: { restoreFocus?: boolean }) {
    if (options?.restoreFocus && editingId) {
      restoreFocusRef.current = { id: editingId, action: "edit" };
    }
    setEditingId(null);
    setEditDraft("");
    setEditTitleDraft("");
    setEditError(null);
  }

  function cancelDelete() {
    if (pendingDeleteId) {
      restoreFocusRef.current = { id: pendingDeleteId, action: "delete" };
    }
    setPendingDeleteId(null);
  }

  function onEditSaveShortcut(
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    save: () => void,
  ) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!mutationBusy) {
        save();
      }
    }
  }

  async function confirmDelete(id: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "delete", id });
    setDeleteError(null);

    try {
      await deleteItem(id);
      setPendingDeleteId(null);
      restoreFocusRef.current = null;
      libraryHeadingRef.current?.focus();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setDeleteError("Couldn't delete item.");
    } finally {
      setPendingMutation(null);
    }
  }

  async function saveNoteEdit(id: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "save-note", id });
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
      setPendingMutation(null);
    }
  }

  async function saveLinkEdit(id: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "save-link", id });
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
      setPendingMutation(null);
    }
  }

  async function addTagToItem(itemId: string, name: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "assign-tag", id: itemId });
    setTagErrorItemId(null);
    setTagError(null);

    try {
      const tag = await createTag({ name });
      await assignTagToItem(itemId, tag.id);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setTagErrorItemId(itemId);
      if (caught instanceof TagValidationError) {
        setTagError(caught.message);
      } else {
        setTagError("Couldn't add tag.");
      }
    } finally {
      setPendingMutation(null);
    }
  }

  return (
    <section className="mt-8" aria-labelledby="library-heading">
      <h2
        className="text-lg font-semibold"
        id="library-heading"
        ref={libraryHeadingRef}
        tabIndex={-1}
      >
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
              <LibraryItem
                key={item.id}
                item={item}
                tagNames={resolveItemTagNames(item, tagsById)}
                tagError={tagErrorItemId === item.id ? tagError : null}
                editing={editingId === item.id}
                pendingDelete={pendingDeleteId === item.id}
                mutationBusy={mutationBusy}
                pendingMutation={pendingMutation}
                editDraft={editDraft}
                editTitleDraft={editTitleDraft}
                editError={editError}
                setFirstEditField={(node) => {
                  firstEditFieldRef.current = node;
                }}
                confirmDeleteRef={confirmDeleteRef}
                onEditDraftChange={setEditDraft}
                onEditTitleChange={setEditTitleDraft}
                onEditSaveShortcut={onEditSaveShortcut}
                onSaveNote={() => void saveNoteEdit(item.id)}
                onSaveLink={() => void saveLinkEdit(item.id)}
                onCancelEdit={() => clearEdit({ restoreFocus: true })}
                onConfirmDelete={() => void confirmDelete(item.id)}
                onCancelDelete={cancelDelete}
                onAddTag={(name: string) => void addTagToItem(item.id, name)}
                onStartEdit={() => {
                  setPendingDeleteId(null);
                  setDeleteError(null);
                  setEditError(null);
                  setTagError(null);
                  setTagErrorItemId(null);
                  setEditingId(item.id);
                  if (item.type === "note") {
                    setEditDraft(item.content);
                    setEditTitleDraft("");
                  } else {
                    setEditDraft(item.url);
                    setEditTitleDraft(item.title);
                  }
                }}
                onStartDelete={() => {
                  clearEdit();
                  setDeleteError(null);
                  setTagError(null);
                  setTagErrorItemId(null);
                  setPendingDeleteId(item.id);
                }}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
