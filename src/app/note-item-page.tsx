"use client";

import { ScrollPanel } from "@/components/ui/scroll-panel";
import { ItemPreviewContentTransition } from "./item-view-transition";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { itemActionLabel } from "@/domain/item-label";
import { ImageValidationError } from "@/domain/image";
import { CollectionValidationError, type Collection } from "@/domain/collection";
import { resolveItemCollections, resolveItemTags } from "@/domain/item";
import { TagValidationError, type Tag } from "@/domain/tag";
import {
  NoteValidationError,
  noteListTitle,
  noteReadingBody,
  type NoteItem,
} from "@/domain/note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createCollection, listCollections } from "@/persistence/collections";
import {
  assignCollectionToItem,
  clearCollectionOnItem,
  assignTagToItem,
  deleteItem,
  getItem,
  unassignTagFromItem,
  saveNoteWithImages,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { ItemLibraryDetails } from "./item-library-details";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { NoteContent } from "./note-content";
import { NoteItemEditDialog, type NoteDetailsDraft } from "./item-edit-dialog";
import { PlusIcon } from "./shell-icons";
import { ItemPageHeader } from "./item-page-header";
import { ItemPageLoading } from "./library-loading-content";
import { ITEM_DETAILS_POSITION, ITEM_PAGE_GRID, ITEM_PAGE_SCROLL, ITEM_DETAILS_CONTROL } from "./item-page-styles";

import type { ItemNavigationSnapshot } from "./item-navigation-snapshot";

type LoadState =
  | { status: "loading" | "missing" | "error" }
  | { status: "ready"; note: NoteItem; tags: Tag[]; collections: Collection[] };

export function NoteItemPage({
  itemId,
  returnHref,
  initialSnapshot,
}: {
  itemId: string;
  returnHref: string;
  initialSnapshot?: ItemNavigationSnapshot;
}) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>(() => initialSnapshot?.item.id === itemId && initialSnapshot.item.type === "note"
    ? { status: "ready", note: initialSnapshot.item, tags: initialSnapshot.tags, collections: initialSnapshot.collections }
    : { status: "loading" });
  const [editing, setEditing] = useState(false);
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


  if (state.status === "loading") return <ItemPageLoading returnHref={returnHref} />;
  if (state.status !== "ready") {
    const message =
      state.status === "missing"
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

  function beginEdit() {
    setEditError(null);
    setEditing(true);
  }

  async function save(draft: NoteDetailsDraft) {
    if (saving || state.status !== "ready") return;
    setSaving(true);
    setEditError(null);
    try {
      const updated = await saveNoteWithImages(itemId, { content: draft.content, format: draft.format }, draft.images ?? []);
      applyNoteUpdate(updated);
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

  async function moveToUnsorted() {
    if (organizeBusy) return;
    setOrganizeMutation("collection");
    setCollectionError(null);
    try {
      const updated = await clearCollectionOnItem(itemId);
      if (updated.type !== "note") throw new Error("Item not found");
      applyNoteUpdate(updated);
    } catch {
      setCollectionError("Couldn't move to Unsorted.");
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
      setDeleteError("Couldn't move note to Trash.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`${initialSnapshot ? "" : "item-startup-content"} flex h-full min-h-0 flex-col overflow-hidden bg-bg-canvas text-text-primary`}>
      <ItemPageHeader returnHref={returnHref} title={title} />

      <ScrollPanel role="main" className="min-h-0 flex-1" viewportClassName={ITEM_PAGE_SCROLL} viewportProps={{ "data-testid": "item-page-scroll" }}>
        <div className={ITEM_PAGE_GRID}>
          <div className="row-start-2 min-w-0 lg:col-start-1 lg:row-start-1 lg:mx-auto lg:w-full lg:max-w-4xl lg:pt-6">
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
              {title}
            </h1>
            <article className="mt-9 border-t border-border-control pt-8">
              <ItemPreviewContentTransition itemId={itemId}>
              <NoteContent content={noteReadingBody(note)} format={note.format === "markdown" ? "markdown" : "plain"} headingStart={2} />
              </ItemPreviewContentTransition>
            </article>
          </div>

          <ItemLibraryDetails
            label="Note details"
            summary={{ label: "Format", value: note.format === "markdown" ? "Markdown" : "Plain text" }}
            collections={itemCollections}
            tags={itemTags}
            createdAt={note.createdAt}
            updatedAt={note.updatedAt}
            className={ITEM_DETAILS_POSITION}
            disabled={saving || deleting || organizeBusy}
            editDisabled={editing}
            editLabel="Edit note"
            deleteLabel="Move note to Trash"
            onEdit={beginEdit}
            onOrganize={() => {
              setTagError(null);
              setCollectionError(null);
              setOrganizerSide(document.documentElement.dir === "rtl" ? "left" : "right");
              setOrganizerOpen(true);
            }}
            onDelete={() => setDeleteOpen(true)}
            mediaAction={
              <button className={ITEM_DETAILS_CONTROL} type="button" disabled={editing || saving || deleting || organizeBusy} onClick={beginEdit}>
                <PlusIcon className="size-4" />Add image
              </button>
            }
          />
        </div>
      </ScrollPanel>

      {editing ? <NoteItemEditDialog
        key={itemId} item={note} open busy={saving} error={editError}
        onSave={(draft) => void save(draft)}
        onOpenChange={(open) => { if (!open) setEditing(false); }}
      /> : null}

      <ItemOrganizerDrawer
        open={organizerOpen}
        onOpenChange={setOrganizerOpen}
        side={organizerSide}
        itemTitle={itemActionLabel(note)}
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
        onMoveToUnsorted={() => void moveToUnsorted()}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Move this note to Trash?"
        description={`Move “${itemActionLabel(note)}” to Trash? You can restore it later.`}
        confirmLabel="Move to Trash"
        pendingLabel="Moving…"
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
