import { beforeEach, describe, expect, test } from "vitest";
import { linkScreenshotAssetIds, MAX_LINK_SCREENSHOTS } from "@/domain/link-screenshot";
import { exportKeepallBackup, importKeepallBackupMerge, importKeepallBackupReplace } from "./backup";
import { deleteKeepallDatabase, getDb } from "./db";
import {
  addLinkScreenshotImage,
  createLink,
  deleteItem,
  listItems,
  permanentlyDeleteItem,
  removeLinkScreenshotImage,
  setLinkCoverImage,
  updateLink,
} from "./items";

const URL = "https://studio.example/work";
const capture = (byte: number) => ({ bytes: new Uint8Array([byte, byte, byte]), mimeType: "image/webp", width: 1600, height: 1000, capturedAt: byte });

async function assetExists(id: string) {
  return Boolean(await getDb().assets.get(id));
}

describe("link screenshots", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("adds captures in order and stores their bytes", async () => {
    const link = await createLink({ url: URL });
    await addLinkScreenshotImage(link.id, URL, capture(1));
    const next = await addLinkScreenshotImage(link.id, URL, capture(2));

    expect(next.screenshots).toEqual([
      expect.objectContaining({ capturedAt: 1, width: 1600, height: 1000 }),
      expect.objectContaining({ capturedAt: 2 }),
    ]);
    for (const id of linkScreenshotAssetIds(next)) expect(await assetExists(id)).toBe(true);
    expect((await listItems())[0]).toEqual(next);
  });

  test("identical bytes are not appended twice", async () => {
    const link = await createLink({ url: URL });
    const first = await addLinkScreenshotImage(link.id, URL, capture(1));
    const again = await addLinkScreenshotImage(link.id, URL, capture(1));
    expect(linkScreenshotAssetIds(again)).toEqual(linkScreenshotAssetIds(first));
    expect(again.updatedAt).toBe(first.updatedAt);
  });

  test("matches the link by normalized URL and rejects a different page", async () => {
    const link = await createLink({ url: URL });
    await expect(addLinkScreenshotImage(link.id, "https://studio.example/work#top", capture(1))).resolves.toBeTruthy();
    await expect(addLinkScreenshotImage(link.id, "https://other.example/", capture(2))).rejects.toThrow();
    expect(linkScreenshotAssetIds((await listItems())[0] as never)).toHaveLength(1);
  });

  test("rejects links in Trash, non-images, and captures past the limit without storing bytes", async () => {
    const link = await createLink({ url: URL });
    await expect(addLinkScreenshotImage(link.id, URL, { ...capture(1), mimeType: "text/html" })).rejects.toThrow();

    for (let index = 0; index < MAX_LINK_SCREENSHOTS; index += 1) await addLinkScreenshotImage(link.id, URL, capture(10 + index));
    const assetsBefore = await getDb().assets.count();
    await expect(addLinkScreenshotImage(link.id, URL, capture(99))).rejects.toThrow(/up to/);
    expect(await getDb().assets.count()).toBe(assetsBefore);

    await deleteItem(link.id);
    await expect(addLinkScreenshotImage(link.id, URL, capture(100))).rejects.toThrow(/not found/);
  });

  test("removing a screenshot deletes its bytes and clears a cover on it", async () => {
    const link = await createLink({ url: URL });
    const withShots = await addLinkScreenshotImage(link.id, URL, capture(1));
    const [assetId] = linkScreenshotAssetIds(withShots);
    await setLinkCoverImage(link.id, assetId!);

    const next = await removeLinkScreenshotImage(link.id, assetId!);
    expect(next).not.toHaveProperty("screenshots");
    expect(next).not.toHaveProperty("coverAssetId");
    expect(await assetExists(assetId!)).toBe(false);
  });

  test("bytes shared with another item survive removal", async () => {
    const one = await createLink({ url: URL });
    const two = await createLink({ url: "https://second.example/" });
    const [shared] = linkScreenshotAssetIds(await addLinkScreenshotImage(one.id, URL, capture(1)));
    await addLinkScreenshotImage(two.id, "https://second.example/", capture(1));

    await removeLinkScreenshotImage(one.id, shared!);
    expect(await assetExists(shared!)).toBe(true);
  });

  test("setLinkCoverImage rejects assets the link does not own", async () => {
    const link = await createLink({ url: URL });
    await expect(setLinkCoverImage(link.id, "someone-else")).rejects.toThrow();
  });

  test("changing the URL or converting to a note releases screenshot bytes", async () => {
    const link = await createLink({ url: URL });
    const [first] = linkScreenshotAssetIds(await addLinkScreenshotImage(link.id, URL, capture(1)));
    const moved = await updateLink(link.id, { url: "https://moved.example/" });
    expect(moved).not.toHaveProperty("screenshots");
    expect(await assetExists(first!)).toBe(false);

    const [second] = linkScreenshotAssetIds(await addLinkScreenshotImage(link.id, "https://moved.example/", capture(2)));
    await updateLink(link.id, { url: "", noteContent: "Keep as note" });
    expect(await assetExists(second!)).toBe(false);
  });

  test("permanent delete releases screenshot bytes", async () => {
    const link = await createLink({ url: URL });
    const [assetId] = linkScreenshotAssetIds(await addLinkScreenshotImage(link.id, URL, capture(1)));
    await deleteItem(link.id);
    expect(await assetExists(assetId!)).toBe(true);
    await permanentlyDeleteItem(link.id);
    expect(await assetExists(assetId!)).toBe(false);
  });
});

describe("link screenshots in backups", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("replace import restores screenshots, bytes, and cover", async () => {
    const link = await createLink({ url: URL });
    await addLinkScreenshotImage(link.id, URL, capture(1));
    const withShots = await addLinkScreenshotImage(link.id, URL, capture(2));
    const covered = await setLinkCoverImage(link.id, linkScreenshotAssetIds(withShots)[1]!);
    const backup = JSON.parse(JSON.stringify(await exportKeepallBackup()));

    await deleteKeepallDatabase();
    await importKeepallBackupReplace(backup);
    const [restored] = await listItems();
    expect(restored).toEqual(covered);
    for (const id of linkScreenshotAssetIds(covered)) expect((await getDb().assets.get(id))?.byteLength).toBe(3);
  });

  test("merge keeps the union of local and incoming screenshots", async () => {
    const link = await createLink({ url: URL });
    await addLinkScreenshotImage(link.id, URL, capture(1));
    const both = await addLinkScreenshotImage(link.id, URL, capture(2));
    const backup = JSON.parse(JSON.stringify(await exportKeepallBackup()));
    const [a, b] = linkScreenshotAssetIds(both);

    await removeLinkScreenshotImage(link.id, b!);
    await addLinkScreenshotImage(link.id, URL, capture(3));
    await importKeepallBackupMerge(backup);

    const [merged] = await listItems();
    const ids = linkScreenshotAssetIds(merged as never);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(a);
    for (const id of ids) expect(await assetExists(id)).toBe(true);
  });

  test("merge into an empty library keeps screenshots and cover", async () => {
    const link = await createLink({ url: URL });
    const shot = await addLinkScreenshotImage(link.id, URL, capture(1));
    await setLinkCoverImage(link.id, linkScreenshotAssetIds(shot)[0]!);
    const backup = JSON.parse(JSON.stringify(await exportKeepallBackup()));

    await deleteKeepallDatabase();
    await importKeepallBackupMerge(backup);
    const [merged] = await listItems();
    expect(merged).toMatchObject({ screenshots: [expect.objectContaining({ capturedAt: 1 })] });
    expect(merged && "coverAssetId" in merged && merged.coverAssetId).toBe(linkScreenshotAssetIds(merged as never)[0]);
  });
});
