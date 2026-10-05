import { expect, test } from "vitest";
import { createTextDocument, updateDocument } from "./documents";
import { getDb } from "./db";
import { createDocumentSearcher } from "./document-search";

test("searches entire originals, combines fields and caches repeated queries without changing storage", async () => {
  const item = await createTextDocument({ fileName: "reference.md", title: "Design reference", noteContent: "Review later", bytes: new TextEncoder().encode("x".repeat(20_000) + "\nAnimation examples مرحبا café") });
  const revision = await getDb().backupState.get("library");
  let reads = 0;
  const search = createDocumentSearcher(async id => { reads++; return getDb().documentAssets.get(id); });
  const entries = [{ item, tagNames: ["Inspiration"] }];
  const result = await search({ id: 1, query: 'design "animation examples" inspiration', entries });
  expect(result?.matches).toEqual([[item.id, expect.objectContaining({ score: 16, excerpt: { label: "File contents", text: expect.stringContaining("Animation examples") } })]]);
  expect((await search({ id: 2, query: "مرحبا CAFÉ", entries }))?.matches).toHaveLength(1);
  expect((await search({ id: 3, query: "animation missing", entries }))?.matches).toEqual([]);
  expect(reads).toBe(1);
  expect(await getDb().backupState.get("library")).toEqual(revision);
});

test("edited originals replace old searchable content and canceled searches return no result", async () => {
  const item = await createTextDocument({ fileName: "plain.txt", bytes: new TextEncoder().encode("Old keyword") });
  const search = createDocumentSearcher();
  expect((await search({ id: 1, query: "old", entries: [{ item, tagNames: [] }] }))?.matches).toHaveLength(1);
  const edited = await updateDocument(item.id, { title: item.title, noteContent: "", content: "Replacement term" });
  expect((await search({ id: 2, query: "old", entries: [{ item: edited, tagNames: [] }] }))?.matches).toEqual([]);
  expect((await search({ id: 3, query: "replacement", entries: [{ item: edited, tagNames: [] }] }))?.matches).toHaveLength(1);
  expect(await search({ id: 4, query: "replacement", entries: [{ item: edited, tagNames: [] }] }, () => false)).toBeNull();
});

test("missing or unreadable files preserve metadata matches and report incomplete content search", async () => {
  const item = await createTextDocument({ fileName: "reference.txt", title: "Findable title", bytes: new TextEncoder().encode("Body term") });
  const entries = [{ item, tagNames: [] }, { item: { ...item, id: "invalid", assetId: "invalid" }, tagNames: [] }];
  const search = createDocumentSearcher(async id => id === "invalid" ? { id, bytes: new Uint8Array([0xc3, 0x28]), byteLength: 2, contentHash: "", createdAt: 1 } : undefined);
  const result = await search({ id: 1, query: "findable", entries });
  expect(result?.matches).toHaveLength(2);
  expect(result?.unavailable).toBe(2);
});

test("a bounded cache evicts old originals without dropping search matches", async () => {
  const item = await createTextDocument({ fileName: "one.txt", bytes: new TextEncoder().encode("First match") });
  const second = await createTextDocument({ fileName: "two.txt", bytes: new TextEncoder().encode("Second match") });
  let reads = 0;
  const search = createDocumentSearcher(async id => { reads++; return getDb().documentAssets.get(id); }, 30);
  const entries = [{ item, tagNames: [] }, { item: second, tagNames: [] }];
  expect((await search({ id: 1, query: "match", entries }))?.matches).toHaveLength(2);
  expect((await search({ id: 2, query: "match", entries }))?.matches).toHaveLength(2);
  expect(reads).toBe(4);
});
