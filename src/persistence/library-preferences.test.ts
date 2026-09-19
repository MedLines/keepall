import { beforeEach, describe, expect, test } from "vitest";
import { deleteKeepallDatabase } from "./db";
import { createCollection, deleteCollection } from "./collections";
import {
  getLibraryPreferences,
  movePinnedCollectionBefore,
  pinCollection,
  unpinCollection,
} from "./library-preferences";

describe("library preferences persistence", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("pins, reorders, and unpins collections", async () => {
    const alpha = await createCollection({ name: "Alpha" });
    const beta = await createCollection({ name: "Beta" });
    const gamma = await createCollection({ name: "Gamma" });

    await pinCollection(alpha.id);
    await pinCollection(beta.id);
    await pinCollection(gamma.id);
    await movePinnedCollectionBefore(gamma.id, alpha.id);
    await unpinCollection(beta.id);

    expect((await getLibraryPreferences()).pinnedCollectionIds).toEqual([
      gamma.id,
      alpha.id,
    ]);
  });

  test("deleting a collection removes its saved pin", async () => {
    const collection = await createCollection({ name: "Reading" });
    await pinCollection(collection.id);

    await deleteCollection(collection.id);

    expect((await getLibraryPreferences()).pinnedCollectionIds).toEqual([]);
  });
});
