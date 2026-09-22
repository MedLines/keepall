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
  if (note.title) return note.title;
  const firstLine = note.content.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
  if (note.format === "markdown" && /^(?:```|~~~|---+$)/.test(firstLine)) return "Untitled note";
  const readable = note.format === "markdown"
    ? firstLine.replace(/^#{1,6}\s+/, "").replace(/^[-*+]\s+(?:\[[ xX]\]\s*)?/, "").replace(/[`*_~]/g, "").trim()
    : firstLine;
  if (!readable || /^```|^---+$/.test(readable)) return "Untitled note";
  if (readable.length <= 64) return readable;
  const cutoff = readable.slice(0, 63).lastIndexOf(" ");
  return `${readable.slice(0, cutoff > 40 ? cutoff : 63).trimEnd()}…`;
}

/** An inferred display title is shown once, above the reading body. */
export function noteReadingBody(note: NoteItem): string {
  if (note.title || noteListTitle(note) === "Untitled note") return note.content;
  const lines = note.content.split(/\r?\n/);
  const firstLine = lines.findIndex((line) => line.trim());
  return lines.slice(firstLine + 1).join("\n").trimStart();
}
