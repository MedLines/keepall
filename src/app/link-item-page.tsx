"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { linkCardHost } from "@/domain/card-display";
import { CollectionValidationError, type Collection } from "@/domain/collection";
import { resolveItemCollections, resolveItemTags } from "@/domain/item";
import { LinkValidationError, type LinkItem } from "@/domain/link";
import { TagValidationError, type Tag } from "@/domain/tag";
import { createCollection, listCollections } from "@/persistence/collections";
import {
  assignCollectionToItem,
  assignTagToItem,
  getItem,
  unassignTagFromItem,
  updateLink,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { ItemDetailLink } from "./item-detail-link";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { LibraryItemMedia } from "./library-item-media";
import { NoteContent } from "./note-content";
import { NoteFormatControl } from "./note-format-control";
import { ArrowLeftIcon, EditIcon, LayersIcon, LinkIcon } from "./shell-icons";

type LoadState =
  | { status: "loading" | "missing" | "error" }
  | { status: "ready"; link: LinkItem; tags: Tag[]; collections: Collection[] };

export function LinkItemPage({ itemId, returnHref }: { itemId: string; returnHref: string }) {
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
    if (organizeMutation) return;
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
    if (organizeMutation) return;
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

  async function moveToCollection(name: string) {
    if (organizeMutation) return;
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

  return (
    <div className="ui-scrollbar h-full overflow-y-auto bg-bg-canvas text-text-primary">
      <header className="sticky top-0 z-10 border-b border-border-control bg-bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center gap-3 px-4 sm:px-6">
          <Link href={returnHref} aria-label="Back to library" className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm">
            <ArrowLeftIcon /><span className="hidden sm:inline">Library</span>
          </Link>
          <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">Saved link</span>
          <button type="button" aria-label="Organize" disabled={organizeMutation !== null} className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm disabled:opacity-60" onClick={() => {
            setTagError(null);
            setCollectionError(null);
            setOrganizerSide(document.documentElement.dir === "rtl" ? "left" : "right");
            setOrganizerOpen(true);
          }}><LayersIcon /><span className="hidden sm:inline">Organize</span></button>
          <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label="Open website" className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm">
            <LinkIcon /><span className="hidden sm:inline">Open website</span>
          </a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[100rem] items-start gap-8 px-5 pb-24 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="min-w-0 lg:mx-auto lg:w-full lg:max-w-5xl">
        <div className="squircle-panel overflow-hidden rounded-panel border border-border-control bg-bg-surface">
          {link.previewAssetId ? <LibraryItemMedia item={link} variant="card" className="max-h-96 w-full" /> : null}
          <div className="px-5 pb-6 pt-5 sm:px-7">
            <div className="flex min-w-0 items-center gap-2 text-sm text-text-secondary"><LinkIcon className="size-4" />{linkCardHost(link)}</div>
            <h1 className="mt-3 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
            {link.previewDescription ? <p className="mt-3 text-sm leading-relaxed text-text-secondary">{link.previewDescription}</p> : null}
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="mt-4 block break-all text-sm text-text-secondary underline underline-offset-2 hover:text-text-primary">{link.url}</a>
          </div>
        </div>

        <LinkPersonalNote link={link} onSaved={(updated) => {
          applyLinkUpdate(updated);
        }} />
        </div>

        <aside aria-label="Link details" className="library-panel rounded-panel border border-border-control bg-bg-surface p-5 lg:sticky lg:top-24">
          <h2 className="text-base font-semibold">Details</h2>
          {itemCollections.length ? <div className="mt-6">
            <h3 className="mb-2 text-sm text-text-secondary">Collection</h3>
            <div className="flex flex-wrap gap-2">{itemCollections.map((collection) => <ItemDetailLink key={collection.id} href={`/?collection=${encodeURIComponent(collection.id)}`}>{collection.name}</ItemDetailLink>)}</div>
          </div> : null}
          {itemTags.length ? <div className="mt-6">
            <h3 className="mb-2 text-sm text-text-secondary">Tags</h3>
            <div className="flex flex-wrap gap-2">{itemTags.map((tag) => <ItemDetailLink key={tag.id} href={`/?tag=${encodeURIComponent(tag.id)}`}>{tag.name}</ItemDetailLink>)}</div>
          </div> : null}
          <dl className="mt-7 grid gap-3 text-sm"><div><dt className="text-text-secondary">Saved</dt><dd className="mt-0.5">{new Date(link.createdAt).toLocaleDateString()}</dd></div></dl>
        </aside>
      </main>

      <ItemOrganizerDrawer
        open={organizerOpen}
        onOpenChange={setOrganizerOpen}
        side={organizerSide}
        itemTitle={title}
        tags={itemTags}
        collections={itemCollections}
        tagSuggestions={state.tags.filter((tag) => !link.tagIds.includes(tag.id))}
        collectionSuggestions={state.collections.filter((collection) => !link.collectionIds.includes(collection.id))}
        disabled={organizeMutation !== null}
        pendingTag={organizeMutation === "tag"}
        pendingCollection={organizeMutation === "collection"}
        tagError={tagError}
        collectionError={collectionError}
        onAddTag={(name) => void addTag(name)}
        onRemoveTag={(tagId) => void removeTag(tagId)}
        onMoveToCollection={(name) => void moveToCollection(name)}
      />
    </div>
  );
}

function LinkPageUnavailable({ status, returnHref }: { status: "loading" | "missing" | "error"; returnHref: string }) {
  const message = status === "loading" ? "Loading link…" : status === "missing" ? "Link not found." : "Couldn't load this link.";
  return <main className="grid min-h-dvh place-items-center bg-bg-canvas p-5">
    <div className="text-center">
      <p className="text-text-secondary">{message}</p>
      <Link href={returnHref} className="ui-control mt-5 inline-flex min-h-10 items-center px-4">Return to library</Link>
    </div>
  </main>;
}

function LinkPersonalNote({ link, onSaved }: { link: LinkItem; onSaved: (updated: LinkItem) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [format, setFormat] = useState<"plain" | "markdown">("plain");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasNote = Boolean(link.noteContent?.trim());

  function startEditing() {
    setDraft(link.noteContent ?? "");
    setFormat(link.noteFormat === "markdown" ? "markdown" : "plain");
    setSaveError(null);
    setEditing(true);
  }

  async function saveNote() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateLink(link.id, { url: link.url, noteContent: draft, noteFormat: format });
      onSaved(updated);
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof LinkValidationError ? error.message : "Couldn't save your note.");
    } finally {
      setSaving(false);
    }
  }

  return <section aria-labelledby="personal-note-heading" className="mt-10 border-t border-border-control pt-7">
    <div className="flex items-center justify-between gap-4">
      <h2 id="personal-note-heading" className="text-xl font-semibold">My note</h2>
      {!editing && hasNote ? <button type="button" onClick={startEditing} className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm"><EditIcon />Edit note</button> : null}
    </div>
    {editing ? (
      <div className="mt-5 flex flex-col gap-4">
        <label htmlFor="link-page-note" className="text-sm font-medium">Your note</label>
        <textarea id="link-page-note" className="ui-field min-h-56 w-full resize-y px-4 py-3 text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={saving} />
        <NoteFormatControl format={format} disabled={saving} onChange={setFormat} />
        {format === "markdown" && draft.trim() ? <div aria-label="Markdown preview" className="rounded-input border border-border-control bg-bg-control p-4"><NoteContent content={draft} format="markdown" /></div> : null}
        {saveError ? <p role="alert" className="text-sm text-text-danger">{saveError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void saveNote()} disabled={saving} className="ui-control ui-primary min-h-10 px-4 text-sm font-medium disabled:opacity-60">{saving ? "Saving…" : "Save note"}</button>
          <button type="button" onClick={() => setEditing(false)} disabled={saving} className="ui-control min-h-10 px-4 text-sm">Cancel</button>
        </div>
      </div>
    ) : hasNote ? (
      <article className="mt-6"><NoteContent content={link.noteContent!} format={link.noteFormat === "markdown" ? "markdown" : "plain"} headingStart={2} /></article>
    ) : (
      <div className="mt-5">
        <p className="text-sm text-text-secondary">Keep your own thoughts with this link. The website preview stays separate.</p>
        <button type="button" onClick={startEditing} className="ui-control mt-4 min-h-10 px-4 text-sm font-medium">Write a note</button>
      </div>
    )}
  </section>;
}
