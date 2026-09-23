import { normalizeItem, type Item } from "@/domain/item";
import { buildLink, normalizeLinkUrl, type LinkItem } from "@/domain/link";
import { buildCollection } from "@/domain/collection";
import { buildTag } from "@/domain/tag";
import { captureOrgDrafts, rankCaptureOrganizations } from "@/domain/capture-org";
import { getDb, type KeepallDB } from "./db";
import { listItems } from "./items";
import { getLibraryPreferences } from "./library-preferences";

export type ExtensionLinkCapture = {
  captureId: string;
  url: string;
  title: string;
  noteContent?: string;
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
  const titleChanged = !link.title && !!input.title.trim();
  const noteAdded = !!nextNote && !link.noteContent?.trim();
  return {
    collectionIds,
    tagIds,
    nextNote,
    noteAdded,
    changed: collectionChanged || tagsChanged || titleChanged || noteAdded,
    movedOnly: collectionChanged && !tagsChanged && !titleChanged && !noteAdded,
  };
}

async function reuseLink(
  db: KeepallDB,
  link: LinkItem,
  input: ExtensionLinkCapture,
  organization: Awaited<ReturnType<typeof selectedOrganization>>,
): Promise<ExtensionSaveResult> {
  const nextNote = input.noteContent?.trim() ?? "";
  if (nextNote && link.noteContent?.trim() && link.noteContent.trim() !== nextNote) {
    throw new Error("This link already has a personal note. Edit it in Keepall.");
  }
  const changes = changedLinkFields(link, input, organization);
  if (!changes.changed) {
    return { itemId: link.id, created: false, outcome: "unchanged" };
  }

  await db.items.put({
    ...link,
    title: link.title || input.title.trim(),
    ...(changes.noteAdded ? { noteContent: changes.nextNote } : {}),
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

    const link = buildLink({
      url: input.url,
      title: input.title,
      noteContent: input.noteContent,
    }, { id: input.captureId });
    await db.items.add({
      ...link,
      collectionIds: organization.collectionIds ?? link.collectionIds,
      tagIds: organization.tagIds ?? link.tagIds,
    });
    return { itemId: link.id, created: true, outcome: "created" };
  });
}
