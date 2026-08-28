import { beforeEach, describe, expect, test } from "vitest";
import { createLink } from "./items";
import { listCollections } from "./collections";
import { listTags } from "./tags";
import { deleteKeepallDatabase } from "./db";
import { importBookmarksHtmlMerge } from "./bookmarks-html-import";

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://new.example/">New link</A>
  <DT><H3>Reading</H3>
  <DL><p>
    <DT><A HREF="https://nested.example/" TAGS="read">Nested</A>
  </DL><p>
</DL><p>`;

describe("importBookmarksHtmlMerge", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("adds new links with leaf collection and tags", async () => {
    const summary = await importBookmarksHtmlMerge(SAMPLE, {
      collectionPolicy: "unsorted-only",
    });

    expect(summary).toMatchObject({ added: 2, merged: 0, skipped: 0 });
    const collections = await listCollections();
    expect(collections.map((c) => c.name)).toEqual(["Reading"]);
    const tags = await listTags();
    expect(tags.map((t) => t.name)).toEqual(["read"]);
  });

  test("merges same URL twice and skips invalid rows", async () => {
    await importBookmarksHtmlMerge(SAMPLE, { collectionPolicy: "keep" });
    const second = await importBookmarksHtmlMerge(SAMPLE, {
      collectionPolicy: "keep",
    });
    expect(second).toMatchObject({ added: 0, merged: 2, skipped: 0 });

    const bad = `<DL><p>
      <DT><A HREF="javascript:alert(1)">Bad</A>
      <DT><A HREF="https://ok.example/">OK</A>
    </DL>`;
    const mixed = await importBookmarksHtmlMerge(bad, {
      collectionPolicy: "keep",
    });
    expect(mixed.added).toBe(1);
    expect(mixed.skipped).toBe(1);
    expect(mixed.skippedRows[0]?.reason).toContain("Invalid");
  });

  test("keep policy does not move an already filed link", async () => {
    const { assignCollectionToItem } = await import("./items");
    const { createCollection } = await import("./collections");

    const existing = await createLink({
      url: "https://nested.example/",
      title: "Local",
    });
    const reading = await createCollection({ name: "Local collection" });
    await assignCollectionToItem(existing.id, reading.id);

    await importBookmarksHtmlMerge(SAMPLE, { collectionPolicy: "keep" });

    const { findLinkByNormalizedUrl } = await import("./items");
    const link = await findLinkByNormalizedUrl("https://nested.example/");
    expect(link?.collectionIds).toEqual([reading.id]);
  });

  test("apply policy moves an existing link to the HTML folder", async () => {
    await createLink({
      url: "https://nested.example/",
      title: "Local",
    });

    await importBookmarksHtmlMerge(SAMPLE, { collectionPolicy: "apply" });

    const collections = await listCollections();
    const reading = collections.find((c) => c.name === "Reading");
    expect(reading).toBeDefined();

    const { listItems, findLinkByNormalizedUrl } = await import("./items");
    const link = await findLinkByNormalizedUrl("https://nested.example/");
    expect(link?.collectionIds).toEqual([reading!.id]);
  });
});
