export type NoteItem = {
  id: string;
  type: "note";
  title: string;
  content: string;
  /** Missing on older and plain-text notes. */
  format?: "markdown";
  tagIds: string[];
  collectionIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CreateNoteInput = {
  title?: string;
  content: string;
  format?: "plain" | "markdown";
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
  const content = input.format === "markdown" ? input.content : input.content.trim();

  if (!content.trim()) {
    throw new NoteValidationError("Note content is required");
  }

  const now = options?.now ?? Date.now();

  return {
    id: options?.id ?? crypto.randomUUID(),
    type: "note",
    title: (input.title ?? "").trim(),
    content,
    ...(input.format === "markdown" ? { format: "markdown" as const } : {}),
    tagIds: [],
    collectionIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function applyNoteEdit(
  note: NoteItem,
  input: { content: string; format?: "plain" | "markdown" },
  options?: { now?: number },
): NoteItem {
  const format = input.format ?? (note.format === "markdown" ? "markdown" : "plain");
  const content = format === "markdown" ? input.content : input.content.trim();

  if (!content.trim()) {
    throw new NoteValidationError("Note content is required");
  }

  const next: NoteItem = {
    ...note,
    content,
    updatedAt: options?.now ?? Date.now(),
  };
  if (format === "markdown") {
    next.format = "markdown";
  } else {
    delete next.format;
  }
  return next;
}

export function noteListTitle(note: NoteItem): string {
  return note.title || "Untitled";
}
