"use client";

import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CollectionValidationError,
  type Collection,
} from "@/domain/collection";
import {
  itemInCollection,
  resolveItemCollectionNames,
  resolveItemTagNames,
  type Item,
} from "@/domain/item";
import {
  libraryViewHref,
  mergeLibraryViewState,
  parseLibraryViewState,
  sortLibraryItems,
  type LibraryViewState,
} from "@/domain/library-view";
import { LinkValidationError } from "@/domain/link";
import { NoteValidationError } from "@/domain/note";
import { matchesSearchQuery, normalizeSearchQuery } from "@/domain/search";
import { TagValidationError, type Tag } from "@/domain/tag";
import {
  createCollection,
  listCollections,
} from "@/persistence/collections";
import {
  assignCollectionToItem,
  assignTagToItem,
  deleteItem,
  listItems,
  updateImage,
  updateLink,
  updateNote,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { enrichLinkPreview } from "./enrich-link-preview";
import { LibraryItem, type PendingMutation } from "./library-item";
import { ImageValidationError } from "@/domain/image";

type RestoreFocus = { id: string; action: "edit" | "delete" };

export function Library() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parseLibraryViewState(searchParams);

  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
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
  const [collectionErrorItemId, setCollectionErrorItemId] = useState<
    string | null
  >(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
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
        const [nextItems, nextTags, nextCollections] = await Promise.all([
          listItems(),
          listTags(),
          listCollections(),
        ]);
        if (!cancelled) {
          setItems(nextItems);
          setTags(nextTags);
          setCollections(nextCollections);
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
  const collectionsById = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const browseCollectionId = view.collection;
  const searchQuery = view.q;
  const visibleItems = sortLibraryItems(
    items.filter((item) => {
      if (
        browseCollectionId !== null &&
        !itemInCollection(item, browseCollectionId)
      ) {
        return false;
      }

      return matchesSearchQuery(item, searchQuery);
    }),
    view.sort,
  );
  const hasActiveSearch = normalizeSearchQuery(searchQuery).length > 0;

  function updateView(patch: Partial<LibraryViewState>) {
    const next = mergeLibraryViewState(view, patch);
    router.replace(libraryViewHref(pathname, next), { scroll: false });
  }

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
      const previous = items.find((item) => item.id === id);
      const previousUrl =
        previous?.type === "link" ? previous.url : undefined;
      const updated = await updateLink(id, {
        url: editDraft,
        title: editTitleDraft,
      });
      clearEdit();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      if (previousUrl !== undefined && previousUrl !== updated.url) {
        void enrichLinkPreview(updated.id, updated.url);
      }
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

  async function saveImageEdit(id: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "save-image", id });
    setEditError(null);

    try {
      await updateImage(id, {
        caption: editDraft,
        sourceUrl: editTitleDraft,
      });
      clearEdit();
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      if (caught instanceof ImageValidationError) {
        setEditError(caught.message);
      } else {
        setEditError("Couldn't save image.");
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

  async function addCollectionToItem(itemId: string, name: string) {
    if (pendingMutation) {
      return;
    }

    setPendingMutation({ op: "assign-collection", id: itemId });
    setCollectionErrorItemId(null);
    setCollectionError(null);

    try {
      const collection = await createCollection({ name });
      await assignCollectionToItem(itemId, collection.id);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (caught) {
      setCollectionErrorItemId(itemId);
      if (caught instanceof CollectionValidationError) {
        setCollectionError(caught.message);
      } else {
        setCollectionError("Couldn't add to collection.");
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
          <div className="mt-3 flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="library-search">
              Search
            </label>
            <input
              className="rounded-md border border-zinc-300 bg-white px-3 py-2"
              id="library-search"
              type="search"
              value={searchQuery}
              onChange={(event) => updateView({ q: event.target.value })}
              placeholder="Search titles, notes, and URLs"
            />
          </div>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label="Sort library"
          >
            <button
              className={`rounded-md border px-3 py-1 text-sm font-medium ${
                view.sort === "newest"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800"
              }`}
              type="button"
              onClick={() => updateView({ sort: "newest" })}
            >
              Newest
            </button>
            <button
              className={`rounded-md border px-3 py-1 text-sm font-medium ${
                view.sort === "oldest"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800"
              }`}
              type="button"
              onClick={() => updateView({ sort: "oldest" })}
            >
              Oldest
            </button>
          </div>
          {collections.length > 0 ? (
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Browse collections"
            >
              <button
                className={`rounded-md border px-3 py-1 text-sm font-medium ${
                  browseCollectionId === null
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-800"
                }`}
                type="button"
                onClick={() => updateView({ collection: null })}
              >
                All
              </button>
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  className={`rounded-md border px-3 py-1 text-sm font-medium ${
                    browseCollectionId === collection.id
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-800"
                  }`}
                  type="button"
                  onClick={() => updateView({ collection: collection.id })}
                >
                  {collection.name}
                </button>
              ))}
            </div>
          ) : null}
          {deleteError ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {deleteError}
            </p>
          ) : null}
          {visibleItems.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              {hasActiveSearch
                ? "No matching items."
                : browseCollectionId !== null
                  ? "No items in this collection."
                  : "No items yet."}
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
              {visibleItems.map((item) => (
                <LibraryItem
                  key={item.id}
                  item={item}
                  tagNames={resolveItemTagNames(item, tagsById)}
                  tagError={tagErrorItemId === item.id ? tagError : null}
                  collectionNames={resolveItemCollectionNames(
                    item,
                    collectionsById,
                  )}
                  collectionError={
                    collectionErrorItemId === item.id ? collectionError : null
                  }
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
                  onSaveImage={() => void saveImageEdit(item.id)}
                  onCancelEdit={() => clearEdit({ restoreFocus: true })}
                  onConfirmDelete={() => void confirmDelete(item.id)}
                  onCancelDelete={cancelDelete}
                  onAddTag={(name: string) => void addTagToItem(item.id, name)}
                  onAddCollection={(name: string) =>
                    void addCollectionToItem(item.id, name)
                  }
                  onStartEdit={() => {
                    setPendingDeleteId(null);
                    setDeleteError(null);
                    setEditError(null);
                    setTagError(null);
                    setTagErrorItemId(null);
                    setCollectionError(null);
                    setCollectionErrorItemId(null);
                    setEditingId(item.id);
                    if (item.type === "note") {
                      setEditDraft(item.content);
                      setEditTitleDraft("");
                    } else if (item.type === "image") {
                      setEditDraft(item.caption);
                      setEditTitleDraft(item.sourceUrl);
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
                    setCollectionError(null);
                    setCollectionErrorItemId(null);
                    setPendingDeleteId(item.id);
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
