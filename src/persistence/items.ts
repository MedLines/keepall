import { normalizeItemTagIds, type Item } from "@/domain/item";
import {
  applyLinkEdit,
  buildLink,
  type CreateLinkInput,
  type LinkItem,
} from "@/domain/link";
import {
  applyNoteEdit,
  buildNote,
  type CreateNoteInput,
  type NoteItem,
} from "@/domain/note";
import { assignTagId } from "@/domain/tag";
import { getDb } from "./db";

export async function createNote(input: CreateNoteInput): Promise<NoteItem> {
  const note = buildNote(input);
  await getDb().items.add(note);
  return note;
}

export async function createLink(input: CreateLinkInput): Promise<LinkItem> {
  const link = buildLink(input);
  await getDb().items.add(link);
  return link;
}

export async function listItems(): Promise<Item[]> {
  const items = await getDb().items.orderBy("createdAt").toArray();
  return items.reverse().map((item) => normalizeItemTagIds(item));
}

export async function deleteItem(id: string): Promise<void> {
  await getDb().items.delete(id);
}

export async function updateNote(
  id: string,
  input: { content: string },
): Promise<NoteItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "note") {
    throw new Error("Note not found");
  }

  const next = applyNoteEdit(normalizeItemTagIds(existing), input);
  await getDb().items.put(next);
  return next;
}

export async function updateLink(
  id: string,
  input: { url: string; title?: string },
): Promise<LinkItem> {
  const existing = await getDb().items.get(id);

  if (!existing || existing.type !== "link") {
    throw new Error("Link not found");
  }

  const next = applyLinkEdit(normalizeItemTagIds(existing), input);
  await getDb().items.put(next);
  return next;
}

export async function assignTagToItem(
  itemId: string,
  tagId: string,
): Promise<Item> {
  const tag = await getDb().tags.get(tagId);

  if (!tag) {
    throw new Error("Tag not found");
  }

  const existing = await getDb().items.get(itemId);

  if (!existing) {
    throw new Error("Item not found");
  }

  const current = normalizeItemTagIds(existing);
  const next = {
    ...current,
    tagIds: assignTagId(current.tagIds, tagId),
    updatedAt: Date.now(),
  };

  await getDb().items.put(next);
  return next;
}

export async function listNotes(): Promise<NoteItem[]> {
  const notes = await getDb()
    .items.where("type")
    .equals("note")
    .sortBy("createdAt");

  return notes.reverse().map((note) => normalizeItemTagIds(note as NoteItem));
}
