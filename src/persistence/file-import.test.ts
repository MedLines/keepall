import { expect, test, vi } from "vitest";
import { MAX_TEXT_DOCUMENT_BYTES } from "@/domain/document";
import { importFiles } from "./file-import";
import { Blob as NodeBlob } from "node:buffer";
import { getDb } from "./db";
import { getDocumentOriginal } from "./documents";
import { createImage } from "./items";
import { createVideo } from "./videos";

const prepareVideo = vi.fn(async () => new Blob(["poster"], { type: "image/webp" }));

function file(name: string, text: string): File {
  const bytes = new TextEncoder().encode(text);
  return Object.assign(new NodeBlob([bytes]), { name }) as unknown as File;
}

test("imports multiple originals including BOM, Unicode, and empty files into the selected collection", async () => {
  const summary = await importFiles([file("مرجع.MD", "\uFEFF# café\r\n"), file("empty.txt", "")], { collectionName: "Reading", prepareVideo });
  expect(summary.results.map((result) => result.status)).toEqual(["saved", "saved"]);
  const items = await getDb().items.toArray();
  const [collection] = await getDb().collections.toArray();
  expect(items).toHaveLength(2);
  expect(items.every((item) => item.collectionIds[0] === collection.id)).toBe(true);
  expect(Array.from((await getDocumentOriginal(items.find((item) => item.type === "document" && item.sourceFileName === "مرجع.MD")!.id))!.bytes)).toEqual(Array.from(new TextEncoder().encode("\uFEFF# café\r\n")));
});

test("a batch creates one separate note per text file, including files with identical content", async () => {
  const files = [file("first.txt", "First file"), file("second.md", "# Second file"), file("copy.txt", "First file")];
  const { results } = await importFiles(files, { collectionName: "Notes batch", prepareVideo });
  const saved = results.filter((result) => result.status === "saved");
  expect(saved).toHaveLength(3);
  expect(new Set(saved.map((result) => result.itemId)).size).toBe(3);
  for (const [index, result] of saved.entries()) {
    expect(await getDb().items.get(result.itemId)).toMatchObject({ type: "document", sourceFileName: files[index].name });
    expect(Array.from((await getDocumentOriginal(result.itemId))!.bytes)).toEqual(Array.from(new Uint8Array(await files[index].arrayBuffer())));
  }
});

test("returns the destination collection for opening the completed import", async () => {
  const summary = await importFiles([file("first.txt", "First file")], { collectionName: "Imported folder", prepareVideo });
  const [collection] = await getDb().collections.toArray();
  expect(summary).toMatchObject({ collectionId: collection.id });
});

test("rejects type and size before reading, and reports malformed UTF-8 without saving a broken item", async () => {
  const read = vi.fn();
  const results = await importFiles([
    { name: "large.md", size: MAX_TEXT_DOCUMENT_BYTES + 1, arrayBuffer: read, type: "" } as unknown as File,
    { name: "page.html", size: 1, arrayBuffer: read, type: "" } as unknown as File,
    { name: "binary.txt", size: 2, arrayBuffer: async () => new Uint8Array([0xc3, 0x28]).buffer, type: "" } as unknown as File,
    file("valid.txt", "Saved"),
  ], { prepareVideo });
  expect(read).not.toHaveBeenCalled();
  expect(results.results.map((result) => result.status)).toEqual(["failed", "failed", "failed", "saved"]);
  expect(results.results[0]).toMatchObject({ error: expect.stringContaining("10 MiB") });
  expect(results.results[2]).toMatchObject({ error: expect.stringContaining("UTF-8") });
  expect(await getDb().items.count()).toBe(1);
  expect(await getDb().documentAssets.count()).toBe(1);
});

test("a later quota failure preserves earlier files and reports each failure without dangling originals", async () => {
  const add = getDb().items.add.bind(getDb().items);
  vi.spyOn(getDb().items, "add").mockImplementationOnce(add).mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  const summary = await importFiles([file("first.txt", "first"), file("second.md", "second")], { prepareVideo });
  expect(summary.results).toEqual([
    expect.objectContaining({ status: "saved", fileName: "first.txt" }),
    expect.objectContaining({ status: "failed", fileName: "second.md", error: expect.stringContaining("storage") }),
  ]);
  expect(await getDb().items.count()).toBe(1);
  expect(await getDb().documentAssets.count()).toBe(1);
});

test("mixed selections save images, videos and notes in their detected types and report unsupported files", async () => {
  const image = Object.assign(new NodeBlob([new Uint8Array([1, 2, 3])], { type: "image/png" }), { name: "photo.png" }) as unknown as File;
  const video = new File(["video"], "clip.mp4", { type: "video/mp4" });
  const summary = await importFiles([image, video, file("plan.md", "# Plan"), file("page.html", "<h1>Later</h1>")], { collectionName: "Mixed", prepareVideo });
  expect(summary.results.map((result) => result.status)).toEqual(["saved", "saved", "saved", "failed"]);
  const items = await getDb().items.toArray();
  expect(items.map((item) => item.type).sort()).toEqual(["document", "image", "video"]);
  const [collection] = await getDb().collections.toArray();
  expect(items.every((item) => item.collectionIds[0] === collection.id)).toBe(true);
  expect(await getDb().assets.count()).toBe(1);
  expect(await getDb().videoAssets.count()).toBe(1);
  expect(await getDb().documentAssets.count()).toBe(1);
  expect(summary.results[3]).toMatchObject({ error: expect.stringContaining("HTML support") });
});

test("a video decoding failure preserves other files without saving an unusable video", async () => {
  const prepare = vi.fn().mockRejectedValue(new Error("Unreadable video"));
  const summary = await importFiles([file("before.txt", "Before"), new File(["broken"], "clip.mp4", { type: "video/mp4" }), file("after.md", "After")], { prepareVideo: prepare });
  expect(summary.results.map((result) => result.status)).toEqual(["saved", "failed", "saved"]);
  expect(await getDb().items.count()).toBe(2);
  expect(await getDb().videoAssets.count()).toBe(0);
});

test("missing collection validation leaves no media item or original behind", async () => {
  await expect(createImage({ assets: [{ bytes: new Uint8Array([1]), mimeType: "image/png" }], collectionIds: ["missing"] })).rejects.toThrow("collection");
  await expect(createVideo(new File(["video"], "clip.mp4", { type: "video/mp4" }), null, undefined, undefined, ["missing"])).rejects.toThrow("collection");
  expect(await getDb().items.count()).toBe(0);
  expect(await getDb().assets.count()).toBe(0);
  expect(await getDb().videoAssets.count()).toBe(0);
});

test("a requested gallery creates one image item with all files in order", async () => {
  const images = [1, 2].map((value) => Object.assign(new NodeBlob([new Uint8Array([value])], { type: "image/png" }), { name: `${value}.png` }) as unknown as File);
  const summary = await importFiles(images, { imageMode: "gallery", collectionName: "Gallery folder", prepareVideo });
  const items = await getDb().items.toArray();
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ type: "image", assetIds: expect.any(Array) });
  expect(items[0].type === "image" && items[0].assetIds).toHaveLength(2);
  expect(summary.results).toEqual(images.map((image) => ({ fileName: image.name, status: "saved", itemId: items[0].id })));
});

test("a failed first save leaves no empty import collection or orphaned assets", async () => {
  vi.spyOn(getDb().items, "add").mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  const summary = await importFiles([file("first.txt", "first")], { collectionName: "Canceled folder", prepareVideo });
  expect(summary.results[0].status).toBe("failed");
  expect(await getDb().collections.count()).toBe(0);
  expect(await getDb().items.count()).toBe(0);
  expect(await getDb().documentAssets.count()).toBe(0);
});

test("invalid UTF-8 does not create an empty collection", async () => {
  const invalid = { name: "bad.txt", size: 2, type: "", arrayBuffer: async () => new Uint8Array([0xc3, 0x28]).buffer } as unknown as File;
  await importFiles([invalid], { collectionName: "Invalid folder", prepareVideo });
  expect(await getDb().collections.count()).toBe(0);
  expect(await getDb().documentAssets.count()).toBe(0);
});

for (const type of ["image", "video"] as const) {
  test(`a failed ${type} import rolls back its collection, original and thumbnail`, async () => {
    const media = type === "image"
      ? Object.assign(new NodeBlob([new Uint8Array([1])], { type: "image/png" }), { name: "photo.png" }) as unknown as File
      : new File(["video"], "clip.mp4", { type: "video/mp4" });
    vi.spyOn(getDb().items, "add").mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
    await importFiles([media], { collectionName: "Failed import", prepareVideo });
    for (const table of [getDb().items, getDb().collections, getDb().assets, getDb().videoAssets, getDb().thumbnails]) expect(await table.count()).toBe(0);
  });
}

test("a failed gallery preserves shared originals and rolls back new assets and its collection", async () => {
  const existing = await createImage({ assets: [{ bytes: new Uint8Array([1]), mimeType: "image/png" }] });
  const images = [1, 2].map((value) => Object.assign(new NodeBlob([new Uint8Array([value])], { type: "image/png" }), { name: `${value}.png` }) as unknown as File);
  vi.spyOn(getDb().items, "add").mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  const summary = await importFiles(images, { imageMode: "gallery", collectionName: "Failed gallery", prepareVideo });
  expect(summary.results.every((result) => result.status === "failed")).toBe(true);
  expect(await getDb().items.toArray()).toEqual([existing]);
  expect(await getDb().assets.count()).toBe(1);
  expect(await getDb().collections.count()).toBe(0);
});

test("a mixed selection cannot be merged even if a gallery mode is requested", async () => {
  const summary = await importFiles([file("one.md", "# One"), file("two.txt", "Two")], { imageMode: "gallery", collectionName: "Mixed", prepareVideo });
  expect(summary.results.every((result) => result.status === "failed")).toBe(true);
  expect(await getDb().items.count()).toBe(0);
  expect(await getDb().collections.count()).toBe(0);
});

test("applies the selected tags and collection to each imported file atomically", async () => {
  const summary = await importFiles([file("one.txt", "One"), file("two.md", "# Two")], { collectionName: "Shared", tagNames: ["Reference"], prepareVideo });
  expect(summary.results.every((result) => result.status === "saved")).toBe(true);
  const [tag] = await getDb().tags.toArray();
  const [collection] = await getDb().collections.toArray();
  expect(tag.name).toBe("Reference");
  for (const item of await getDb().items.toArray()) expect(item).toMatchObject({ tagIds: [tag.id], collectionIds: [collection.id] });
});

test("a failed tagged import leaves no orphaned tag, collection or original", async () => {
  vi.spyOn(getDb().items, "add").mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  await importFiles([file("failed.txt", "Failed")], { collectionName: "Shared", tagNames: ["Reference"], prepareVideo });
  for (const table of [getDb().tags, getDb().collections, getDb().items, getDb().documentAssets]) expect(await table.count()).toBe(0);
});
