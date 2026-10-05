"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DocumentValidationError, type DocumentItem } from "@/domain/document";
import type { Collection } from "@/domain/collection";
import type { Tag } from "@/domain/tag";
import { resolveItemCollections, resolveItemTags, type Item } from "@/domain/item";
import { createCollection, listCollections } from "@/persistence/collections";
import { createTag, listTags } from "@/persistence/tags";
import { assignCollectionToItem, assignTagToItem, clearCollectionOnItem, deleteItem, getItem, unassignTagFromItem } from "@/persistence/items";
import { getDocumentOriginal, updateDocument } from "@/persistence/documents";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentContent } from "./document-content";
import { DocumentItemEditDialog } from "./item-edit-dialog";
import { ItemLibraryDetails } from "./item-library-details";
import { ItemOrganizerDrawer } from "./item-organizer-drawer";
import { ItemPageHeader } from "./item-page-header";
import { ITEM_DETAILS_CONTROL, ITEM_DETAILS_POSITION, ITEM_PAGE_GRID, ITEM_PAGE_SCROLL } from "./item-page-styles";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { NoteContent } from "./note-content";
import { DownloadIcon } from "./shell-icons";

type State = { itemId: string } & (
  | { status: "loading" | "missing" | "error" }
  | { status: "ready"; item: DocumentItem; tags: Tag[]; collections: Collection[] }
);

export function DocumentItemPage({ itemId, returnHref }: { itemId: string; returnHref: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ itemId, status: "loading" });
  const [editing, setEditing] = useState(false);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [operation, setOperation] = useState<"save" | "tag" | "collection" | "delete" | "download" | null>(null);
  const operationRef = useRef(false);
  const [error, setError] = useState<{ kind: NonNullable<typeof operation>; message: string } | null>(null);
  const [organizerSide, setOrganizerSide] = useState<"left" | "right">("right");

  useEffect(() => {
    let active = true;
    void Promise.all([getItem(itemId), listTags(), listCollections()]).then(([item, tags, collections]) => {
      if (active) setState(item?.type === "document" ? { itemId, status: "ready", item, tags, collections } : { itemId, status: "missing" });
    }).catch(() => { if (active) setState({ itemId, status: "error" }); });
    return () => { active = false; };
  }, [itemId]);

  function applyItem(item: Item) {
    if (item.type !== "document") throw new Error("Document not found");
    setState((current) => current.status === "ready" && current.itemId === item.id ? { ...current, item } : current);
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
  }

  async function mutate(kind: NonNullable<typeof operation>, task: () => Promise<void>) {
    if (operationRef.current) return;
    operationRef.current = true;
    setOperation(kind);
    setError(null);
    try { await task(); }
    catch (caught) { setError({ kind, message: caught instanceof DocumentValidationError ? caught.message : kind === "download" ? "Couldn't download the file. Try again or restore a backup." : "Couldn't save this change. Try again." }); }
    finally { operationRef.current = false; setOperation(null); }
  }

  function organize(kind: "tag" | "collection", task: () => Promise<Item>) {
    void mutate(kind, async () => {
      applyItem(await task());
      const [tags, collections] = await Promise.all([listTags(), listCollections()]);
      setState((current) => current.status === "ready" ? { ...current, tags, collections } : current);
    });
  }

  function downloadOriginal(item: DocumentItem) {
    void mutate("download", async () => {
      const original = await getDocumentOriginal(item.id);
      if (!original) throw new Error("Missing original");
      const blob = new Blob([new Uint8Array(original.bytes)], { type: item.format === "markdown" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = item.sourceFileName;
        anchor.click();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 0); }
    });
  }

  if (state.status !== "ready" || state.itemId !== itemId) return <main className="grid min-h-dvh place-items-center bg-bg-canvas p-5">
    <div className="text-center"><p className="text-text-secondary">{state.itemId !== itemId || state.status === "loading" ? "Loading document…" : state.status === "missing" ? "Document not found. It may be in Trash." : "Couldn't load this document."}</p>
      <Link href={returnHref} className="ui-control mt-5 inline-flex min-h-11 items-center px-4">Return to library</Link>
    </div>
  </main>;

  const { item, tags, collections } = state;
  const itemTags = resolveItemTags(item, new Map(tags.map((tag) => [tag.id, tag])));
  const itemCollections = resolveItemCollections(item, new Map(collections.map((collection) => [collection.id, collection])));
  const busy = operation !== null;
  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-canvas text-text-primary">
    <ItemPageHeader returnHref={returnHref} title={item.title} />
    <main className={ITEM_PAGE_SCROLL} data-testid="item-page-scroll">
      <div className={ITEM_PAGE_GRID}>
        <div className="row-start-2 min-w-0 lg:col-start-1 lg:row-start-1 lg:mx-auto lg:w-full lg:max-w-4xl lg:pt-6">
          <h1 className="break-words text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{item.title}</h1>
          <article aria-label="Document content" className="mt-9 border-t border-border-control pt-8"><DocumentContent key={item.id} item={item} /></article>
          <section aria-label="Personal note" className="mt-9 border-t border-border-control pt-8">
            <h2 className="mb-4 text-lg font-semibold">My note</h2>
            {item.noteContent ? <NoteContent content={item.noteContent} format={item.noteFormat ?? "plain"} /> : <button type="button" className="ui-control min-h-11 px-4 text-sm font-medium" disabled={busy} onClick={() => { setError(null); setEditing(true); }}>Add a personal note</button>}
          </section>
        </div>
        <ItemLibraryDetails label="Document details" summary={{ label: "Format", value: item.format === "markdown" ? "Markdown" : "Plain text" }}
          collections={itemCollections} tags={itemTags} createdAt={item.createdAt} updatedAt={item.updatedAt} sourceFileName={item.sourceFileName}
          className={ITEM_DETAILS_POSITION} disabled={busy} editDisabled={editing} editLabel="Edit document" deleteLabel="Move document to Trash"
          onEdit={() => { setError(null); setEditing(true); }} onOrganize={() => { setError(null); setOrganizerSide(document.documentElement.dir === "rtl" ? "left" : "right"); setOrganizerOpen(true); }} onDelete={() => { setError(null); setDeleteOpen(true); }}
          controls={<>
            <button type="button" className={ITEM_DETAILS_CONTROL} disabled={busy} onClick={() => downloadOriginal(item)}><DownloadIcon />{operation === "download" ? "Downloading…" : "Download file"}</button>
            {error && !editing && !organizerOpen && !deleteOpen ? <p role="alert" className="text-sm text-text-danger">{error.message}</p> : null}
          </>}
        />
      </div>
    </main>
    {editing ? <DocumentItemEditDialog key={item.id} item={item} open busy={busy} error={error?.message ?? null} onOpenChange={setEditing}
      onSave={(draft) => void mutate("save", async () => { applyItem(await updateDocument(item.id, draft)); setEditing(false); })} /> : null}
    <ItemOrganizerDrawer open={organizerOpen} onOpenChange={setOrganizerOpen} side={organizerSide} itemTitle={item.title}
      tags={itemTags} collections={itemCollections} tagSuggestions={tags.filter((tag) => !item.tagIds.includes(tag.id))}
      collectionSuggestions={collections.filter((collection) => !item.collectionIds.includes(collection.id))}
      disabled={busy} pendingTag={operation === "tag"} pendingCollection={operation === "collection"} tagError={error?.kind === "tag" ? error.message : null} collectionError={error?.kind === "collection" ? error.message : null}
      onAddTag={(name) => organize("tag", async () => assignTagToItem(item.id, (await createTag({ name })).id))}
      onRemoveTag={(id) => organize("tag", () => unassignTagFromItem(item.id, id))}
      onMoveToCollection={(name) => organize("collection", async () => assignCollectionToItem(item.id, (await createCollection({ name })).id))}
      onMoveToUnsorted={() => organize("collection", () => clearCollectionOnItem(item.id))}
    />
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Move this document to Trash?" description={`Move “${item.title}” to Trash? You can restore it later.`}
      confirmLabel="Move to Trash" pendingLabel="Moving…" busy={busy} error={error?.message ?? null}
      onConfirm={() => void mutate("delete", async () => { await deleteItem(item.id); window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT)); router.push(returnHref); })}
    />
  </div>;
}
