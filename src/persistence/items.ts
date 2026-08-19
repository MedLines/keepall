import { buildLink, type CreateLinkInput, type LinkItem } from "@/domain/link";
import {
  applyNoteEdit,
  buildNote,
  type CreateNoteInput,
  type NoteItem,
} from "@/domain/note";
import type { Item } from "@/domain/item";
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
  return items.reverse();
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

  const next = applyNoteEdit(existing, input);
  await getDb().items.put(next);
  return next;
}

export async function listNotes(): Promise<NoteItem[]> {
  const notes = await getDb()
    .items.where("type")
    .equals("note")
    .sortBy("createdAt");

  return notes.reverse() as NoteItem[];
}
