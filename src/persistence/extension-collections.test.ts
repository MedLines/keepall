import { beforeEach, expect, test } from "vitest";
import { deleteKeepallDatabase, getDb } from "./db";
import { saveExtensionImage, saveExtensionLink } from "./extension-capture";
import { getCaptureCollections, moveCaptureToCollection } from "./extension-collections";
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
    expect(await getCaptureCollections(capture.itemId)).toEqual({ collections: [{ id: "reading", name: "Reading" }], collectionIds: [] });
    await expect(moveCaptureToCollection(capture.itemId, "reading", [])).resolves.toEqual({ collectionName: "Reading", changed: true });
    expect(await getDb().items.get(capture.itemId)).toEqual({ ...before, collectionIds: ["reading"], updatedAt: expect.any(Number) });
    await expect(undoExtensionCapture(capture.undoToken!)).rejects.toThrow("changed");
    await expect(moveCaptureToCollection(capture.itemId, "reading", ["reading"])).resolves.toMatchObject({ changed: false });
    await expect(moveCaptureToCollection(capture.itemId, null, ["reading"])).resolves.toEqual({ collectionName: "Unsorted", changed: true });
    expect((await getDb().items.get(capture.itemId))?.collectionIds).toEqual([]);
  }
  expect(await getDb().assets.count()).toBe(1);
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
