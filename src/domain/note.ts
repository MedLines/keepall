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

const NOTE_IMAGE_LINE = /^!\[([^\]\n]*)\]\(keepall-image:([A-Za-z0-9_-]+)\)$/;

export function parseNoteImageLine(line: string): { alt: string; assetId: string } | null {
  const match = line.trim().match(NOTE_IMAGE_LINE);
  return match ? { alt: match[1], assetId: match[2] } : null;
}

export function noteImageMarkers(content: string): { alt: string; assetId: string }[] {
  return content.split(/\r?\n/)
    .map(parseNoteImageLine)
    .filter((marker): marker is { alt: string; assetId: string } => marker !== null);
}

export function noteImageAssetIds(content: string): string[] {
  return [...new Set(noteImageMarkers(content).map((marker) => marker.assetId))];
}

export function removeNoteImageMarkerAt(content: string, markerIndex: number): string {
  const lines = content.split(/\r?\n/);
  let seen = 0;
  const lineIndex = lines.findIndex((line) => {
    if (!parseNoteImageLine(line)) return false;
    return seen++ === markerIndex;
  });
  if (lineIndex < 0) return content;

  lines.splice(lineIndex, 1);
  if (lines[lineIndex - 1]?.trim() === "" && lines[lineIndex]?.trim() === "") {
    lines.splice(lineIndex, 1);
  } else if (lineIndex === 0 && lines[0]?.trim() === "") {
    lines.shift();
  } else if (lineIndex === lines.length && lines.at(-1)?.trim() === "") {
    lines.pop();
  }
  return lines.join("\n");
}

export function insertNoteImageMarker(
  content: string,
  start: number,
  end: number,
  assetId: string,
): string {
  const before = content.slice(0, start).replace(/\n*$/, "");
  const after = content.slice(end).replace(/^\n*/, "");
  return [before, `![Image](keepall-image:${assetId})`, after]
    .filter(Boolean)
    .join("\n\n");
}

export function replaceNoteImageAssetIds(
  content: string,
  ids: Map<string, string>,
): string {
  return content.split(/\r?\n/).map((line) => {
    const match = line.trim().match(NOTE_IMAGE_LINE);
    const nextId = match && ids.get(match[2]);
    return nextId ? line.replace(`keepall-image:${match[2]}`, `keepall-image:${nextId}`) : line;
  }).join("\n");
}

function titleLineIndex(note: NoteItem): number {
  return note.content.split(/\r?\n/).findIndex((line) =>
    Boolean(line.trim()) && !NOTE_IMAGE_LINE.test(line.trim()),
  );
}

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
  const firstLine = note.content.split(/\r?\n/)[titleLineIndex(note)]?.trim() ?? "";
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
  lines.splice(titleLineIndex(note), 1);
  return lines.join("\n").trimStart();
}
