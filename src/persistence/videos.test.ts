import { beforeEach, describe, expect, test } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { deleteKeepallDatabase, getDb } from "./db";
import { createVideo, updateVideoDetails } from "./videos";
import { exportKeepallArchive, importKeepallArchiveMerge, importKeepallArchiveReplace } from "./backup-archive";
import { createImage, deleteItem, listItems } from "./items";
import { createTag } from "./tags";
import { createCollection } from "./collections";
import { MAX_LOCAL_VIDEO_BYTES, VideoValidationError } from "@/domain/video";

describe("local videos", () => {
  beforeEach(async () => { await deleteKeepallDatabase(); });

  test("stores a video Blob and deletes it with its item", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "demo.mp4", { type: "video/mp4" });
    const item = await createVideo(file);
    expect(item.title).toBe("demo");
    expect((await listItems())[0]).toEqual(item);
    expect((await getDb().videoAssets.get(item.assetId))?.byteLength).toBe(3);
    await deleteItem(item.id);
    expect(await getDb().videoAssets.get(item.assetId)).toBeUndefined();
  });

  test("video survives a binary backup round trip", async () => {
    const file = Object.assign(new NodeBlob([new Uint8Array([4, 5, 6])], { type: "video/mp4" }), { name: "clip.mp4" }) as unknown as File;
    const created = await createVideo(file, new NodeBlob([new Uint8Array([7, 8])], { type: "image/webp" }) as unknown as Blob);
    const original = await updateVideoDetails(created.id, { title: "Saved clip", noteContent: "# Watch later", noteFormat: "markdown" });
    const image = await createImage({ assets: [{ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" }] });
    const archive = await exportKeepallArchive();
    await deleteKeepallDatabase();
    await importKeepallArchiveReplace(archive);
    expect(await listItems()).toEqual([image, original]);
    expect((await getDb().videoAssets.get(original.assetId))?.byteLength).toBe(3);
    expect(await getDb().thumbnails.get(original.assetId)).toBeDefined();
  });

  test("merge remaps a video, its poster, tags, and collection without duplicating it", async () => {
    const file = Object.assign(new NodeBlob([new Uint8Array([4, 5, 6])], { type: "video/mp4" }), { name: "clip.mp4" }) as unknown as File;
    const original = await createVideo(file, new NodeBlob([new Uint8Array([7, 8])], { type: "image/webp" }) as unknown as Blob);
    const incomingTag = await createTag({ name: "movies" });
    const incomingCollection = await createCollection({ name: "watch" });
    await getDb().items.put({ ...original, tagIds: [incomingTag.id], collectionIds: [incomingCollection.id] });
    const archive = await exportKeepallArchive();

    await deleteKeepallDatabase();
    const localTag = await createTag({ name: "movies" });
    const localCollection = await createCollection({ name: "watch" });
    const first = await importKeepallArchiveMerge(archive);
    expect(first.summary.added).toBe(1);
    const [merged] = await listItems();
    expect(merged).toMatchObject({ type: "video", tagIds: [localTag.id], collectionIds: [localCollection.id] });
    if (merged?.type !== "video") throw new Error("Expected video");
    expect(merged.assetId).not.toBe(original.assetId);
    expect(await getDb().thumbnails.get(merged.assetId)).toBeDefined();
    const second = await importKeepallArchiveMerge(archive);
    expect(second.summary.unchanged).toBe(1);
    expect(await getDb().videoAssets.count()).toBe(1);
  });

  test("rejects files larger than 100 MiB", async () => {
    const tooLarge = { name: "large.mp4", type: "video/mp4", size: MAX_LOCAL_VIDEO_BYTES + 1 } as File;
    await expect(createVideo(tooLarge)).rejects.toBeInstanceOf(VideoValidationError);
    expect(await listItems()).toEqual([]);
  });
});
