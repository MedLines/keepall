import { describe, expect, test } from "vitest";
import { createImage, createOrReuseImage } from "./items";
import { getDb } from "./db";

function imagePayload(value: number) {
  return { bytes: new Uint8Array([value]), mimeType: "image/png" };
}

describe("atomic image creation", () => {
  test.each(["asset", "item"] as const)(
    "%s write failure rolls back new records and preserves existing images",
    async (failureAt) => {
      await createImage({ assets: [imagePayload(1)], title: "Keep this image" });
      const db = getDb();
      const originalItems = await db.items.toArray();
      const originalAssets = await db.assets.toArray();
      let assetWrites = 0;

      function failSecondAssetWrite() {
        assetWrites += 1;
        if (failureAt === "asset" && assetWrites === 2) {
          throw new Error("Simulated asset write failure");
        }
      }
      function failItemWrite() {
        if (failureAt === "item") {
          throw new Error("Simulated item write failure");
        }
      }

      db.assets.hook("creating", failSecondAssetWrite);
      db.items.hook("creating", failItemWrite);
      try {
        await expect(
          createOrReuseImage({
            assets: [imagePayload(1), imagePayload(2), imagePayload(3)],
          }),
        ).rejects.toThrow(`Simulated ${failureAt} write failure`);
      } finally {
        db.assets.hook("creating").unsubscribe(failSecondAssetWrite);
        db.items.hook("creating").unsubscribe(failItemWrite);
      }

      db.close();
      await db.open();
      expect(await db.items.toArray()).toEqual(originalItems);
      expect(await db.assets.toArray()).toEqual(originalAssets);
    },
  );

  test("an invalid later payload leaves no earlier assets behind", async () => {
    await expect(
      createImage({
        assets: [imagePayload(1), { bytes: new Uint8Array(), mimeType: "image/png" }],
      }),
    ).rejects.toThrow("Image file is empty");
    expect(await getDb().items.count()).toBe(0);
    expect(await getDb().assets.count()).toBe(0);
  });

  test("successful gallery creation commits new assets and reuses existing ones", async () => {
    const existing = await createImage({ assets: [imagePayload(1)] });
    const { image, created } = await createOrReuseImage({
      assets: [imagePayload(1), imagePayload(2), imagePayload(2)],
      title: "New gallery",
    });
    const db = getDb();
    db.close();
    await db.open();

    expect(created).toBe(true);
    expect(await db.items.get(image.id)).toEqual(image);
    expect(await db.items.get(existing.id)).toEqual(existing);
    expect(image.assetIds[0]).toBe(existing.assetIds[0]);
    expect(image.assetIds[1]).toBe(image.assetIds[2]);
    expect(await db.assets.count()).toBe(2);
    for (const assetId of image.assetIds) {
      expect(await db.assets.get(assetId)).toBeDefined();
    }
  });
});
