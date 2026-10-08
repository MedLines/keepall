import { expect, test, vi } from "vitest";
import { captureExtensionFiles } from "./extension-file-capture";
import { getDb } from "./db";
import type { ExtensionFileManifest } from "@/domain/extension-file-capture";
const bytes = (text: string) => new TextEncoder().encode(text);
function manifest(names = ["one.txt"]): ExtensionFileManifest { return { manifestId: crypto.randomUUID(), itemIds: names.map(() => crypto.randomUUID()), imageMode: "separate", files: names.map(name => ({ name, type: "", size: 3 })), organization: {} }; }
const options = { prepareVideo: vi.fn(async () => new Blob(["poster"])) };
test("lost replies and concurrent retries produce one item without changing its metadata", async () => {
  const input = manifest();
  input.metadata = { title: "First", noteContent: "**note**", noteFormat: "markdown" };
  const results = await Promise.all([captureExtensionFiles(input, [bytes("one")], options), captureExtensionFiles(input, [bytes("one")], options)]);
  expect(results[0]).toEqual(results[1]);
  expect(results[0][0].status).toBe("saved");
  await captureExtensionFiles({ ...input, metadata: { title: "Changed" } }, [bytes("one")], options);
  expect(await getDb().items.toArray()).toEqual([expect.objectContaining({ id: input.itemIds[0], title: "First", noteFormat: "markdown" })]);
  expect(await getDb().documentAssets.count()).toBe(1);
});
test("identity collisions and trash do not create or overwrite items", async () => {
  const input = manifest();
  await captureExtensionFiles(input, [bytes("one")], options);
  expect((await captureExtensionFiles(input, [bytes("two")], options))[0].status).toBe("failed");
  await getDb().items.update(input.itemIds[0], { deletedAt: Date.now() });
  expect((await captureExtensionFiles(input, [bytes("one")], options))[0].status).toBe("failed");
  expect(await getDb().documentAssets.count()).toBe(1);
});
test("stale selected IDs never recreate organization from names", async () => {
  const input = manifest(); input.organization = { collectionId: crypto.randomUUID(), collectionName: "Gone", tagNames: ["New"] };
  expect((await captureExtensionFiles(input, [bytes("one")], options))[0].status).toBe("failed");
  for (const table of [getDb().items, getDb().collections, getDb().tags, getDb().documentAssets]) expect(await table.count()).toBe(0);
});
test("partial failures retry independently and cancel preserves completed results", async () => {
  const input = manifest(["one.txt", "two.txt"]);
  const add = getDb().items.add.bind(getDb().items);
  vi.spyOn(getDb().items, "add").mockImplementationOnce(add).mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  expect((await captureExtensionFiles(input, [bytes("one"), bytes("two")], options)).map(r => r.status)).toEqual(["saved", "failed"]);
  expect((await captureExtensionFiles(input, [bytes("one"), bytes("two")], options)).map(r => r.status)).toEqual(["saved", "saved"]);
  expect(await getDb().items.count()).toBe(2);
  const controller = new AbortController();
  const next = manifest(["one.txt", "two.txt"]);
  expect((await captureExtensionFiles(next, [bytes("one"), bytes("two")], { ...options, signal: controller.signal, onResult: () => controller.abort() })).map(r => r.status)).toEqual(["saved", "cancelled"]);
});
test("gallery replay compares ordered hashes and rolls back cancellation", async () => {
  const input = manifest(["a.png", "b.png"]); input.imageMode = "gallery"; input.itemIds = [input.itemIds[0]];
  input.metadata = { noteContent: "Caption", noteFormat: "markdown", sourceUrl: "https://example.com/" };
  const content = [bytes("one"), bytes("two")];
  expect((await captureExtensionFiles(input, content, options))[0].status).toBe("saved");
  expect((await captureExtensionFiles(input, content.toReversed(), options))[0].status).toBe("failed");
  expect(await getDb().items.get(input.itemIds[0])).toMatchObject({ caption: "Caption", captionFormat: "markdown", sourceUrl: "https://example.com/" });
  const controller = new AbortController(); const add = getDb().items.add.bind(getDb().items);
  vi.spyOn(getDb().items, "add").mockImplementation((...args) => add(...args).then(id => { controller.abort(); return id; }));
  const cancelled = { ...input, itemIds: [crypto.randomUUID()], organization: { collectionName: "Canceled" } };
  expect((await captureExtensionFiles(cancelled, [bytes("new"), bytes("end")], { ...options, signal: controller.signal })).every(r => r.status === "cancelled")).toBe(true);
  expect(await getDb().assets.count()).toBe(2); expect(await getDb().collections.count()).toBe(0);
});

test("concurrent stable image IDs create one gallery and one set of originals", async () => {
  const input = manifest(["a.png", "b.png"]); input.imageMode = "gallery"; input.itemIds = [input.itemIds[0]];
  const replies = await Promise.all([captureExtensionFiles(input, [bytes("one"), bytes("two")], options), captureExtensionFiles(input, [bytes("one"), bytes("two")], options)]);
  expect(replies[0]).toEqual(replies[1]); expect(replies[0][0].status).toBe("saved");
  expect(await getDb().items.count()).toBe(1); expect(await getDb().assets.count()).toBe(2);
});

test("video retries compare the original blob and preserve the first metadata", async () => {
  const { File: NodeFile } = await import("node:buffer");
  const { createVideo } = await import("./videos");
  const id = crypto.randomUUID(); const file = new NodeFile(["video"], "clip.mp4", { type: "video/mp4" }) as unknown as File;
  const replies = await Promise.all([createVideo(file, null, "First", undefined, [], { id }), createVideo(file, null, "Second", undefined, [], { id })]);
  expect(replies[0]).toEqual(replies[1]);
  expect(await getDb().items.count()).toBe(1); expect(await getDb().videoAssets.count()).toBe(1);
  const different = new NodeFile(["other"], "clip.mp4", { type: "video/mp4" }) as unknown as File;
  await expect(createVideo(different, null, undefined, undefined, [], { id })).rejects.toThrow("different video");
});

test("stale tag IDs roll back new organization for every file kind", async () => {
  for (const name of ["one.txt", "one.png"]) {
    const input = manifest([name]); input.organization = { tagIds: [crypto.randomUUID()], tagNames: ["Gone"], collectionName: "No orphan" };
    expect((await captureExtensionFiles(input, [bytes("one")], options))[0]).toMatchObject({ status: "failed", error: expect.stringContaining("tag") });
  }
  for (const table of [getDb().items, getDb().collections, getDb().tags, getDb().assets, getDb().documentAssets]) expect(await table.count()).toBe(0);
});
