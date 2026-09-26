import { beforeEach, expect, test } from "vitest";
import { deleteKeepallDatabase, getDb } from "./db";
import { saveExtensionSelection } from "./extension-selection";
import { saveExtensionLink } from "./extension-capture";
import { undoExtensionCapture } from "./extension-capture-undo";

beforeEach(deleteKeepallDatabase);
const input = () => ({ captureId: crypto.randomUUID(), url: "https://example.com/article", title: "Article", text: "Selected passage" });

test("saves literal text with its source, deduplicates repeat saves, and supports Undo", async () => {
  const capture = input();
  const result = await saveExtensionSelection(capture);
  expect(await getDb().items.get(result.itemId)).toMatchObject({ type: "link", url: capture.url, noteContent: capture.text, collectionIds: [] });
  expect((await saveExtensionSelection({ ...capture, captureId: crypto.randomUUID() })).outcome).toBe("unchanged");
  expect(await getDb().items.count()).toBe(1);
  await undoExtensionCapture(result.undoToken!);
  expect(await getDb().items.count()).toBe(0);
});

test("appends atomically without replacing a personal note, title, tags, collection, or local image markers", async () => {
  const saved = await saveExtensionLink({ ...input(), noteContent: "My **note**\n\n![Image](keepall-image:local-id)", noteFormat: "markdown" });
  await getDb().items.update(saved.itemId, { collectionIds: ["reading"], tagIds: ["quote"] });
  const before = await getDb().items.get(saved.itemId);
  const capture = { ...input(), text: "*literal* <img src=x>" };
  const results = await Promise.all([saveExtensionSelection(capture), saveExtensionSelection({ ...capture, captureId: crypto.randomUUID() })]);
  expect(results.map((result) => result.outcome).sort()).toEqual(["unchanged", "updated"]);
  const after = await getDb().items.get(saved.itemId);
  expect(after).toEqual({ ...before, noteContent: "My **note**\n\n![Image](keepall-image:local-id)\n\n\\*literal\\* \\<img src\\=x\\>", updatedAt: expect.any(Number) });
});

test("rejects empty, oversized, unsupported sources and full notes without changing saved data", async () => {
  await expect(saveExtensionSelection({ ...input(), text: " " })).rejects.toThrow("Select some text");
  await expect(saveExtensionSelection({ ...input(), text: "a".repeat(10001) })).rejects.toThrow("too long");
  await expect(saveExtensionSelection({ ...input(), url: "javascript:alert(1)" })).rejects.toThrow("cannot be saved");
  const saved = await saveExtensionLink({ ...input(), noteContent: "a".repeat(10000) });
  await expect(saveExtensionSelection(input())).rejects.toThrow("note is full");
  expect((await getDb().items.get(saved.itemId))?.type).toBe("link");
  expect(await getDb().items.count()).toBe(1);
});

test("preserves the exact source URL and keeps different ports separate", async () => {
  const first = await saveExtensionSelection({ ...input(), url: "http://localhost:3100/help#section" });
  const second = await saveExtensionSelection({ ...input(), url: "http://localhost:3001/help#section" });
  expect(second.itemId).not.toBe(first.itemId);
  expect(await getDb().items.get(first.itemId)).toMatchObject({ url: "http://localhost:3100/help#section" });
});
