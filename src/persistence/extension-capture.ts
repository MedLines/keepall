import { normalizeItem, type Item } from "@/domain/item";
import { buildLink, normalizeLinkUrl, type LinkItem } from "@/domain/link";
import { buildCollection } from "@/domain/collection";
import { buildTag } from "@/domain/tag";
import { noteImageAssetIds } from "@/domain/note";
import { captureOrgDrafts, rankCaptureOrganizations } from "@/domain/capture-org";
import { getDb, type KeepallDB } from "./db";
import { listItems } from "./items";
import { getLibraryPreferences } from "./library-preferences";

export type ExtensionLinkSnapshot = {
  id: string;
  title: string;
  noteContent: string;
  noteFormat: "plain" | "markdown";
  collectionIds: string[];
  tagIds: string[];
};

export type ExtensionLinkCapture = {
  captureId: string;
  url: string;
  title: string;
  noteContent?: string;
  noteFormat?: "plain" | "markdown";
  existingLink?: ExtensionLinkSnapshot;
  collectionId?: string | null;
  tagIds?: string[];
  collectionName?: string;
  tagNames?: string[];
};

export type ExtensionOrganizationOptions = {
  collections: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  collectionId: string | null;
  tagIds: string[];
  existingLink?: ExtensionLinkSnapshot;
  existingNoteHasImages?: boolean;
};

function matchingLink(items: Item[], normalizedUrl: string): LinkItem | null {
  for (const raw of items) {
    const item = normalizeItem(raw);
    if (item.type === "link" && normalizeLinkUrl(item.url) === normalizedUrl) {
      return item;
    }
  }
  return null;
}

async function selectedOrganization(db: KeepallDB, input: ExtensionLinkCapture) {
  const drafts = captureOrgDrafts(input.tagNames ?? [], input.collectionName);
  let collectionId = input.collectionId;
  if (drafts.collectionName) {
    const proposed = buildCollection({ name: drafts.collectionName });
    const existing = await db.collections.where("name").equals(proposed.name).first();
    if (!existing) await db.collections.add(proposed);
    collectionId = existing?.id ?? proposed.id;
  } else if (collectionId && !(await db.collections.get(collectionId))) {
    throw new Error("That collection is no longer available. Reopen capture and try again.");
  }
  const tagIds = [...(input.tagIds ?? [])];
  for (const id of tagIds) {
    if (!(await db.tags.get(id))) {
      throw new Error("A selected tag is no longer available. Reopen capture and try again.");
    }
  }
  for (const name of drafts.tagNames) {
    const proposed = buildTag({ name });
    const existing = await db.tags.where("name").equals(proposed.name).first();
    if (!existing) await db.tags.add(proposed);
    const id = existing?.id ?? proposed.id;
    if (!tagIds.includes(id)) tagIds.push(id);
  }
  return {
    collectionIds: collectionId === undefined ? undefined : collectionId ? [collectionId] : [],
    tagIds: input.tagIds === undefined && input.tagNames === undefined ? undefined : tagIds,
  };
}

type ExtensionSaveResult = {
  itemId: string;
  created: boolean;
  outcome: "created" | "updated" | "unchanged";
  movedTo?: string;
};

function hasNoteFormatChange(link: LinkItem, input: ExtensionLinkCapture, nextNote: string): boolean {
  if (!nextNote || !link.noteContent?.trim() || input.noteFormat === undefined) return false;
  return input.noteFormat !== (link.noteFormat === "markdown" ? "markdown" : "plain");
}

function hasNoteContentChange(link: LinkItem, input: ExtensionLinkCapture, nextNote: string): boolean {
  return input.existingLink
    ? nextNote !== (link.noteContent?.trim() ?? "")
    : !!nextNote && !link.noteContent?.trim();
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function assertCurrentLink(link: LinkItem, input: ExtensionLinkCapture, nextNote: string): void {
  const snapshot = input.existingLink;
  if (snapshot) {
    if (snapshot.id !== link.id || snapshot.title !== link.title ||
        snapshot.noteContent !== (link.noteContent ?? "") ||
        snapshot.noteFormat !== (link.noteFormat === "markdown" ? "markdown" : "plain") ||
        !sameIds(snapshot.collectionIds, link.collectionIds) ||
        !sameIds(snapshot.tagIds, link.tagIds)) {
      throw new Error("This link changed in Keepall. Reopen capture and try again.");
    }
  } else if (nextNote && link.noteContent?.trim() && link.noteContent.trim() !== nextNote) {
    throw new Error("This link already has a personal note. Edit it in Keepall.");
  }
}

function assertNoteImagesPreserved(previousNote: string, nextNote: string): void {
  const originalImages = noteImageAssetIds(previousNote);
  const nextImages = noteImageAssetIds(nextNote);
  if (originalImages.length !== nextImages.length || originalImages.some((id) => !nextImages.includes(id))) {
    throw new Error("This note has local images. Edit its contents in Keepall.");
  }
}

function validSnapshotIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 100 &&
    value.every((id) => typeof id === "string" && !!id && id.length <= 100);
}

function validateExistingLinkEdit(input: ExtensionLinkCapture): void {
  const snapshot = input.existingLink;
  if (snapshot === undefined) return;
  if (!snapshot || typeof snapshot !== "object" ||
      typeof snapshot.id !== "string" || !snapshot.id || snapshot.id.length > 100 ||
      typeof snapshot.title !== "string" || snapshot.title.length > 500 ||
      typeof snapshot.noteContent !== "string" || snapshot.noteContent.length > 10000 ||
      (snapshot.noteFormat !== "plain" && snapshot.noteFormat !== "markdown") ||
      !validSnapshotIds(snapshot.collectionIds) || !validSnapshotIds(snapshot.tagIds) ||
      input.noteContent === undefined || input.noteFormat === undefined) {
    throw new Error("Invalid existing link edit");
  }
}

function changedLinkFields(
  link: LinkItem,
  input: ExtensionLinkCapture,
  organization: Awaited<ReturnType<typeof selectedOrganization>>,
) {
  const collectionIds = organization.collectionIds ?? link.collectionIds;
  const tagIds = organization.tagIds ?? link.tagIds;
  const nextNote = input.noteContent?.trim() ?? "";
  const collectionChanged = collectionIds[0] !== link.collectionIds[0];
  const tagsChanged = tagIds.length !== link.tagIds.length || tagIds.some((id, index) => id !== link.tagIds[index]);
  const titleChanged = input.existingLink
    ? input.title.trim() !== link.title
    : !link.title && !!input.title.trim();
  const noteChanged = hasNoteContentChange(link, input, nextNote);
  const noteFormatChanged = hasNoteFormatChange(link, input, nextNote);
  return {
    collectionIds,
    tagIds,
    nextNote,
    noteChanged,
    noteFormatChanged,
    changed: collectionChanged || tagsChanged || titleChanged || noteChanged || noteFormatChanged,
    movedOnly: collectionChanged && !tagsChanged && !titleChanged && !noteChanged && !noteFormatChanged,
  };
}

async function reuseLink(
  db: KeepallDB,
  link: LinkItem,
  input: ExtensionLinkCapture,
  organization: Awaited<ReturnType<typeof selectedOrganization>>,
): Promise<ExtensionSaveResult> {
  const nextNote = input.noteContent?.trim() ?? "";
  assertCurrentLink(link, input, nextNote);
  if (input.noteContent !== undefined) assertNoteImagesPreserved(link.noteContent ?? "", nextNote);
  const changes = changedLinkFields(link, input, organization);
  if (!changes.changed) {
    return { itemId: link.id, created: false, outcome: "unchanged" };
  }

  await db.items.put({
    ...link,
    title: input.existingLink ? input.title.trim() : link.title || input.title.trim(),
    ...(changes.noteChanged ? { noteContent: changes.nextNote || undefined } : {}),
    ...(changes.noteChanged || changes.noteFormatChanged ? { noteFormat: changes.nextNote && input.noteFormat === "markdown" ? "markdown" as const : undefined } : {}),
    collectionIds: changes.collectionIds,
    tagIds: changes.tagIds,
    updatedAt: Date.now(),
  });
  const movedTo = changes.movedOnly
    ? changes.collectionIds[0] ? (await db.collections.get(changes.collectionIds[0]))?.name : "Unsorted"
    : undefined;
  return { itemId: link.id, created: false, outcome: "updated", ...(movedTo ? { movedTo } : {}) };
}

export async function getExtensionOrganizationOptions(url: string): Promise<ExtensionOrganizationOptions> {
  const db = getDb();
  const [collections, tags, items, preferences] = await Promise.all([
    db.collections.orderBy("name").toArray(),
    db.tags.orderBy("name").toArray(),
    listItems(),
    getLibraryPreferences(),
  ]);
  const normalizedUrl = normalizeLinkUrl(url);
  const existing = normalizedUrl ? matchingLink(items, normalizedUrl) : null;
  return {
    collections: rankCaptureOrganizations(collections, items, "collection", preferences.pinnedCollectionIds).map(({ id, name }) => ({ id, name })),
    tags: rankCaptureOrganizations(tags, items, "tag").map(({ id, name }) => ({ id, name })),
    collectionId: existing?.collectionIds[0] ?? null,
    tagIds: existing?.tagIds ?? [],
    ...(existing ? {
      existingLink: {
        id: existing.id,
        title: existing.title,
        noteContent: existing.noteContent ?? "",
        noteFormat: existing.noteFormat === "markdown" ? "markdown" as const : "plain" as const,
        collectionIds: existing.collectionIds,
        tagIds: existing.tagIds,
      },
      existingNoteHasImages: noteImageAssetIds(existing.noteContent ?? "").length > 0,
    } : {}),
  };
}

export async function saveExtensionLink(
  input: ExtensionLinkCapture,
): Promise<ExtensionSaveResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.captureId)) {
    throw new Error("Invalid capture ID");
  }
  if (input.url.length > 8192 || input.title.length > 500 || (input.noteContent?.length ?? 0) > 10000) {
    throw new Error("Capture is too large");
  }
  if (input.noteFormat !== undefined && input.noteFormat !== "plain" && input.noteFormat !== "markdown") {
    throw new Error("Invalid note format");
  }
  validateExistingLinkEdit(input);
  if ((input.collectionId !== undefined && input.collectionId !== null &&
        (typeof input.collectionId !== "string" || !input.collectionId || input.collectionId.length > 100)) ||
      (input.tagIds !== undefined && (!Array.isArray(input.tagIds) || input.tagIds.length > 100 ||
        input.tagIds.some((id) => typeof id !== "string" || !id || id.length > 100) || new Set(input.tagIds).size !== input.tagIds.length))) {
    throw new Error("Invalid collection or tags");
  }
  if ((input.collectionName !== undefined && (typeof input.collectionName !== "string" || input.collectionName.length > 120)) ||
      (input.tagNames !== undefined && (!Array.isArray(input.tagNames) || input.tagNames.length > 100 ||
        input.tagNames.some((name) => typeof name !== "string" || name.length > 120)))) {
    throw new Error("Invalid collection or tags");
  }

  const normalizedUrl = normalizeLinkUrl(input.url);
  if (!normalizedUrl) {
    throw new Error("Enter an http or https URL");
  }

  const db = getDb();
  return db.transaction("rw", db.items, db.collections, db.tags, async () => {
    const prior = await db.items.get(input.captureId);
    if (prior) {
      const item = normalizeItem(prior);
      if (item.type !== "link" || normalizeLinkUrl(item.url) !== normalizedUrl) {
        throw new Error("Capture ID already belongs to another item");
      }
      return { itemId: item.id, created: false, outcome: "unchanged" };
    }

    const organization = await selectedOrganization(db, input);

    const links = await db.items.where("type").equals("link").toArray();
    const existing = matchingLink(links, normalizedUrl);
    if (existing) return reuseLink(db, existing, input, organization);
    if (input.existingLink) throw new Error("This link changed in Keepall. Reopen capture and try again.");

    const link = buildLink({
      url: input.url,
      title: input.title,
      noteContent: input.noteContent,
      noteFormat: input.noteFormat,
    }, { id: input.captureId });
    await db.items.add({
      ...link,
      collectionIds: organization.collectionIds ?? link.collectionIds,
      tagIds: organization.tagIds ?? link.tagIds,
    });
    return { itemId: link.id, created: true, outcome: "created" };
  });
}
