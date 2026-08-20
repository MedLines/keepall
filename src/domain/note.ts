export type NoteItem = {
  id: string;
  type: "note";
  title: string;
  content: string;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CreateNoteInput = {
  title?: string;
  content: string;
};

export class NoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteValidationError";
  }
}

export function buildNote(
  input: CreateNoteInput,
  options?: { id?: string; now?: number },
): NoteItem {
  const content = input.content.trim();

  if (!content) {
    throw new NoteValidationError("Note content is required");
  }

  const now = options?.now ?? Date.now();

  return {
    id: options?.id ?? crypto.randomUUID(),
    type: "note",
    title: (input.title ?? "").trim(),
    content,
    tagIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function applyNoteEdit(
  note: NoteItem,
  input: { content: string },
  options?: { now?: number },
): NoteItem {
  const content = input.content.trim();

  if (!content) {
    throw new NoteValidationError("Note content is required");
  }

  return {
    ...note,
    content,
    updatedAt: options?.now ?? Date.now(),
  };
}

export function noteListTitle(note: NoteItem): string {
  return note.title || "Untitled";
}
