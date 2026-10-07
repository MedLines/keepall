import { Blob as NodeBlob } from "node:buffer";
import { expect, test, vi } from "vitest";
import { createLink, deleteItem, getItem, updateLink } from "./items";
import { saveLinkArticle } from "./articles";
import { getDb } from "./db";
import { exportKeepallBackup, importKeepallBackupReplace, importKeepallBackupMerge } from "./backup";
import { exportKeepallArchive, importKeepallArchiveReplace } from "./backup-archive";

const article = { title: "Offline story", text: "Narwhal reporting in several paragraphs.", sourceUrl: "https://example.com/story", capturedAt: 100, author: "Ada Writer" };

test("saving article preserves the current note and organization and advances backup revision", async () => {
  const link = await createLink({ url: article.sourceUrl, noteContent: "Initial" });
  await updateLink(link.id, { url: link.url, noteContent: "Concurrent note" });
  const before = (await getDb().backupState.get("library"))?.revision;
  const saved = await saveLinkArticle(link.id, link.url, article);
  expect(saved).toMatchObject({ article, noteContent: "Concurrent note", tagIds: [], collectionIds: [] });
  expect((await getDb().backupState.get("library"))?.revision).not.toBe(before);
});

test("a stale capture or failed write preserves the existing link and article", async () => {
  const link = await createLink({ url: article.sourceUrl, noteContent: "Personal" });
  const saved = await saveLinkArticle(link.id, link.url, article);
  vi.spyOn(getDb().items, "put").mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  await expect(saveLinkArticle(link.id, link.url, { ...article, text: "Replacement" })).rejects.toThrow("Quota");
  expect(await getItem(link.id)).toEqual(saved);
  await updateLink(link.id, { url: "https://example.com/changed" });
  await expect(saveLinkArticle(link.id, link.url, article)).rejects.toThrow(/changed/);
  expect(await getItem(link.id)).not.toHaveProperty("article", expect.anything());
  await deleteItem(link.id);
  await expect(saveLinkArticle(link.id, "https://example.com/changed", article)).rejects.toThrow(/available/);
});

test("saved article text survives JSON and ZIP replacement and merge", async () => {
  const link = await createLink({ url: article.sourceUrl, noteContent: "Personal" });
  const saved = await saveLinkArticle(link.id, link.url, article);
  const json = JSON.stringify(await exportKeepallBackup());
  await importKeepallBackupReplace(JSON.parse(json));
  expect(await getItem(link.id)).toEqual(saved);
  const exported = await exportKeepallArchive();
  const archive = new NodeBlob([new Uint8Array(await exported.arrayBuffer())]) as unknown as Blob;
  await importKeepallArchiveReplace(archive);
  expect(await getItem(link.id)).toEqual(saved);
  const backup = JSON.parse(json);
  backup.items[0].updatedAt = saved.updatedAt + 1;
  backup.items[0].url = "https://example.com/updated";
  backup.items[0].article.sourceUrl = "https://example.com/updated";
  backup.items[0].article.text = "Newer article";
  await importKeepallBackupMerge(backup);
  expect(await getItem(link.id)).toMatchObject({ url: "https://example.com/updated", article: { text: "Newer article" }, noteContent: "Personal" });
});
