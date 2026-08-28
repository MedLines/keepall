import { beforeEach, describe, expect, test } from "vitest";
import { MAX_LOCAL_IMAGE_BYTES } from "@/domain/image";
import { listCollections } from "./collections";
import { listItems } from "./items";
import { deleteKeepallDatabase } from "./db";
import { importImageFolderEntries } from "./image-folder-import";

const PNG_A = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const PNG_B = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]);

describe("importImageFolderEntries", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("creates one image item per file", async () => {
    const summary = await importImageFolderEntries([
      { name: "a.png", bytes: PNG_A, mimeType: "image/png" },
      { name: "b.png", bytes: PNG_B, mimeType: "image/png" },
    ]);

    expect(summary).toMatchObject({
      added: 2,
      reused: 0,
      skippedOversize: 0,
    });
    const items = await listItems();
    expect(items.filter((item) => item.type === "image")).toHaveLength(2);
  });

  test("reuses duplicate bytes and assigns optional collection", async () => {
    await importImageFolderEntries([
      { name: "first.png", bytes: PNG_A, mimeType: "image/png" },
    ]);
    const second = await importImageFolderEntries(
      [{ name: "dup.png", bytes: PNG_A, mimeType: "image/png" }],
      { collectionName: "Scans" },
    );

    expect(second).toMatchObject({ added: 0, reused: 1 });
    const collections = await listCollections();
    expect(collections.map((c) => c.name)).toEqual(["Scans"]);
  });

  test("re-importing a full batch reuses every item", async () => {
    const entries = Array.from({ length: 50 }, (_, index) => ({
      name: `shot-${index}.png`,
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, index & 0xff]),
      mimeType: "image/png",
    }));

    const first = await importImageFolderEntries(entries);
    expect(first).toMatchObject({ added: 50, reused: 0 });

    const second = await importImageFolderEntries(entries);
    expect(second).toMatchObject({ added: 0, reused: 50 });
    expect((await listItems()).filter((item) => item.type === "image")).toHaveLength(
      50,
    );
  });

  test("skips oversize and invalid files", async () => {
    const summary = await importImageFolderEntries([
      {
        name: "big.png",
        bytes: new Uint8Array(MAX_LOCAL_IMAGE_BYTES + 1),
        mimeType: "image/png",
      },
      { name: "notes.txt", bytes: new Uint8Array([1, 2]), mimeType: "text/plain" },
      { name: "ok.webp", bytes: PNG_A, mimeType: "image/webp" },
    ]);

    expect(summary).toMatchObject({
      added: 1,
      skippedOversize: 1,
      skippedInvalid: 1,
    });
  });
});
