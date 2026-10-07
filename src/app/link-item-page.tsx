"use client";

import { ScrollPanel } from "@/components/ui/scroll-panel";

import Link from "next/link";
import { ItemPageLoading } from "./library-loading-content";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useEffect, useState } from "react";
import { itemActionLabel } from "@/domain/item-label";
import { linkCardHost } from "@/domain/card-display";
import { CollectionValidationError, type Collection } from "@/domain/collection";
import { resolveItemCollections, resolveItemTags } from "@/domain/item";
import { LinkValidationError, type LinkItem } from "@/domain/link";
import { TagValidationError, type Tag } from "@/domain/tag";
import { createCollection, listCollections } from "@/persistence/collections";
import {
  assignCollectionToItem,
  clearCollectionOnItem,
  assignTagToItem,
  deleteItem,
  getItem,
  unassignTagFromItem,
  updateLink,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { ItemLibraryDetails } from "./item-library-details";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { LibraryItemMedia } from "./library-item-media";
import { NoteContent } from "./note-content";
import { LinkItemEditDialog, type LinkDetailsDraft } from "./item-edit-dialog";
import { LinkIcon } from "./shell-icons";
import { ItemPageHeader } from "./item-page-header";
import { ITEM_DETAILS_POSITION, ITEM_PAGE_GRID, ITEM_PAGE_SCROLL } from "./item-page-styles";

type LoadState =
  | { status: "loading" | "missing" | "error" }
  | { status: "ready"; link: LinkItem; tags: Tag[]; collections: Collection[] };

export function LinkItemPage({ itemId, returnHref }: { itemId: string; returnHref: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itemMutation, setItemMutation] = useState<"save" | "delete" | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [organizerSide, setOrganizerSide] = useState<"left" | "right">("right");
  const [organizeMutation, setOrganizeMutation] = useState<"tag" | "collection" | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const reload = () => {
      void Promise.all([getItem(itemId), listTags(), listCollections()])
        .then(([item, tags, collections]) => {
          if (active) setState(item?.type === "link" ? { status: "ready", link: item, tags, collections } : { status: "missing" });
        })
        .catch(() => {
          if (active) setState({ status: "error" });
        });
    };
    reload();
    window.addEventListener(ITEMS_CHANGED_EVENT, reload);
    return () => {
      active = false;
      window.removeEventListener(ITEMS_CHANGED_EVENT, reload);
    };
  }, [itemId]);

  if (state.status !== "ready") {
    return <LinkPageUnavailable status={state.status} returnHref={returnHref} />;
  }

  const busy = organizeMutation !== null || itemMutation !== null;
  const link = state.link;
  const title = link.title.trim() || link.previewTitle.trim() || link.url;
  const itemTags = resolveItemTags(link, new Map(state.tags.map((tag) => [tag.id, tag])));
  const itemCollections = resolveItemCollections(link, new Map(state.collections.map((collection) => [collection.id, collection])));

  function applyLinkUpdate(updated: LinkItem, extra?: { tag?: Tag; collection?: Collection }) {
    setState((current) => current.status === "ready" ? {
      ...current,
      link: updated,
      tags: extra?.tag && !current.tags.some((tag) => tag.id === extra.tag?.id)
        ? [...current.tags, extra.tag] : current.tags,
      collections: extra?.collection && !current.collections.some((collection) => collection.id === extra.collection?.id)
        ? [...current.collections, extra.collection] : current.collections,
    } : current);
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
  }

  async function addTag(name: string) {
    if (busy) return;
    setOrganizeMutation("tag");
    setTagError(null);
    try {
      const tag = await createTag({ name });
      const updated = await assignTagToItem(itemId, tag.id);
      if (updated.type !== "link") throw new Error("Link not found");
      applyLinkUpdate(updated, { tag });
    } catch (error) {
      setTagError(error instanceof TagValidationError ? error.message : "Couldn't add tag.");
    } finally {
      setOrganizeMutation(null);
    }
  }

  async function removeTag(tagId: string) {
    if (busy) return;
    setOrganizeMutation("tag");
    setTagError(null);
    try {
      const updated = await unassignTagFromItem(itemId, tagId);
      if (updated.type !== "link") throw new Error("Link not found");
      applyLinkUpdate(updated);
    } catch {
      setTagError("Couldn't remove tag.");
    } finally {
      setOrganizeMutation(null);
    }
  }

  async function moveToUnsorted() {
    if (busy) return;
    setOrganizeMutation("collection");
    setCollectionError(null);
    try {
      const updated = await clearCollectionOnItem(itemId);
      if (updated.type !== "link") throw new Error("Item not found");
      applyLinkUpdate(updated);
    } catch {
      setCollectionError("Couldn't move to Unsorted.");
    } finally {
      setOrganizeMutation(null);
    }
  }

  async function moveToCollection(name: string) {
    if (busy) return;
    setOrganizeMutation("collection");
    setCollectionError(null);
    try {
      const collection = await createCollection({ name });
      const updated = await assignCollectionToItem(itemId, collection.id);
      if (updated.type !== "link") throw new Error("Link not found");
      applyLinkUpdate(updated, { collection });
    } catch (error) {
      setCollectionError(error instanceof CollectionValidationError ? error.message : "Couldn't move link.");
    } finally {
      setOrganizeMutation(null);
    }
  }

  async function saveDetails(draft: LinkDetailsDraft) {
    if (busy) return;
    setItemMutation("save");
    setEditError(null);
    try {
      const updated = await updateLink(itemId, draft);
      applyLinkUpdate(updated);
      setEditing(false);
    } catch (error) {
      setEditError(error instanceof LinkValidationError ? error.message : "Couldn't save link details.");
    } finally {
      setItemMutation(null);
    }
  }

  async function confirmDelete() {
    if (busy) return;
    setItemMutation("delete");
    setDeleteError(null);
    try {
      await deleteItem(itemId);
      router.push(returnHref);
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      setDeleteError("Couldn't move link to Trash.");
    } finally {
      setItemMutation(null);
    }
  }

  return (
    <div className="item-startup-content flex h-full min-h-0 flex-col overflow-hidden bg-bg-canvas text-text-primary">
      <ItemPageHeader returnHref={returnHref} title={title} sourceUrl={link.url} />

      <ScrollPanel role="main" className="min-h-0 flex-1" viewportClassName={ITEM_PAGE_SCROLL} viewportProps={{ "data-testid": "item-page-scroll" }}>
        <div className={ITEM_PAGE_GRID}>
          <div className="row-start-2 min-w-0 lg:col-start-1 lg:row-start-1 lg:mx-auto lg:w-full lg:max-w-5xl">
            <div className="squircle-panel overflow-hidden rounded-panel border border-border-control bg-bg-surface">
              {link.previewAssetId ? <LibraryItemMedia item={link} variant="card" className="max-h-96 w-full" /> : null}
              <div className="px-5 pb-6 pt-5 sm:px-7">
                <div className="flex min-w-0 items-center gap-2 text-sm text-text-secondary"><LinkIcon className="size-4" />{linkCardHost(link)}</div>
                <h1 className="mt-3 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
                {link.previewDescription ? <p className="mt-3 text-sm leading-relaxed text-text-secondary">{link.previewDescription}</p> : null}
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="mt-4 block break-all text-sm text-text-secondary underline underline-offset-2 hover:text-text-primary">{link.url}</a>
              </div>
            </div>

            <section aria-labelledby="personal-note-heading" className="mt-10 border-t border-border-control pt-7">
              <h2 id="personal-note-heading" className="text-xl font-semibold">My note</h2>
              {link.noteContent?.trim() ? (
                <article className="mt-6"><NoteContent content={link.noteContent} format={link.noteFormat === "markdown" ? "markdown" : "plain"} headingStart={2} /></article>
              ) : (
                <p className="mt-5 text-sm text-text-secondary">Use Edit details to add your own thoughts to this link.</p>
              )}
            </section>
          </div>

          <ItemLibraryDetails
            label="Link details"
            summary={{ label: "Notes", value: link.noteContent?.trim() ? "Added" : "None" }}
            collections={itemCollections}
            tags={itemTags}
            createdAt={link.createdAt}
            updatedAt={link.updatedAt}
            className={ITEM_DETAILS_POSITION}
            disabled={busy}
            editDisabled={editing}
            deleteLabel="Move link to Trash"
            onEdit={() => {
              setEditError(null);
              setEditing(true);
            }}
            onOrganize={() => {
              setTagError(null);
              setCollectionError(null);
              setOrganizerSide(document.documentElement.dir === "rtl" ? "left" : "right");
              setOrganizerOpen(true);
            }}
            onDelete={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          />
        </div>
      </ScrollPanel>

      {editing ? <LinkItemEditDialog item={link} open busy={busy} error={editError} onSave={(draft) => void saveDetails(draft)} onOpenChange={setEditing} /> : null}
      <ConfirmDialog open={deleteOpen} title="Move this link to Trash?" description={`Move “${itemActionLabel(link)}” to Trash? You can restore it later.`} confirmLabel="Move to Trash" pendingLabel="Moving…" busy={itemMutation === "delete"} error={deleteError} onConfirm={() => void confirmDelete()} onOpenChange={(open) => {
        setDeleteOpen(open);
        if (!open) setDeleteError(null);
      }} />
      <ItemOrganizerDrawer
        open={organizerOpen}
        onOpenChange={setOrganizerOpen}
        side={organizerSide}
        itemTitle={itemActionLabel(link)}
        tags={itemTags}
        collections={itemCollections}
        tagSuggestions={state.tags.filter((tag) => !link.tagIds.includes(tag.id))}
        collectionSuggestions={state.collections.filter((collection) => !link.collectionIds.includes(collection.id))}
        disabled={busy}
        pendingTag={organizeMutation === "tag"}
        pendingCollection={organizeMutation === "collection"}
        tagError={tagError}
        collectionError={collectionError}
        onAddTag={(name) => void addTag(name)}
        onRemoveTag={(tagId) => void removeTag(tagId)}
        onMoveToCollection={(name) => void moveToCollection(name)}
        onMoveToUnsorted={() => void moveToUnsorted()}
      />
    </div>
  );
}

function LinkPageUnavailable({ status, returnHref }: { status: "loading" | "missing" | "error"; returnHref: string }) {
  if (status === "loading") return <ItemPageLoading returnHref={returnHref} />;
  const message = status === "missing" ? "Link not found." : "Couldn't load this link.";
  return <main className="grid min-h-dvh place-items-center bg-bg-canvas p-5">
    <div className="text-center">
      <p className="text-text-secondary">{message}</p>
      <Link href={returnHref} className="ui-control mt-5 inline-flex min-h-10 items-center px-4">Return to library</Link>
    </div>
  </main>;
}
