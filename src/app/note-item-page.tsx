"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { assertLocalImageBytes, assertLocalImageFile, ImageValidationError } from "@/domain/image";
import { CollectionValidationError, type Collection } from "@/domain/collection";
import { resolveItemCollections, resolveItemTags } from "@/domain/item";
import { TagValidationError, type Tag } from "@/domain/tag";
import {
  NoteValidationError,
  insertNoteImageMarker,
  noteImageAssetIds,
  noteImageMarkers,
  noteListTitle,
  noteReadingBody,
  removeNoteImageMarkerAt,
  type NoteItem,
} from "@/domain/note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createCollection, listCollections } from "@/persistence/collections";
import {
  assignCollectionToItem,
  assignTagToItem,
  deleteItem,
  getItem,
  unassignTagFromItem,
  saveNoteWithImages,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { ItemDetailLink } from "./item-detail-link";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { NoteContent } from "./note-content";
import { NoteEditor } from "./note-editor";
import { ArrowLeftIcon, DeleteIcon, EditIcon, LayersIcon } from "./shell-icons";

type PendingImage = { id: string; bytes: Uint8Array; mimeType: string; url: string };

type LoadState =
  | { status: "loading" | "missing" | "error" }
  | { status: "ready"; note: NoteItem; tags: Tag[]; collections: Collection[] };

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
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const imageReadGenerationRef = useRef(0);
  const [addingImages, setAddingImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [organizerSide, setOrganizerSide] = useState<"left" | "right">("right");
  const [organizeMutation, setOrganizeMutation] = useState<
    "tag" | "collection" | null
  >(null);
  const organizeBusy = organizeMutation !== null;
  const [tagError, setTagError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getItem(itemId), listTags(), listCollections()])
      .then(([item, tags, collections]) => {
        if (!active) return;
        setState(
          item?.type === "note"
            ? { status: "ready", note: item, tags, collections }
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

  useEffect(() => () => {
    imageReadGenerationRef.current += 1;
    for (const image of pendingImagesRef.current) URL.revokeObjectURL(image.url);
  }, []);

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
  const itemTags = resolveItemTags(
    note,
    new Map(state.tags.map((tag) => [tag.id, tag])),
  );
  const itemCollections = resolveItemCollections(
    note,
    new Map(state.collections.map((collection) => [collection.id, collection])),
  );

  function applyNoteUpdate(updated: NoteItem) {
    setState((current) =>
      current.status === "ready" ? { ...current, note: updated } : current,
    );
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
  }

  function clearPendingImages() {
    imageReadGenerationRef.current += 1;
    for (const image of pendingImagesRef.current) URL.revokeObjectURL(image.url);
    pendingImagesRef.current = [];
    setPendingImages([]);
  }

  function beginEdit() {
    clearPendingImages();
    setDraft(note.content);
    setFormat(note.format === "markdown" ? "markdown" : "plain");
    setEditError(null);
    setEditing(true);
  }

  async function addImages(files: File[], start: number, end: number) {
    const generation = imageReadGenerationRef.current;
    setAddingImages(true);
    try {
      const validated = await Promise.all(files.map(async (file) => {
        assertLocalImageFile(file);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const mimeType = assertLocalImageBytes(bytes, file.type);
        return { file, bytes, mimeType };
      }));
      if (generation !== imageReadGenerationRef.current) return;
      const prepared = validated.map(({ file, bytes, mimeType }) => ({
        id: crypto.randomUUID(), bytes, mimeType, url: URL.createObjectURL(file),
      }));
      pendingImagesRef.current = [...pendingImagesRef.current, ...prepared];
      setPendingImages(pendingImagesRef.current);
      setDraft((current) => {
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
      setEditError(null);
    } catch (error) {
      if (generation === imageReadGenerationRef.current) {
        setEditError(error instanceof ImageValidationError ? error.message : "Couldn't add image.");
      }
    } finally {
      if (generation === imageReadGenerationRef.current) setAddingImages(false);
    }
  }

  function removeImage(index: number) {
    const marker = noteImageMarkers(draft)[index];
    if (!marker) return;
    const next = removeNoteImageMarkerAt(draft, index);
    setDraft(next);
    if (noteImageAssetIds(next).includes(marker.assetId)) return;
    const removed = pendingImagesRef.current.find((image) => image.id === marker.assetId);
    if (!removed) return;
    URL.revokeObjectURL(removed.url);
    pendingImagesRef.current = pendingImagesRef.current.filter((image) => image.id !== marker.assetId);
    setPendingImages(pendingImagesRef.current);
  }

  async function save() {
    if (saving || addingImages || state.status !== "ready") return;
    setSaving(true);
    setEditError(null);
    try {
      const referenced = new Set(noteImageAssetIds(draft));
      const updated = await saveNoteWithImages(itemId, { content: draft, format },
        pendingImages.filter((image) => referenced.has(image.id)));
      applyNoteUpdate(updated);
      clearPendingImages();
      setEditing(false);
    } catch (error) {
      setEditError(
        error instanceof NoteValidationError || error instanceof ImageValidationError
          ? error.message
          : "Couldn't save note.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addTag(name: string) {
    if (organizeBusy) return;
    setOrganizeMutation("tag");
    setTagError(null);
    try {
      const tag = await createTag({ name });
      const updated = await assignTagToItem(itemId, tag.id);
      if (updated.type !== "note") throw new Error("Note not found");
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              note: updated,
              tags: current.tags.some((entry) => entry.id === tag.id)
                ? current.tags
                : [...current.tags, tag],
            }
          : current,
      );
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (error) {
      setTagError(
        error instanceof TagValidationError
          ? error.message
          : "Couldn't add tag.",
      );
    } finally {
      setOrganizeMutation(null);
    }
  }

  async function removeTag(tagId: string) {
    if (organizeBusy) return;
    setOrganizeMutation("tag");
    setTagError(null);
    try {
      const updated = await unassignTagFromItem(itemId, tagId);
      if (updated.type !== "note") throw new Error("Note not found");
      applyNoteUpdate(updated);
    } catch {
      setTagError("Couldn't remove tag.");
    } finally {
      setOrganizeMutation(null);
    }
  }

  async function moveToCollection(name: string) {
    if (organizeBusy) return;
    setOrganizeMutation("collection");
    setCollectionError(null);
    try {
      const collection = await createCollection({ name });
      const updated = await assignCollectionToItem(itemId, collection.id);
      if (updated.type !== "note") throw new Error("Note not found");
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              note: updated,
              collections: current.collections.some(
                (entry) => entry.id === collection.id,
              )
                ? current.collections
                : [...current.collections, collection],
            }
          : current,
      );
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch (error) {
      setCollectionError(
        error instanceof CollectionValidationError
          ? error.message
          : "Couldn't move note.",
      );
    } finally {
      setOrganizeMutation(null);
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
            disabled={editing || saving || addingImages || deleting || organizeBusy}
            onClick={beginEdit}
          >
            <EditIcon />
            <span className="hidden sm:inline">Edit</span>
          </button>
          {!editing ? (
            <button
              type="button"
              className="ui-control inline-flex min-h-10 items-center px-3 text-sm"
              disabled={saving || addingImages || deleting || organizeBusy}
              onClick={beginEdit}
            >
              Add image
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Organize"
            className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm"
            disabled={saving || addingImages || deleting || organizeBusy}
            onClick={() => {
              setTagError(null);
              setCollectionError(null);
              setOrganizerSide(
                document.documentElement.dir === "rtl" ? "left" : "right",
              );
              setOrganizerOpen(true);
            }}
          >
            <LayersIcon />
            <span className="hidden sm:inline">Organize</span>
          </button>
          <button
            type="button"
            aria-label="Delete note"
            className="ui-control inline-flex min-h-10 items-center px-3 text-text-danger"
            disabled={saving || addingImages || deleting || organizeBusy}
            onClick={() => setDeleteOpen(true)}
          >
            <DeleteIcon />
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[100rem] items-start gap-8 px-5 pb-24 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="min-w-0 lg:mx-auto lg:w-full lg:max-w-4xl lg:pt-6">
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
                busy={saving || addingImages}
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
                onCancel={() => { clearPendingImages(); setEditing(false); }}
                onAddImages={(files, start, end) => void addImages(files, start, end)}
                onRemoveImage={removeImage}
                pendingImageUrls={new Map(pendingImages.map((image) => [image.id, image.url]))}
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
        </div>

        <aside
          aria-label="Note details"
          className="library-panel rounded-panel border border-border-control bg-bg-surface p-5 lg:sticky lg:top-24"
        >
          <h2 className="text-base font-semibold">Details</h2>
          {itemCollections.length ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm text-text-secondary">Collection</h3>
              <div className="flex flex-wrap gap-2">
                {itemCollections.map((collection) => (
                  <ItemDetailLink key={collection.id} href={`/?collection=${encodeURIComponent(collection.id)}`}>
                    {collection.name}
                  </ItemDetailLink>
                ))}
              </div>
            </div>
          ) : null}
          {itemTags.length ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm text-text-secondary">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {itemTags.map((tag) => (
                  <ItemDetailLink key={tag.id} href={`/?tag=${encodeURIComponent(tag.id)}`}>
                    {tag.name}
                  </ItemDetailLink>
                ))}
              </div>
            </div>
          ) : null}
          <dl className="mt-7 grid gap-3 text-sm">
            <div>
              <dt className="text-text-secondary">Saved</dt>
              <dd className="mt-0.5">
                <time dateTime={new Date(note.createdAt).toISOString()}>
                  {new Date(note.createdAt).toLocaleDateString()}
                </time>
              </dd>
            </div>
            {note.updatedAt !== note.createdAt ? (
              <div>
                <dt className="text-text-secondary">Edited</dt>
                <dd className="mt-0.5">
                  <time dateTime={new Date(note.updatedAt).toISOString()}>
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </main>

      <ItemOrganizerDrawer
        open={organizerOpen}
        onOpenChange={setOrganizerOpen}
        side={organizerSide}
        itemTitle={title}
        tags={itemTags}
        collections={itemCollections}
        tagSuggestions={state.tags.filter((tag) => !note.tagIds.includes(tag.id))}
        collectionSuggestions={state.collections.filter(
          (collection) => !note.collectionIds.includes(collection.id),
        )}
        disabled={organizeBusy}
        pendingTag={organizeMutation === "tag"}
        pendingCollection={organizeMutation === "collection"}
        tagError={tagError}
        collectionError={collectionError}
        onAddTag={(name) => void addTag(name)}
        onRemoveTag={(tagId) => void removeTag(tagId)}
        onMoveToCollection={(name) => void moveToCollection(name)}
      />

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
