import { expect, test } from "vitest";
import type { Item } from "./item";
import { buildNote } from "./note";
import { buildOrganizationPreviews } from "./organization-preview";

test("tag cards include empty tags and count shared items without counting Trash", () => {
  const tags = [{ id: "a", name: "Design" }, { id: "b", name: "Reading" }, { id: "empty", name: "Empty" }];
  const items = [1, 2, 3, 4].map(now => ({
    ...buildNote({ content: "Idea" }, { id: `n${now}`, now }), tagIds: ["a", "b"],
  }));
  const cards = buildOrganizationPreviews(tags, [...items, { ...items[0], id: "trashed", createdAt: 5, deletedAt: 10 }], "", "tags");
  expect(cards.map(card => card.count)).toEqual([4, 4, 0]);
  expect(cards[0].previews.map(item => item.id)).toEqual(["n4", "n3", "n2"]);
  expect(buildOrganizationPreviews(tags, items, " READ ", "tags").map(card => card.organization.id)).toEqual(["b"]);
});

test("includes empty folders and shows only the latest three active items", () => {
  const collections = [
    { id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: ["n1"] },
    { id: "empty", name: "Empty", createdAt: 2, pinnedItemIds: [] },
  ];
  const items: Item[] = [1, 4, 2, 3].map(now => ({
    ...buildNote({ content: `Note ${now}` }, { id: `n${now}`, now }),
    collectionIds: ["reading"],
  }));
  items.push({ ...items[0], id: "trash", createdAt: 10, deletedAt: 11 });
  items.push(buildNote({ content: "Unsorted" }, { id: "unsorted", now: 20 }));

  const folders = buildOrganizationPreviews(collections, items, "", "collections");
  expect(folders[0].count).toBe(4);
  expect(folders[0].previews.map(item => item.id)).toEqual(["n4", "n3", "n2"]);
  expect(folders[1]).toMatchObject({ count: 0, previews: [] });
});

test("searches collection names while keeping full counts and previews", () => {
  const collections = [
    { id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: [] },
    { id: "empty", name: "Empty", createdAt: 2, pinnedItemIds: [] },
  ];
  const items = [1, 2].map(now => ({
    ...buildNote({ content: "Note" }, { id: `n${now}`, now }),
    collectionIds: ["reading"],
  }));
  expect(buildOrganizationPreviews(collections, items, "  READ  ", "collections"))
    .toMatchObject([{ organization: { id: "reading" }, count: 2 }]);
  expect(buildOrganizationPreviews(collections, items, "missing", "collections")).toEqual([]);
});


test("folder previews follow addition time, keep only three, and ignore later edits", () => {
  const items = [1, 2, 3, 4].map(now => ({
    ...buildNote({ content: `Note ${now}` }, { id: `n${now}`, now }),
    collectionIds: ["folder"], collectionAddedAt: now,
  }));
  items[0].collectionAddedAt = 10;
  items[1].updatedAt = 20;
  const folders = buildOrganizationPreviews([{ id: "folder", name: "Folder" }], items, "", "collections");
  expect(folders[0].previews.map(item => item.id)).toEqual(["n1", "n4", "n3"]);
  expect(buildOrganizationPreviews([{ id: "folder", name: "Folder" }], [items[0]], "", "collections")[0].previews).toEqual([items[0]]);
});
