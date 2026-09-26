import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { deleteKeepallDatabase, getDb } from "./db";
import { saveExtensionImage, saveExtensionLink } from "./extension-capture";
import { undoExtensionCapture } from "./extension-capture-undo";
import { getItem, saveLinkPreviewResult, updateLink } from "./items";

beforeEach(deleteKeepallDatabase);
afterEach(() => vi.restoreAllMocks());

const capture = () => ({ captureId: crypto.randomUUID(), url: "https://example.com/article", title: "Article" });

test("only newly created captures offer undo, which can safely be retried", async () => {
  const first = await saveExtensionLink(capture());
  expect(first.undoToken).toEqual(expect.any(String));
  expect((await saveExtensionLink(capture())).undoToken).toBeUndefined();
  expect((await saveExtensionLink({ ...capture(), noteContent: "Read this" })).undoToken).toBeUndefined();
  // Updating the existing item must prevent its original creation from being undone.
  await expect(undoExtensionCapture(first.undoToken!)).rejects.toThrow("changed");
  expect(await getItem(first.itemId)).not.toBeNull();

  const other = await saveExtensionLink({ ...capture(), url: "https://example.com/other" });
  await expect(undoExtensionCapture(other.undoToken!)).resolves.toBe(other.itemId);
  await expect(undoExtensionCapture(other.undoToken!)).resolves.toBe(other.itemId);
  expect(await getItem(other.itemId)).toBeNull();
  expect(await getItem(first.itemId)).not.toBeNull();
});

test("undo tolerates automatic link previews but preserves later user edits", async () => {
  const first = await saveExtensionLink(capture());
  await saveLinkPreviewResult(first.itemId, { status: "ready", title: "Preview title", description: "Description", imageUrl: "" });
  await expect(undoExtensionCapture(first.undoToken!)).resolves.toBe(first.itemId);
  const second = await saveExtensionLink(capture());
  await updateLink(second.itemId, { url: "https://example.com/article", title: "My revised title" });
  await expect(undoExtensionCapture(second.undoToken!)).rejects.toThrow("changed");
  expect((await getItem(second.itemId))?.title).toBe("My revised title");
});

test("undo preserves a newly pinned item", async () => {
  const saved = await saveExtensionLink(capture());
  await getDb().collections.put({ id: "reading", name: "Reading", createdAt: Date.now(), pinnedItemIds: [saved.itemId] });
  await expect(undoExtensionCapture(saved.undoToken!)).rejects.toThrow("changed");
  expect(await getItem(saved.itemId)).not.toBeNull();
});

test("undo removes image assets and thumbnails along with the new image", async () => {
  const saved = await saveExtensionImage({
    captureId: crypto.randomUUID(), sourcePageUrl: "https://example.com/gallery",
    mimeType: "image/png", bytes: new Uint8Array([137, 80, 78, 71, 1]),
  });
  const image = await getItem(saved.itemId);
  if (image?.type !== "image") throw new Error("Expected image");
  expect(await getDb().assets.get(image.assetIds[0])).toBeDefined();
  await undoExtensionCapture(saved.undoToken!);
  expect(await getItem(saved.itemId)).toBeNull();
  expect(await getDb().assets.count()).toBe(0);
  expect(await getDb().thumbnails.count()).toBe(0);
});

test("unknown and expired undo tokens never remove items", async () => {
  const saved = await saveExtensionLink(capture());
  await expect(undoExtensionCapture(crypto.randomUUID())).rejects.toThrow("expired");
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
  await expect(undoExtensionCapture(saved.undoToken!)).rejects.toThrow("expired");
  expect(await getItem(saved.itemId)).not.toBeNull();
});
