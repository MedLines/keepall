import { beforeEach, expect, test } from "vitest";
import { deleteKeepallDatabase, getDb } from "./db";
import { saveExtensionImage, saveExtensionLink } from "./extension-capture";
import { getCaptureCollections, moveCaptureToCollection, updateCaptureTag } from "./extension-collections";
import { undoExtensionCapture } from "./extension-capture-undo";

beforeEach(async () => {
  await deleteKeepallDatabase();
  await getDb().collections.put({ id: "reading", name: "Reading", createdAt: 1, pinnedItemIds: [] });
});

test("organizes links and images without changing their content, and can return them to Unsorted", async () => {
  const captures = [
    await saveExtensionLink({ captureId: crypto.randomUUID(), url: "https://example.com", title: "Example", noteContent: "My note", noteFormat: "markdown" }),
    await saveExtensionImage({ captureId: crypto.randomUUID(), sourcePageUrl: "https://example.com", mimeType: "image/png", bytes: new Uint8Array([137, 80, 78, 71, 1]) }),
  ];
  for (const capture of captures) {
    const before = await getDb().items.get(capture.itemId);
    expect(await getCaptureCollections(capture.itemId)).toEqual({ collections: [{ id: "reading", name: "Reading" }], collectionIds: [], tags: [], tagIds: [] });
    await expect(moveCaptureToCollection(capture.itemId, "reading", [])).resolves.toEqual({ collectionName: "Reading", changed: true });
    expect(await getDb().items.get(capture.itemId)).toEqual({ ...before, collectionIds: ["reading"], updatedAt: expect.any(Number) });
    await expect(undoExtensionCapture(capture.undoToken!)).rejects.toThrow("changed");
    await expect(moveCaptureToCollection(capture.itemId, "reading", ["reading"])).resolves.toMatchObject({ changed: false });
    await expect(moveCaptureToCollection(capture.itemId, null, ["reading"])).resolves.toEqual({ collectionName: "Unsorted", changed: true });
    expect((await getDb().items.get(capture.itemId))?.collectionIds).toEqual([]);
  }
  expect(await getDb().assets.count()).toBe(1);
});

test("creates a normalized collection and reuses names regardless of case", async () => {
  const saved = await saveExtensionLink({ captureId: crypto.randomUUID(), url: "https://example.com", title: "Example" });
  await expect(moveCaptureToCollection(saved.itemId, null, [], "  Side   projects  ")).resolves.toMatchObject({ collectionName: "Side projects", changed: true });
  const created = await getDb().collections.where("name").equals("Side projects").first();
  expect((await getDb().items.get(saved.itemId))?.collectionIds).toEqual([created!.id]);
  await expect(moveCaptureToCollection(saved.itemId, null, [created!.id], "SIDE PROJECTS")).resolves.toMatchObject({ collectionName: "Side projects", changed: false });
  expect(await getDb().collections.count()).toBe(2);
});

test("does not create a collection if the item's selection is stale", async () => {
  const saved = await saveExtensionLink({ captureId: crypto.randomUUID(), url: "https://example.com", title: "Example" });
  await moveCaptureToCollection(saved.itemId, "reading", []);
  await expect(moveCaptureToCollection(saved.itemId, null, [], "New destination")).rejects.toThrow("changed in Keepall");
  expect(await getDb().collections.count()).toBe(1);
});

test("creates, adds, and removes tags while preserving item content and other tags", async () => {
  const saved = await saveExtensionLink({ captureId: crypto.randomUUID(), url: "https://example.com", title: "Example", noteContent: "Personal note" });
  await getDb().tags.put({ id: "existing", name: "Reference", createdAt: 1 });
  await getDb().items.update(saved.itemId, { tagIds: ["existing"] });
  const before = await getDb().items.get(saved.itemId);
  const result = await updateCaptureTag(saved.itemId, { tagName: "  New   topic ", assigned: true, expectedTagIds: ["existing"] });
  expect(result).toMatchObject({ tag: { name: "New topic" }, assigned: true, changed: true });
  expect(await getDb().items.get(saved.itemId)).toEqual({ ...before, tagIds: ["existing", result.tag.id], updatedAt: expect.any(Number) });
  await expect(updateCaptureTag(saved.itemId, { tagName: "NEW TOPIC", assigned: true, expectedTagIds: result.tagIds })).resolves.toMatchObject({ changed: false, tag: result.tag });
  expect(await getDb().tags.count()).toBe(2);
  const removed = await updateCaptureTag(saved.itemId, { tagId: result.tag.id, assigned: false, expectedTagIds: result.tagIds });
  expect(removed.tagIds).toEqual(["existing"]);
  expect(await getDb().tags.get(result.tag.id)).toBeDefined();
});

test("tag changes invalidate Undo and work for captured images", async () => {
  const saved = await saveExtensionImage({ captureId: crypto.randomUUID(), sourcePageUrl: "https://example.com", mimeType: "image/png", bytes: new Uint8Array([137, 80, 78, 71, 1]) });
  const before = await getDb().items.get(saved.itemId);
  const result = await updateCaptureTag(saved.itemId, { tagName: "Inspiration", assigned: true, expectedTagIds: [] });
  expect(await getDb().items.get(saved.itemId)).toEqual({ ...before, tagIds: [result.tag.id], updatedAt: expect.any(Number) });
  await expect(undoExtensionCapture(saved.undoToken!)).rejects.toThrow("changed");
  expect(await getDb().assets.count()).toBe(1);
});

test("rejects stale tags, unavailable tags, and trashed captures without creating organizations", async () => {
  const saved = await saveExtensionLink({ captureId: crypto.randomUUID(), url: "https://example.com", title: "Example" });
  await getDb().items.update(saved.itemId, { tagIds: ["other"] });
  await expect(updateCaptureTag(saved.itemId, { tagName: "New topic", assigned: true, expectedTagIds: [] })).rejects.toThrow("changed in Keepall");
  expect(await getDb().tags.count()).toBe(0);
  await expect(updateCaptureTag(saved.itemId, { tagId: "missing", assigned: true, expectedTagIds: ["other"] })).rejects.toThrow("no longer available");
  await getDb().items.update(saved.itemId, { deletedAt: 2 });
  await expect(getCaptureCollections(saved.itemId)).rejects.toThrow("no longer available");
  await expect(moveCaptureToCollection(saved.itemId, null, [], "New destination")).rejects.toThrow("no longer available");
  await expect(updateCaptureTag(saved.itemId, { tagName: "New topic", assigned: true, expectedTagIds: ["other"] })).rejects.toThrow("no longer available");
  expect(await getDb().tags.count()).toBe(0);
  expect(await getDb().collections.count()).toBe(1);
});

test("rejects stale selections and deleted items or collections", async () => {
  const saved = await saveExtensionLink({ captureId: crypto.randomUUID(), url: "https://example.com", title: "Example" });
  await expect(moveCaptureToCollection(saved.itemId, "missing", [])).rejects.toThrow("no longer available");
  await moveCaptureToCollection(saved.itemId, "reading", []);
  await expect(moveCaptureToCollection(saved.itemId, null, [])).rejects.toThrow("changed in Keepall");
  expect((await getDb().items.get(saved.itemId))?.collectionIds).toEqual(["reading"]);
  await getDb().items.delete(saved.itemId);
  await expect(getCaptureCollections(saved.itemId)).rejects.toThrow("no longer available");
  await expect(moveCaptureToCollection(saved.itemId, null, ["reading"])).rejects.toThrow("no longer available");
});
