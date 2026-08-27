import { beforeEach, describe, expect, test } from "vitest";
import { ImageValidationError } from "@/domain/image";
import { LinkValidationError } from "@/domain/link";
import { buildNote, NoteValidationError } from "@/domain/note";
import { deleteKeepallDatabase, getDb } from "./db";
import { getAsset } from "./assets";
import {
  appendImageAssetToItem,
  createImage,
  createLink,
  createOrReuseLink,
  createNote,
  deleteItem,
  listItems,
  listNotes,
  replaceImageAssetAtIndex,
  saveLinkPreviewResult,
  setLinkPreviewPending,
  updateImage,
  updateLink,
  updateNote,
} from "./items";

describe("items persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("createNote stores a note that listNotes returns", async () => {
    const created = await createNote({
      title: "Sketch",
      content: "A persisted note",
    });
    const listed = await listNotes();

    expect(listed).toEqual([created]);
    expect(created.type).toBe("note");
    expect(created.content).toBe("A persisted note");
  });

  test("listNotes returns newest first", async () => {
    await getDb().items.bulkAdd([
      buildNote({ content: "older" }, { id: "old", now: 1 }),
      buildNote({ content: "newer" }, { id: "new", now: 2 }),
    ]);

    expect((await listNotes()).map((note) => note.id)).toEqual(["new", "old"]);
  });

  test("createNote does not write when content is empty", async () => {
    await expect(createNote({ content: "   " })).rejects.toBeInstanceOf(
      NoteValidationError,
    );
    expect(await listNotes()).toEqual([]);
  });

  test("createLink stores a link that listItems returns with notes", async () => {
    const note = await createNote({ content: "a note" });
    const link = await createLink({ url: "https://example.com" });

    expect(await listItems()).toEqual([link, note]);
  });

  test("createOrReuseLink returns the existing row for the same normalized URL", async () => {
    const first = await createLink({ url: "https://www.example.com/path/" });
    const second = await createOrReuseLink({
      url: "https://example.com/path",
    });

    expect(second.created).toBe(false);
    expect(second.link.id).toBe(first.id);
    expect((await listItems()).filter((item) => item.type === "link")).toHaveLength(
      1,
    );
  });

  test("deleteItem removes one stored item and leaves the rest", async () => {
    const keep = await createNote({ content: "keep me" });
    const drop = await createNote({ content: "drop me" });

    await deleteItem(drop.id);

    expect(await listItems()).toEqual([keep]);
  });

  test("updateNote changes content and keeps id and createdAt", async () => {
    const created = await createNote({ content: "old body" });
    const updated = await updateNote(created.id, { content: "new body" });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.content).toBe("new body");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    expect(await listItems()).toEqual([updated]);
  });

  test("updateNote does not write empty content", async () => {
    const created = await createNote({ content: "keep" });
    await expect(updateNote(created.id, { content: "   " })).rejects.toBeInstanceOf(
      NoteValidationError,
    );
    expect(await listNotes()).toEqual([created]);
  });

  test("updateLink changes url and keeps id and createdAt", async () => {
    const created = await createLink({ url: "https://example.com/old" });
    const updated = await updateLink(created.id, {
      url: "https://example.com/new",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.url).toBe("https://example.com/new");
    expect(await listItems()).toEqual([updated]);
  });

  test("updateLink does not write javascript URLs", async () => {
    const created = await createLink({ url: "https://example.com" });
    await expect(
      updateLink(created.id, { url: "javascript:alert(1)" }),
    ).rejects.toBeInstanceOf(LinkValidationError);
    expect(await listItems()).toEqual([created]);
  });

  test("createLink does not write javascript URLs", async () => {
    await expect(
      createLink({ url: "javascript:alert(1)" }),
    ).rejects.toBeInstanceOf(LinkValidationError);
    expect(await listItems()).toEqual([]);
  });

  test("setLinkPreviewPending and saveLinkPreviewResult update the link row", async () => {
    const created = await createLink({ url: "https://example.com" });
    const pending = await setLinkPreviewPending(created.id);
    expect(pending.previewStatus).toBe("pending");

    const ready = await saveLinkPreviewResult(created.id, {
      status: "ready",
      title: "Example",
      description: "Desc",
      imageUrl: "https://cdn.example.com/i.png",
    });
    expect(ready.previewStatus).toBe("ready");
    expect(ready.previewTitle).toBe("Example");
    expect(ready.previewImageUrl).toBe("https://cdn.example.com/i.png");

    const listed = await listItems();
    expect(listed[0]).toMatchObject({
      id: created.id,
      previewStatus: "ready",
      previewTitle: "Example",
    });
  });

  test("createImage stores bytes and lists the image item", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const image = await createImage({
      assets: [{ bytes, mimeType: "image/png" }],
      caption: "UI still",
    });
    expect(image.type).toBe("image");
    expect(image.caption).toBe("UI still");
    const asset = await getAsset(image.assetIds[0]!);
    expect(Array.from(asset?.bytes ?? [])).toEqual([1, 2, 3, 4]);
    expect(await listItems()).toEqual([image]);
  });

  test("createImage stores multiple assets on one item", async () => {
    const image = await createImage({
      assets: [
        { bytes: new Uint8Array([1]), mimeType: "image/png" },
        { bytes: new Uint8Array([2, 3]), mimeType: "image/jpeg" },
      ],
    });
    expect(image.assetIds).toHaveLength(2);
    expect(Array.from((await getAsset(image.assetIds[0]!))?.bytes ?? [])).toEqual(
      [1],
    );
    expect(Array.from((await getAsset(image.assetIds[1]!))?.bytes ?? [])).toEqual(
      [2, 3],
    );
  });

  test("createImage rejects oversize files", async () => {
    await expect(
      createImage({
        assets: [
          {
            bytes: new Uint8Array(3 * 1024 * 1024 + 1),
            mimeType: "image/png",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ImageValidationError);
  });

  test("deleteItem removes an image asset", async () => {
    const image = await createImage({
      assets: [{ bytes: new Uint8Array([9]), mimeType: "image/jpeg" }],
    });
    await deleteItem(image.id);
    expect(await getAsset(image.assetIds[0]!)).toBeUndefined();
    expect(await listItems()).toEqual([]);
  });

  test("updateImage changes caption and sourceUrl", async () => {
    const image = await createImage({
      assets: [{ bytes: new Uint8Array([1]), mimeType: "image/png" }],
      caption: "old",
    });
    const updated = await updateImage(image.id, {
      caption: "new",
      sourceUrl: "https://example.com",
    });
    expect(updated.caption).toBe("new");
    expect(updated.sourceUrl).toBe("https://example.com");
    expect(updated.assetIds).toEqual(image.assetIds);
  });

  test("appendImageAssetToItem adds a second asset at the end", async () => {
    const image = await createImage({
      assets: [{ bytes: new Uint8Array([1]), mimeType: "image/png" }],
    });
    const updated = await appendImageAssetToItem(image.id, {
      bytes: new Uint8Array([2, 3]),
      mimeType: "image/jpeg",
    });
    expect(updated.assetIds).toHaveLength(2);
    expect(updated.assetIds[0]).toBe(image.assetIds[0]);
    expect(await getAsset(updated.assetIds[1]!)).toMatchObject({
      mimeType: "image/jpeg",
    });
  });

  test("replaceImageAssetAtIndex swaps one slide and deletes the old asset", async () => {
    const image = await createImage({
      assets: [{ bytes: new Uint8Array([1]), mimeType: "image/png" }],
    });
    await appendImageAssetToItem(image.id, {
      bytes: new Uint8Array([2]),
      mimeType: "image/png",
    });
    const listed = await listItems();
    const withTwo = listed[0];
    if (!withTwo || withTwo.type !== "image") {
      throw new Error("expected image item");
    }
    const oldSecond = withTwo.assetIds[1]!;
    const updated = await replaceImageAssetAtIndex(withTwo.id, 1, {
      bytes: new Uint8Array([9]),
      mimeType: "image/png",
    });
    expect(updated.assetIds[0]).toBe(withTwo.assetIds[0]);
    expect(updated.assetIds[1]).not.toBe(oldSecond);
    expect(await getAsset(oldSecond)).toBeUndefined();
    expect(Array.from((await getAsset(updated.assetIds[1]!))?.bytes ?? [])).toEqual(
      [9],
    );
  });
});
