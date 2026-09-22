"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { linkCardHost } from "@/domain/card-display";
import { LinkValidationError, type LinkItem } from "@/domain/link";
import { getItem, updateLink } from "@/persistence/items";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { LibraryItemMedia } from "./library-item-media";
import { NoteContent } from "./note-content";
import { NoteFormatControl } from "./note-format-control";
import { ArrowLeftIcon, EditIcon, LinkIcon } from "./shell-icons";

type LoadState =
  | { status: "loading" | "missing" | "error" }
  | { status: "ready"; link: LinkItem };

export function LinkItemPage({ itemId, returnHref }: { itemId: string; returnHref: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    const reload = () => {
      void getItem(itemId)
        .then((item) => {
          if (active) setState(item?.type === "link" ? { status: "ready", link: item } : { status: "missing" });
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

  return (
    <div className="ui-scrollbar h-full overflow-y-auto bg-bg-canvas text-text-primary">
      <header className="sticky top-0 z-10 border-b border-border-control bg-bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center gap-3 px-4 sm:px-6">
          <Link href={returnHref} aria-label="Back to library" className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm">
            <ArrowLeftIcon /><span className="hidden sm:inline">Library</span>
          </Link>
          <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">Saved link</span>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm">
            <LinkIcon /><span>Open website</span>
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
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
          setState({ status: "ready", link: updated });
          window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        }} />
      </main>
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
