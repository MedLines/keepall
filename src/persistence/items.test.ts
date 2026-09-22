import { beforeEach, describe, expect, test } from "vitest";
import { ImageValidationError } from "@/domain/image";
import { LinkValidationError } from "@/domain/link";
import { buildNote, noteImageAssetIds, NoteValidationError } from "@/domain/note";
import { deleteKeepallDatabase, getDb } from "./db";
import { getAsset } from "./assets";
import {
  appendImageAssetToItem,
  createImage,
  createLink,
  createOrReuseImage,
  createOrReuseLink,
  createNote,
  deleteItem,
  listItems,
  listNotes,
  removeImageAssetAtIndex,
  replaceImageAssetAtIndex,
  saveLinkPreviewResult,
  setLinkPreviewPending,
  updateImage,
  updateLink,
  updateNote,
  saveNoteWithImages,
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

  test("createNote rejects a local image reference without stored bytes", async () => {
    await expect(createNote({ content: "![Image](keepall-image:missing)" }))
      .rejects.toThrow(/image is missing/);
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

  test("createOrReuseImage returns the existing single-asset image for the same bytes", async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const first = await createImage({
      assets: [{ bytes, mimeType: "image/png" }],
    });
    const second = await createOrReuseImage({
      assets: [{ bytes: new Uint8Array([10, 20, 30]), mimeType: "image/png" }],
    });

    expect(second.created).toBe(false);
    expect(second.image.id).toBe(first.id);
    expect((await listItems()).filter((item) => item.type === "image")).toHaveLength(
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

  test("stores a Markdown note and preserves its format when edited", async () => {
    const source = "# Card study\n\n- [ ] Check dark mode";
    const created = await createNote({ content: source, format: "markdown" });
    expect((await listItems())[0]).toMatchObject({ content: source, format: "markdown" });

    const updated = await updateNote(created.id, { content: `${source}\n`, format: "markdown" });
    expect(updated.content).toBe(`${source}\n`);
    expect(updated.format).toBe("markdown");
    expect((await listItems())[0]).toEqual(updated);

    const plain = await updateNote(created.id, { content: source, format: "plain" });
    expect(plain).not.toHaveProperty("format");
    expect((await listItems())[0]).toEqual(plain);
  });

  test("updateNote does not write empty content", async () => {
    const created = await createNote({ content: "keep" });
    await expect(updateNote(created.id, { content: "   " })).rejects.toBeInstanceOf(
      NoteValidationError,
    );
    expect(await listNotes()).toEqual([created]);
  });

  test("saves an inline image between note paragraphs and removes it with the note", async () => {
    const note = await createNote({ content: "Before\n\nAfter" });
    const saved = await saveNoteWithImages(note.id, {
      content: "Before\n\n![Image](keepall-image:pending-one)\n\nAfter",
      format: "plain",
    }, [{ id: "pending-one", bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" }]);
    const [assetId] = noteImageAssetIds(saved.content);
    expect(saved.content).toBe(`Before\n\n![Image](keepall-image:${assetId})\n\nAfter`);
    expect(await getAsset(assetId)).toMatchObject({ mimeType: "image/png" });
    await deleteItem(note.id);
    expect(await getAsset(assetId)).toBeUndefined();
  });

  test("rejects missing inline images without changing the saved note", async () => {
    const note = await createNote({ content: "Before" });
    await expect(updateNote(note.id, { content: "![Image](keepall-image:missing)" }))
      .rejects.toThrow(/image/i);
    expect((await listNotes())[0]).toEqual(note);
  });

  test("does not delete an image still used by another item", async () => {
    const bytes = new Uint8Array([7, 8, 9]);
    const image = await createImage({ assets: [{ bytes, mimeType: "image/png" }] });
    const note = await createNote({ content: "Shared image" });
    const saved = await saveNoteWithImages(note.id, {
      content: "Shared image\n\n![Image](keepall-image:pending)",
    }, [{ id: "pending", bytes, mimeType: "image/png" }]);
    const assetId = image.assetIds[0]!;
    expect(noteImageAssetIds(saved.content)).toEqual([assetId]);
    await deleteItem(image.id);
    expect(await getAsset(assetId)).toBeDefined();
    await updateNote(note.id, { content: "No image now" });
    expect(await getAsset(assetId)).toBeUndefined();
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

  test("keeps a personal link note separate from fetched preview metadata", async () => {
    const link = await createLink({ url: "https://example.com", noteContent: "## Mine", noteFormat: "markdown" });
    const withPreview = await saveLinkPreviewResult(link.id, { status: "ready", title: "Site title", description: "Website copy", imageUrl: "" });
    expect(withPreview.noteContent).toBe("## Mine");
    const edited = await updateLink(link.id, { url: link.url, noteContent: "## Revised", noteFormat: "markdown" });
    expect(edited.previewDescription).toBe("Website copy");
    expect((await listItems())[0]).toMatchObject({ noteContent: "## Revised", noteFormat: "markdown", previewDescription: "Website copy" });
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

  test("stores the Markdown choice for an image caption", async () => {
    const image = await createImage({ assets: [{ bytes: new Uint8Array([1]), mimeType: "image/png" }], caption: "## Study", captionFormat: "markdown" });
    expect((await listItems())[0]).toMatchObject({ id: image.id, caption: "## Study", captionFormat: "markdown" });
    const plain = await updateImage(image.id, { captionFormat: "plain" });
    expect(plain.captionFormat).toBeUndefined();
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

  test("removeImageAssetAtIndex removes one slide and its unreferenced asset", async () => {
    const image = await createImage({
      assets: [
        { bytes: new Uint8Array([1]), mimeType: "image/png" },
        { bytes: new Uint8Array([2]), mimeType: "image/png" },
      ],
    });
    const removedAssetId = image.assetIds[0]!;

    const updated = await removeImageAssetAtIndex(image.id, 0);

    expect(updated.assetIds).toEqual([image.assetIds[1]]);
    expect(await getAsset(removedAssetId)).toBeUndefined();
  });

  test("removeImageAssetAtIndex keeps an asset referenced by another slide", async () => {
    const image = await createImage({
      assets: [{ bytes: new Uint8Array([1]), mimeType: "image/png" }],
    });
    const withDuplicate = await appendImageAssetToItem(image.id, {
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
    });
    expect(withDuplicate.assetIds[0]).toBe(withDuplicate.assetIds[1]);

    const updated = await removeImageAssetAtIndex(image.id, 0);

    expect(updated.assetIds).toHaveLength(1);
    expect(await getAsset(updated.assetIds[0]!)).toBeDefined();
  });
});
