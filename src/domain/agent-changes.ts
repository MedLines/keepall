// Rules for changes agents make to a library: forgiving input parsing, planning against the current library,
// and undo. Pure: persistence applies the planned records in one transaction with their before-copies.
import { AgentToolError } from "./agent-tools";
import { fileGroups, PENDING_ASSET_PREFIX, type AgentFile } from "./agent-files";
import { buildCollection, normalizeCollectionName, type Collection } from "./collection";
import { itemListTitle, type Item } from "./item";
import { buildLink, normalizeLinkUrl } from "./link";
import { buildNote } from "./note";
import { buildTag, normalizeTagName, type Tag } from "./tag";

/** What a paired agent may do. Suggestions wait for review in Keepall; changes apply at once and can be undone. */
export type AgentAccess = "read" | "suggest" | "change";
export const AGENT_ACCESS_LEVELS: readonly AgentAccess[] = ["read", "suggest", "change"];
/** Under "change", a call touching more items than this still goes to review. */
export const DIRECT_CHANGE_LIMIT = 10;
export const AGENT_WRITE_TOOLS = ["move_to_collection", "tag_items", "add_note", "rename_collection", "save_link", "save_note", "move_to_trash"] as const;
export type AgentWriteTool = typeof AGENT_WRITE_TOOLS[number];

const MAX_ITEMS_PER_CALL = 200;
const MAX_NAME = 120;
const MAX_NOTE = 20_000;
const MAX_URL = 4096;
const UNSORTED_NAMES = new Set(["", "unsorted", "none", "no collection"]);

export type ChangeRequest =
  | { kind: "move"; itemIds: string[]; collection: string | null }
  | { kind: "tag"; itemIds: string[]; add: string[]; remove: string[] }
  | { kind: "note"; itemId: string; text: string; replace: boolean; format?: NoteFormat }
  | { kind: "rename_collection"; from: string; to: string }
  | { kind: "save_link"; url: string; title?: string; note?: string; format?: NoteFormat; collection?: string; tags: string[]; itemId?: string }
  | { kind: "save_note"; text: string; title?: string; format?: NoteFormat; collection?: string; tags: string[]; itemId?: string }
  /** Files the agent sent. `itemIds` holds one ID per item they become (see fileGroups), fixed when the agent asked. */
  | { kind: "save_file"; files: AgentFile[]; gallery: boolean; itemIds: string[]; title?: string; note?: string; format?: NoteFormat; collection?: string; tags: string[] }
  | { kind: "trash"; itemIds: string[] };

type NoteFormat = "plain" | "markdown";

/** `format` as agents send it: markdown, md, plain, text, or nothing (Keepall decides from the text). */
function noteFormat(value: unknown): NoteFormat | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const format = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["markdown", "md"].includes(format)) return "markdown";
  if (["plain", "text", "txt", "plain text"].includes(format)) return "plain";
  throw new AgentToolError('format must be "markdown" or "plain". Leave it out and Keepall decides from the text.');
}

/**
 * Whether text is written in Markdown: headings, lists, checklists, quotes, code fences, tables, links, emphasis,
 * or highlights. One line of ordinary prose isn't.
 */
export function looksLikeMarkdown(text: string): boolean {
  return [
    /^#{1,6}\s+\S/m, /^\s*(?:[-*+]|\d+[.)])\s+\S/m, /^\s*>\s?\S/m, /^\s*(?:```|~~~)/m, /^\s*\|.*\|\s*$/m,
    /\[[^\]\n]+\]\([^)\s]+\)/, /(?:\*\*|__)\S[^\n]*?\S?(?:\*\*|__)/, /==[^=\s][^=\n]*==/, /`[^`\n]+`/,
  ].some((pattern) => pattern.test(text));
}

/** The format a note should get: what the agent said, or what the text looks like. */
function resolvedFormat(format: NoteFormat | undefined, text: string): NoteFormat {
  return format ?? (looksLikeMarkdown(text) ? "markdown" : "plain");
}

export type LibraryState = { items: readonly Item[]; collections: readonly Collection[]; tags: readonly Tag[] };

export type RecordChange =
  | { table: "items"; id: string; before: Item | null; after: Item }
  | { table: "collections"; id: string; before: Collection | null; after: Collection | null }
  | { table: "tags"; id: string; before: Tag | null; after: Tag | null };

/**
 * One concrete effect on one item (or collection), with a stable key. Reviewers untick effects by key, and the
 * same key from two suggestions is the same effect, so a tag suggested twice shows and applies once.
 */
export type StepEffect =
  | { kind: "collection"; key: string; itemId: string; to: string | null; isNew: boolean }
  | { kind: "tag"; key: string; itemId: string; tag: string; op: "add" | "remove" }
  | { kind: "note"; key: string; itemId: string; before: string; after: string }
  | { kind: "trash"; key: string; itemId: string }
  | { kind: "rename"; key: string; from: string; to: string }
  | { kind: "create"; key: string; itemId: string };

/** One suggested change as people and agents read it. "excluded" means the reviewer unticked all of it. */
export type PlannedStep = {
  id: string; text: string; status: "planned" | "unchanged" | "skipped" | "excluded"; notes: string[]; itemIds: string[]; effects: StepEffect[];
};
/**
 * An item to save from files. It isn't in `records`: files are saved the way Add files saves them, with their
 * thumbnails and text, once the change applies. `item` shows how it will look, with `pending:` asset IDs.
 */
export type PlannedFileItem = { stepId: string; item: Item; files: AgentFile[]; collection?: string; tags: string[]; note?: string; format?: NoteFormat; title?: string };
export type ChangePlan = {
  records: RecordChange[]; steps: PlannedStep[]; itemsAffected: number; created: { items: string[]; collections: string[]; tags: string[] };
  files: PlannedFileItem[];
};
/**
 * What a suggestion saw of each item it targets. A fingerprint of the fields agents can change, so background
 * updates such as a fetched link preview don't invalidate it. Older proposals stored the item's version number.
 */
export type SeenItems = Record<string, string | number>;
export type PlanInput = { id: string; request: ChangeRequest; seen?: SeenItems };

export const effectKeys = {
  collection: (itemId: string) => `${itemId}#collection`,
  tag: (itemId: string, op: "add" | "remove", name: string) => `${itemId}#tag:${op}:${normalizeTagName(name).toLowerCase()}`,
  note: (itemId: string, stepId: string) => `${itemId}#note:${stepId}`,
  trash: (itemId: string) => `${itemId}#trash`,
  rename: (from: string) => `rename:${normalizeCollectionName(from).toLowerCase()}`,
  create: (stepId: string, itemId?: string) => (itemId ? `create:${stepId}:${itemId}` : `create:${stepId}`),
};

// Parsing. Agents vary: accept one ID or many, a tag or a list of tags, and "Unsorted" for no collection.

function list(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.includes(",") ? value.split(",") : [value];
  return [value];
}

function itemIds(args: Record<string, unknown>): string[] {
  const ids = [...list(args.item_ids), ...list(args.item_id), ...list(args.ids)]
    .map((id) => (typeof id === "string" ? id.trim() : id));
  if (!ids.length) throw new AgentToolError("item_ids must list at least one item ID from search_items.");
  if (ids.some((id) => typeof id !== "string" || !id || id.length > 100)) throw new AgentToolError("item_ids must be item IDs from search_items, like \"3f2b…\".");
  const unique = [...new Set(ids as string[])];
  if (unique.length > MAX_ITEMS_PER_CALL) throw new AgentToolError(`Change at most ${MAX_ITEMS_PER_CALL} items per call.`);
  return unique;
}

function text(value: unknown, field: string, max: number, required: true): string;
function text(value: unknown, field: string, max: number, required?: false): string | undefined;
function text(value: unknown, field: string, max: number, required = false) {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim() && !required)) {
    if (required) throw new AgentToolError(`${field} is required.`);
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) throw new AgentToolError(`${field} must be text.`);
  if (value.length > max) throw new AgentToolError(`${field} must be at most ${max} characters.`);
  return value.trim();
}

function names(value: unknown, field: string): string[] {
  const values = list(value).map((name) => (typeof name === "string" ? name.trim() : name)).filter((name) => name !== "");
  if (values.some((name) => typeof name !== "string" || name.length > MAX_NAME)) throw new AgentToolError(`${field} must be names of at most ${MAX_NAME} characters.`);
  return [...new Set(values as string[])];
}

function collectionName(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new AgentToolError("collection must be a collection name, or \"Unsorted\" for none.");
  const name = normalizeCollectionName(value);
  if (UNSORTED_NAMES.has(name.toLowerCase())) return null;
  if (name.length > MAX_NAME) throw new AgentToolError(`collection must be at most ${MAX_NAME} characters.`);
  return name;
}

export function isAgentWriteTool(tool: string): tool is AgentWriteTool {
  return AGENT_WRITE_TOOLS.some((name) => name === tool);
}

const PARSERS: Record<AgentWriteTool, (args: Record<string, unknown>) => ChangeRequest> = {
  move_to_collection(args) {
    if (!("collection" in args)) throw new AgentToolError("collection is required: a collection name, or \"Unsorted\" for none.");
    return { kind: "move", itemIds: itemIds(args), collection: collectionName(args.collection) };
  },
  tag_items(args) {
    const add = names(args.add ?? args.tags ?? args.add_tags, "add");
    const remove = names(args.remove ?? args.remove_tags, "remove");
    if (!add.length && !remove.length) throw new AgentToolError("Give tags to add, tags to remove, or both.");
    return { kind: "tag", itemIds: itemIds(args), add, remove };
  },
  add_note(args) {
    const [itemId, ...rest] = itemIds(args);
    if (rest.length) throw new AgentToolError("add_note takes one item_id. Call it once per item.");
    return { kind: "note", itemId, text: text(args.text ?? args.note, "text", MAX_NOTE, true), replace: args.replace === true, format: noteFormat(args.format) };
  },
  rename_collection(args) {
    return { kind: "rename_collection", from: text(args.collection ?? args.from, "collection", MAX_NAME, true), to: text(args.new_name ?? args.to, "new_name", MAX_NAME, true) };
  },
  save_link(args) {
    return {
      kind: "save_link", url: text(args.url, "url", MAX_URL, true), title: text(args.title, "title", 500), note: text(args.note, "note", MAX_NOTE), format: noteFormat(args.format),
      collection: collectionName(args.collection ?? "") ?? undefined, tags: names(args.tags, "tags"),
    };
  },
  save_note(args) {
    return {
      kind: "save_note", text: text(args.text ?? args.note, "text", MAX_NOTE, true), title: text(args.title, "title", 500), format: noteFormat(args.format),
      collection: collectionName(args.collection ?? "") ?? undefined, tags: names(args.tags, "tags"),
    };
  },
  move_to_trash(args) {
    return { kind: "trash", itemIds: itemIds(args) };
  },
};

/**
 * Gives a request that saves something new the ID its item will have, fixed when the agent asks. The review can
 * then open, decide, and apply that item one at a time, and the agent is told the ID it ends up with.
 */
export function withCreatedItemId(request: ChangeRequest, newId: () => string): ChangeRequest {
  return (request.kind === "save_link" || request.kind === "save_note") && !request.itemId ? { ...request, itemId: newId() } : request;
}

/** The item a saving request creates, when it has one. */
export function createdItemId(request: ChangeRequest): string | undefined {
  return request.kind === "save_link" || request.kind === "save_note" ? request.itemId : undefined;
}

/** Every item a saving request creates. */
export function createdItemIds(request: ChangeRequest): string[] {
  if (request.kind === "save_file") return request.itemIds;
  const id = createdItemId(request);
  return id ? [id] : [];
}

export function parseChangeRequest(tool: AgentWriteTool, args: Record<string, unknown>): ChangeRequest {
  return PARSERS[tool](args);
}

// Planning.

function quote(value: string) {
  const short = value.length > 60 ? `${value.slice(0, 57)}…` : value;
  return `"${short}"`;
}

function itemList(items: readonly Item[]) {
  const titles = items.map((item) => quote(itemListTitle(item) || "Untitled"));
  if (titles.length <= 2) return titles.join(" and ") || "no items";
  return `${titles[0]} and ${titles.length - 1} more`;
}

function same(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

const NOTE_FIELD = { note: "content", image: "caption", link: "noteContent", video: "noteContent", document: "noteContent" } as const;

/** Sets the format of an item's note: `format` on notes, `captionFormat` on images, `noteFormat` on the rest. */
function withNoteFormat(item: Item, format: NoteFormat | undefined): Item {
  if (!format) return item;
  const field = item.type === "note" ? "format" : item.type === "image" ? "captionFormat" : "noteFormat";
  const next = { ...item } as Record<string, unknown>;
  if (format === "markdown") next[field] = "markdown";
  else delete next[field];
  return next as Item;
}

export function itemNote(item: Item): string {
  return String((item as Record<string, unknown>)[NOTE_FIELD[item.type]] ?? "");
}

type Targets = { found: Item[]; notes: string[] };

/** Applies requests to a working copy of the library, recording each touched row's original and planned state. */
class ChangePlanner {
  private readonly originalItems: Map<string, Item>;
  private readonly originalCollections: Map<string, Collection>;
  private readonly items: Map<string, Item>;
  private readonly collections: Map<string, Collection>;
  private readonly tags: Map<string, Tag>;
  private readonly records = new Map<string, RecordChange>();
  private skippedByReviewer = 0;
  readonly created = { items: [] as string[], collections: [] as string[], tags: [] as string[] };
  private readonly files: PlannedFileItem[] = [];

  constructor(state: LibraryState, private readonly now: number, private readonly newId: () => string, private readonly excluded: ReadonlySet<string>) {
    this.originalItems = new Map(state.items.map((item) => [item.id, item]));
    this.originalCollections = new Map(state.collections.map((collection) => [collection.id, collection]));
    this.items = new Map(this.originalItems);
    this.collections = new Map(this.originalCollections);
    this.tags = new Map(state.tags.map((tag) => [tag.id, tag]));
  }

  plan(inputs: readonly PlanInput[]): ChangePlan {
    const steps = inputs.map(({ id, request, seen }) => {
      const step: PlannedStep = { id, text: "", status: "planned", notes: [], itemIds: [], effects: [] };
      this.skippedByReviewer = 0;
      this.apply(step, request, seen);
      if (step.status !== "planned" && this.skippedByReviewer && !step.effects.length) step.status = "excluded";
      return step;
    });
    const records = [...this.records.values()];
    return { records, steps, itemsAffected: records.filter((change) => change.table === "items").length + this.files.length, created: this.created, files: this.files };
  }

  /** Whether the reviewer unticked this effect. Counts it, so an all-unticked step reads as excluded, not skipped. */
  private unticked(key: string) {
    if (!this.excluded.has(key)) return false;
    this.skippedByReviewer += 1;
    return true;
  }

  private apply(step: PlannedStep, request: ChangeRequest, seen: SeenItems | undefined) {
    switch (request.kind) {
      case "move": return this.move(step, request, seen);
      case "tag": return this.tag(step, request, seen);
      case "note": return this.note(step, request, seen);
      case "rename_collection": return this.rename(step, request);
      case "save_link": return this.saveLink(step, request);
      case "save_note": return this.saveNote(step, request);
      case "save_file": return this.saveFile(step, request);
      case "trash": return this.trash(step, request, seen);
    }
  }

  private record(change: RecordChange) {
    const key = `${change.table}:${change.id}`;
    const existing = this.records.get(key);
    this.records.set(key, (existing ? { ...change, before: existing.before } : change) as RecordChange);
  }

  private putItem(next: Item) {
    this.items.set(next.id, next);
    this.record({ table: "items", id: next.id, before: this.originalItems.get(next.id) ?? null, after: next });
  }

  private bump(item: Item): Item {
    return { ...item, updatedAt: Math.max(this.now, item.updatedAt + 1) };
  }

  private findCollection(name: string) {
    return [...this.collections.values()].find((collection) => same(collection.name, name));
  }

  private ensureCollection(name: string) {
    const existing = this.findCollection(name);
    if (existing) return { collection: existing, isNew: false };
    const collection = buildCollection({ name }, { id: this.newId(), now: this.now });
    this.collections.set(collection.id, collection);
    this.record({ table: "collections", id: collection.id, before: null, after: collection });
    this.created.collections.push(collection.name);
    return { collection, isNew: true };
  }

  private findTags(name: string) {
    const normalized = normalizeTagName(name);
    return [...this.tags.values()].filter((tag) => same(tag.name, normalized));
  }

  private ensureTag(name: string) {
    const [existing] = this.findTags(name);
    if (existing) return existing;
    const tag = buildTag({ name }, { id: this.newId(), now: this.now });
    this.tags.set(tag.id, tag);
    this.record({ table: "tags", id: tag.id, before: null, after: tag });
    this.created.tags.push(tag.name);
    return tag;
  }

  /** The live item for an ID, or why it can't be changed. */
  private target(id: string, seen: SeenItems | undefined): Item | string {
    const item = this.items.get(id);
    if (!item || item.deletedAt !== undefined) return `${id} isn't in the library (it may be in Trash)`;
    const original = this.originalItems.get(id);
    const saw = seen?.[id];
    const changed = saw !== undefined && original && (typeof saw === "number" ? original.updatedAt !== saw : itemFingerprint(original) !== saw);
    if (changed) return `${quote(itemListTitle(item))} changed in Keepall after this was suggested`;
    return item;
  }

  private targets(ids: readonly string[], seen: SeenItems | undefined): Targets {
    const found: Item[] = [];
    const notes: string[] = [];
    for (const id of ids) {
      const result = this.target(id, seen);
      if (typeof result === "string") notes.push(result);
      else found.push(result);
    }
    return { found, notes };
  }

  /**
   * Puts an item into a collection and adds tags. For an item that already exists, each part is an effect the
   * reviewer can untick; a new item is created whole.
   */
  private organize(step: PlannedStep, item: Item, collection: string | undefined, tagNames: readonly string[], existing: boolean) {
    const parts: string[] = [];
    let next = this.file(step, item, collection, existing, parts);
    const added: string[] = [];
    for (const name of tagNames) {
      if (existing && this.unticked(effectKeys.tag(item.id, "add", name))) continue;
      const tag = this.ensureTag(name);
      if (next.tagIds.includes(tag.id)) continue;
      next = { ...next, tagIds: [...next.tagIds, tag.id] };
      added.push(tag.name);
      if (existing) step.effects.push({ kind: "tag", key: effectKeys.tag(item.id, "add", tag.name), itemId: item.id, tag: tag.name, op: "add" });
    }
    if (added.length) parts.push(`tagged ${added.map(quote).join(", ")}`);
    return { item: next, parts };
  }

  /** The collection half of organize. */
  private file(step: PlannedStep, item: Item, collection: string | undefined, existing: boolean, parts: string[]): Item {
    if (!collection || (existing && this.unticked(effectKeys.collection(item.id)))) return item;
    const { collection: row, isNew } = this.ensureCollection(collection);
    if (item.collectionIds[0] === row.id) return item;
    parts.push(`to ${quote(row.name)}${isNew ? " (new collection)" : ""}`);
    if (existing) step.effects.push({ kind: "collection", key: effectKeys.collection(item.id), itemId: item.id, to: row.name, isNew });
    return { ...item, collectionIds: [row.id], collectionAddedAt: this.now };
  }

  private settle(step: PlannedStep, changed: readonly Item[], targets: Targets) {
    step.notes.push(...targets.notes);
    step.itemIds = changed.map((item) => item.id);
    if (!changed.length) step.status = targets.found.length ? "unchanged" : "skipped";
  }

  private move(step: PlannedStep, request: Extract<ChangeRequest, { kind: "move" }>, seen: SeenItems | undefined) {
    const targets = this.targets(request.itemIds, seen);
    const existing = request.collection ? this.findCollection(request.collection) : undefined;
    // With no existing collection of that name, every item moves (Unsorted items included).
    const moved = targets.found.filter((item) => (request.collection ? !existing || item.collectionIds[0] !== existing.id : item.collectionIds.length > 0))
      .filter((item) => !this.unticked(effectKeys.collection(item.id)));
    // A collection is only created when something actually moves into it.
    const destination = request.collection && moved.length ? this.ensureCollection(request.collection) : { collection: existing, isNew: false };
    const name = request.collection ? destination.collection?.name ?? request.collection : null;
    for (const item of moved) {
      this.putItem(this.bump({ ...item, ...(destination.collection ? { collectionIds: [destination.collection.id], collectionAddedAt: this.now } : { collectionIds: [] }) }));
      step.effects.push({ kind: "collection", key: effectKeys.collection(item.id), itemId: item.id, to: name, isNew: destination.isNew });
    }
    const where = name ? `${quote(name)}${destination.isNew ? " (new collection)" : ""}` : "Unsorted";
    step.text = `Move ${itemList(moved.length ? moved : targets.found)} to ${where}`;
    this.settle(step, moved, targets);
  }

  private tag(step: PlannedStep, request: Extract<ChangeRequest, { kind: "tag" }>, seen: SeenItems | undefined) {
    const targets = this.targets(request.itemIds, seen);
    const changed = targets.found.filter((item) => this.retag(step, item, request));
    const parts = [request.add.length ? `add ${request.add.map(quote).join(", ")}` : "", request.remove.length ? `remove ${request.remove.map(quote).join(", ")}` : ""];
    step.text = `Tags on ${itemList(changed.length ? changed : targets.found)}: ${parts.filter(Boolean).join("; ")}`;
    this.settle(step, changed, targets);
  }

  /** Applies one tag request to one item, skipping unticked tags. Returns whether the item changed. */
  private retag(step: PlannedStep, item: Item, request: Extract<ChangeRequest, { kind: "tag" }>) {
    let tagIds = item.tagIds;
    const removable = request.remove.flatMap((name) => this.findTags(name)).filter((tag) => tagIds.includes(tag.id));
    for (const tag of removable) {
      if (this.unticked(effectKeys.tag(item.id, "remove", tag.name))) continue;
      tagIds = tagIds.filter((id) => id !== tag.id);
      step.effects.push({ kind: "tag", key: effectKeys.tag(item.id, "remove", tag.name), itemId: item.id, tag: tag.name, op: "remove" });
    }
    for (const name of request.add) {
      const [known] = this.findTags(name);
      if ((known && tagIds.includes(known.id)) || this.unticked(effectKeys.tag(item.id, "add", name))) continue;
      const tag = known ?? this.ensureTag(name);
      tagIds = [...tagIds, tag.id];
      step.effects.push({ kind: "tag", key: effectKeys.tag(item.id, "add", tag.name), itemId: item.id, tag: tag.name, op: "add" });
    }
    if (tagIds === item.tagIds) return false;
    this.putItem(this.bump({ ...item, tagIds }));
    return true;
  }

  private note(step: PlannedStep, request: Extract<ChangeRequest, { kind: "note" }>, seen: SeenItems | undefined) {
    const item = this.target(request.itemId, seen);
    if (typeof item === "string") {
      step.text = `Add a note to ${request.itemId}`;
      this.settle(step, [], { found: [], notes: [item] });
      return;
    }
    const before = itemNote(item);
    const current = before.trim();
    const next = request.replace || !current ? request.text : `${current}\n\n${request.text}`;
    step.text = `${request.replace && current ? "Replace the note on" : "Add a note to"} ${quote(itemListTitle(item) || "Untitled")}: ${quote(request.text)}`;
    const changed = next !== before && !this.unticked(effectKeys.note(item.id, step.id));
    if (changed) {
      // A new or replaced note takes the format of its text. Added text keeps the note's format, unless the agent
      // said it's Markdown, since plain text reads the same as Markdown but not the other way round.
      const format = request.replace || !current ? resolvedFormat(request.format, request.text) : request.format === "markdown" ? "markdown" : undefined;
      this.putItem(this.bump(withNoteFormat({ ...item, [NOTE_FIELD[item.type]]: next } as Item, format)));
      step.effects.push({ kind: "note", key: effectKeys.note(item.id, step.id), itemId: item.id, before, after: next });
    }
    this.settle(step, changed ? [item] : [], { found: [item], notes: [] });
  }

  private rename(step: PlannedStep, request: Extract<ChangeRequest, { kind: "rename_collection" }>) {
    const collection = this.findCollection(request.from);
    const to = normalizeCollectionName(request.to);
    const clash = this.findCollection(to);
    step.text = `Rename collection ${quote(request.from)} to ${quote(to)}`;
    if (!collection) {
      step.status = "skipped";
      step.notes.push(`No collection is named ${quote(request.from)}`);
    } else if (collection.name === to) {
      step.status = "unchanged";
    } else if (clash && clash.id !== collection.id) {
      step.status = "skipped";
      step.notes.push(`A collection named ${quote(clash.name)} already exists. Move its items instead.`);
    } else if (this.unticked(effectKeys.rename(collection.name))) {
      step.status = "excluded";
    } else {
      const next = { ...collection, name: to };
      this.collections.set(next.id, next);
      this.record({ table: "collections", id: next.id, before: this.originalCollections.get(next.id) ?? null, after: next });
      step.effects.push({ kind: "rename", key: effectKeys.rename(collection.name), from: collection.name, to });
    }
  }

  private saveLink(step: PlannedStep, request: Extract<ChangeRequest, { kind: "save_link" }>) {
    const url = normalizeLinkUrl(request.url);
    if (!url || !/^https?:/i.test(url)) {
      step.text = `Save link ${quote(request.url)}`;
      step.status = "skipped";
      step.notes.push("Only http and https addresses can be saved");
      return;
    }
    const existing = [...this.items.values()].find((item) => item.type === "link" && item.deletedAt === undefined && normalizeLinkUrl(item.url) === url);
    if (existing) {
      this.updateSavedLink(step, existing, request);
      return;
    }
    step.text = `Save link ${quote(request.title || url)}`;
    if (this.unticked(effectKeys.create(step.id))) {
      step.status = "excluded";
      return;
    }
    const link = buildLink({ url, title: request.title, noteContent: request.note, ...(request.note ? { noteFormat: resolvedFormat(request.format, request.note) } : {}) }, { id: request.itemId ?? this.newId(), now: this.now });
    const organized = this.organize(step, link, request.collection, request.tags, false);
    this.putItem(organized.item);
    this.created.items.push(link.id);
    step.itemIds = [link.id];
    step.effects.push({ kind: "create", key: effectKeys.create(step.id), itemId: link.id });
    if (organized.parts.length) step.text += ` ${organized.parts.join(", ")}`;
  }

  /** Saving a link that's already in the library organizes the saved one instead of adding a duplicate. */
  private updateSavedLink(step: PlannedStep, existing: Item, request: Extract<ChangeRequest, { kind: "save_link" }>) {
    const before = itemNote(existing);
    const current = before.trim();
    let withNote = existing;
    if (request.note && !this.unticked(effectKeys.note(existing.id, step.id))) {
      withNote = withNoteFormat({ ...existing, noteContent: current ? `${current}\n\n${request.note}` : request.note } as Item,
        current ? (request.format === "markdown" ? "markdown" : undefined) : resolvedFormat(request.format, request.note));
      step.effects.push({ kind: "note", key: effectKeys.note(existing.id, step.id), itemId: existing.id, before, after: itemNote(withNote) });
    }
    const organized = this.organize(step, withNote, request.collection, request.tags, true);
    const changes = [...organized.parts.map((part) => `move it ${part}`), ...(withNote !== existing ? ["add the note"] : [])];
    step.text = `${quote(itemListTitle(existing))} is already saved${changes.length ? `: ${changes.join(", ")}` : ""}`;
    const changed = organized.item !== existing;
    if (changed) this.putItem(this.bump(organized.item));
    this.settle(step, changed ? [existing] : [], { found: [existing], notes: [] });
  }

  private saveNote(step: PlannedStep, request: Extract<ChangeRequest, { kind: "save_note" }>) {
    const note = buildNote({ content: request.text, title: request.title, format: resolvedFormat(request.format, request.text) }, { id: request.itemId ?? this.newId(), now: this.now });
    step.text = `Save note ${quote(itemListTitle(note) || "Untitled")}`;
    if (this.unticked(effectKeys.create(step.id))) {
      step.status = "excluded";
      return;
    }
    const organized = this.organize(step, note, request.collection, request.tags, false);
    this.putItem(organized.item);
    this.created.items.push(note.id);
    step.itemIds = [note.id];
    step.effects.push({ kind: "create", key: effectKeys.create(step.id), itemId: note.id });
    if (organized.parts.length) step.text += ` ${organized.parts.join(", ")}`;
  }

  private saveFile(step: PlannedStep, request: Extract<ChangeRequest, { kind: "save_file" }>) {
    const groups = fileGroups(request.files, request.gallery);
    const label = groups.length === 1 ? quote(request.title || groups[0][0].name) : `${groups.length} files`;
    step.text = `Save ${label}`;
    for (const [index, files] of groups.entries()) {
      const id = request.itemIds[index] ?? this.newId();
      if (this.unticked(effectKeys.create(step.id, id))) continue;
      const organized = this.organize(step, this.fileItem(id, files, request), request.collection, request.tags, false);
      this.files.push({ stepId: step.id, item: organized.item, files, collection: request.collection, tags: request.tags, note: request.note, format: request.format, title: request.title });
      this.created.items.push(id);
      step.itemIds.push(id);
      step.effects.push({ kind: "create", key: effectKeys.create(step.id, id), itemId: id });
      if (index === 0 && organized.parts.length) step.text += ` ${organized.parts.join(", ")}`;
    }
    if (!step.effects.length) step.status = "excluded";
  }

  /** How files will look as an item, before they're saved. Saving builds the real item the way Add files does. */
  private fileItem(id: string, files: readonly AgentFile[], request: Extract<ChangeRequest, { kind: "save_file" }>): Item {
    const [file] = files;
    const base = { id, tagIds: [], collectionIds: [], createdAt: this.now, updatedAt: this.now };
    const note = request.note?.trim() ?? "";
    const format = note ? resolvedFormat(request.format, note) : undefined;
    const title = request.title?.trim() ?? "";
    if (file.kind === "image") {
      return withNoteFormat({ ...base, type: "image", title, sourceFileName: file.name, assetIds: files.map((entry) => PENDING_ASSET_PREFIX + entry.fileId), sourceUrl: "", caption: note } as Item, format);
    }
    if (file.kind === "video") {
      return withNoteFormat({ ...base, type: "video", title: title || file.name.replace(/\.[^.]+$/, ""), noteContent: note, sourceFileName: file.name, assetId: PENDING_ASSET_PREFIX + file.fileId } as Item, format);
    }
    return withNoteFormat({
      ...base, type: "document", format: file.format ?? "text", title: title || file.name.replace(/\.(txt|md|pdf)$/i, ""), sourceFileName: file.name,
      assetId: PENDING_ASSET_PREFIX + file.fileId, noteContent: note,
    } as Item, format);
  }

  private trash(step: PlannedStep, request: Extract<ChangeRequest, { kind: "trash" }>, seen: SeenItems | undefined) {
    const targets = this.targets(request.itemIds, seen);
    const trashed = targets.found.filter((item) => !this.unticked(effectKeys.trash(item.id)));
    for (const item of trashed) {
      this.putItem({ ...this.bump(item), deletedAt: this.now });
      step.effects.push({ kind: "trash", key: effectKeys.trash(item.id), itemId: item.id });
    }
    step.text = `Move ${itemList(trashed.length ? trashed : targets.found)} to Trash`;
    this.settle(step, trashed, targets);
  }
}

/** Plans requests in order against the library, as one batch. Nothing is written. */
export function planChanges(state: LibraryState, inputs: readonly PlanInput[], options: { now: number; newId(): string; excluded?: ReadonlySet<string> }): ChangePlan {
  return new ChangePlanner(state, options.now, options.newId, options.excluded ?? new Set()).plan(inputs);
}

// Undo.

/** Fields agents can change. Undo restores only these, so unrelated later updates (like a fetched preview) survive. */
const AGENT_ITEM_FIELDS = ["collectionIds", "collectionAddedAt", "tagIds", "content", "caption", "noteContent", "deletedAt", "format", "noteFormat"] as const;
// A format only changes with its note, so comparing the note is enough, and older suggestions' fingerprints still match.
const COMPARED_ITEM_FIELDS = AGENT_ITEM_FIELDS.filter((field) => !["collectionAddedAt", "format", "noteFormat"].includes(field));

/** The state of everything an agent can change on an item, for telling whether the user changed it since. */
export function itemFingerprint(item: Item): string {
  return JSON.stringify(COMPARED_ITEM_FIELDS.map((field) => (item as Record<string, unknown>)[field] ?? null));
}

function fieldsMatch(left: Item, right: Item) {
  return COMPARED_ITEM_FIELDS.every((field) => JSON.stringify((left as Record<string, unknown>)[field]) === JSON.stringify((right as Record<string, unknown>)[field]));
}

export type UndoPlan = { records: RecordChange[]; restored: number; kept: string[] };

type UndoState = { items: Map<string, Item>; collections: Map<string, Collection>; tags: Map<string, Tag>; records: RecordChange[]; kept: string[]; now: number };

function undoItem(change: Extract<RecordChange, { table: "items" }>, state: UndoState) {
  const current = state.items.get(change.id);
  if (!current) return;
  const updatedAt = Math.max(state.now, current.updatedAt + 1);
  if (!change.before) {
    if (current.deletedAt !== undefined) return;
    const next = { ...current, deletedAt: state.now, updatedAt };
    state.items.set(next.id, next);
    state.records.push({ table: "items", id: next.id, before: current, after: next });
    return;
  }
  if (!fieldsMatch(current, change.after)) {
    state.kept.push(`${quote(itemListTitle(current) || "Untitled")} was changed again after the agent's edit, so it was left as it is`);
    return;
  }
  const next = { ...current, updatedAt } as Record<string, unknown>;
  for (const field of AGENT_ITEM_FIELDS) {
    const value = (change.before as Record<string, unknown>)[field];
    if (value === undefined) delete next[field];
    else next[field] = value;
  }
  state.items.set(change.id, next as Item);
  state.records.push({ table: "items", id: change.id, before: current, after: next as Item });
}

function undoCollection(change: Extract<RecordChange, { table: "collections" }>, state: UndoState) {
  const current = state.collections.get(change.id);
  if (!current) return;
  if (!change.before) {
    if ([...state.items.values()].some((item) => item.collectionIds.includes(change.id))) {
      state.kept.push(`Kept the new collection ${quote(current.name)} because items are in it`);
    } else {
      state.records.push({ table: "collections", id: change.id, before: current, after: null });
    }
    return;
  }
  if (!change.after || current.name !== change.after.name) {
    state.kept.push(`Collection ${quote(current.name)} was renamed again, so it was left as it is`);
    return;
  }
  const previous = change.before.name;
  if ([...state.collections.values()].some((collection) => collection.id !== change.id && same(collection.name, previous))) {
    state.kept.push(`Couldn't rename ${quote(current.name)} back to ${quote(previous)} because that name is taken`);
    return;
  }
  state.records.push({ table: "collections", id: change.id, before: current, after: { ...current, name: previous } });
}

function undoTag(change: Extract<RecordChange, { table: "tags" }>, state: UndoState) {
  const current = state.tags.get(change.id);
  if (change.before || !current) return;
  if ([...state.items.values()].some((item) => item.tagIds.includes(change.id))) {
    state.kept.push(`Kept the new tag ${quote(current.name)} because items use it`);
    return;
  }
  state.records.push({ table: "tags", id: change.id, before: current, after: null });
}

/**
 * Reverses one applied change, record by record. Anything edited since the agent's change is left alone and
 * listed in `kept`. Items the agent created go to Trash rather than being deleted.
 */
export function planUndo(changes: readonly RecordChange[], library: LibraryState, now: number): UndoPlan {
  const state: UndoState = {
    items: new Map(library.items.map((item) => [item.id, item])),
    collections: new Map(library.collections.map((collection) => [collection.id, collection])),
    tags: new Map(library.tags.map((tag) => [tag.id, tag])),
    records: [], kept: [], now,
  };
  // Items first, so new collections and tags are only removed once nothing uses them.
  for (const change of changes) if (change.table === "items") undoItem(change, state);
  for (const change of changes) {
    if (change.table === "collections") undoCollection(change, state);
    if (change.table === "tags") undoTag(change, state);
  }
  return { records: state.records, restored: state.records.length, kept: state.kept };
}
