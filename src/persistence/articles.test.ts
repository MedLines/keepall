import { Blob as NodeBlob } from "node:buffer";
import sharp from "sharp";
import { expect, test, vi } from "vitest";
import { createLink, deleteItem, getItem, updateLink } from "./items";
import { saveLinkArticle } from "./articles";
import { getDb } from "./db";
import { exportKeepallBackup, importKeepallBackupReplace, importKeepallBackupMerge } from "./backup";
import { exportKeepallArchive, importKeepallArchiveReplace } from "./backup-archive";
import { getAsset, putAsset } from "./assets";
import { articleAssetIds } from "@/domain/article";
import { parseKeepallBackup } from "@/domain/backup";
import { bytesToBase64 } from "@/domain/backup-encoding";

const article = { title: "Offline story", text: "Narwhal reporting in several paragraphs.", sourceUrl: "https://example.com/story", capturedAt: 100, author: "Ada Writer" };

async function illustratedCapture(color = "red") {
  const bytes = new Uint8Array(await sharp({ create: { width: 12, height: 8, channels: 3, background: color } }).webp().toBuffer());
  return { ...article, content: [{ tag: "p", children: [{ text: article.text }] }, { tag: "figure", children: [{ tag: "img", children: [], src: "https://example.com/chart.png", alt: "Query throughput chart" }, { tag: "figcaption", children: [{ text: "Benchmark results" }] }] }, { tag: "pre", children: [{ tag: "code", children: [{ text: "const queries = 118;\n  report(queries);" }] }] }], images: [{ sourceUrl: "https://example.com/chart.png", mimeType: "image/webp", dataBase64: bytesToBase64(bytes) }] };
}

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

test("inline images persist as local assets and survive ZIP restore alongside captions and code", async () => {
  const link = await createLink({ url: article.sourceUrl, noteContent: "My note" });
  const saved = await saveLinkArticle(link.id, link.url, await illustratedCapture());
  const [assetId] = articleAssetIds(saved.article);
  expect(assetId).toBeTruthy();
  expect((await getAsset(assetId!))?.mimeType).toBe("image/webp");
  expect(saved.article).not.toHaveProperty("images");
  expect(saved.article?.text).toContain("Query throughput chart");
  const backup = await exportKeepallBackup();
  expect(parseKeepallBackup(backup).items[0]).toEqual(saved);
  const incomplete = { ...backup, assets: [] };
  expect(() => parseKeepallBackup(incomplete)).toThrow(/missing article image/);
  const exported = await exportKeepallArchive();
  await importKeepallArchiveReplace(new NodeBlob([new Uint8Array(await exported.arrayBuffer())]) as unknown as Blob);
  expect(await getItem(link.id)).toEqual(saved);
  expect((await getAsset(assetId!))?.byteLength).toBeGreaterThan(0);
});

test("article image merges remap deduplicated asset IDs and URL changes collect unreferenced images", async () => {
  const capture = await illustratedCapture();
  const link = await createLink({ url: article.sourceUrl });
  const saved = await saveLinkArticle(link.id, link.url, capture);
  const backup = await exportKeepallBackup();
  const originalId = articleAssetIds(saved.article)[0]!;
  const bytes = (await getAsset(originalId))!.bytes;
  await importKeepallBackupReplace({ ...backup, items: [], assets: [] });
  const localAsset = await putAsset({ bytes, mimeType: "image/webp" });
  expect(localAsset.id).not.toBe(originalId);
  await importKeepallBackupMerge(backup);
  const restored = await getItem(link.id);
  expect(restored?.type).toBe("link");
  expect(restored?.type === "link" && articleAssetIds(restored.article)).toEqual([localAsset.id]);
  const second = await createLink({ url: "https://example.com/second" });
  const shared = await saveLinkArticle(second.id, second.url, { ...capture, sourceUrl: second.url });
  expect(articleAssetIds(shared.article)).toEqual([localAsset.id]);
  await updateLink(link.id, { url: "https://example.com/changed" });
  expect(await getAsset(localAsset.id)).toBeDefined();
  await updateLink(second.id, { url: "https://example.com/changed-second" });
  expect(await getAsset(localAsset.id)).toBeUndefined();
});

test("failed saves roll back new image assets and preserve the previous readable copy", async () => {
  const link = await createLink({ url: article.sourceUrl });
  const saved = await saveLinkArticle(link.id, link.url, await illustratedCapture());
  const before = await getDb().assets.toArray();
  vi.spyOn(getDb().items, "put").mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
  await expect(saveLinkArticle(link.id, link.url, await illustratedCapture("blue"))).rejects.toThrow("Quota");
  expect(await getItem(link.id)).toEqual(saved);
  expect(await getDb().assets.toArray()).toEqual(before);
});

test("backup merges collect both losing imported article images and replaced local images", async () => {
  const link = await createLink({ url: article.sourceUrl });
  const red = await saveLinkArticle(link.id, link.url, await illustratedCapture("red"));
  const redBytes = (await getAsset(articleAssetIds(red.article)[0]!))!.bytes;
  const redBackup = await exportKeepallBackup();
  const blue = await saveLinkArticle(link.id, link.url, await illustratedCapture("blue"));
  const blueId = articleAssetIds(blue.article)[0]!;
  await importKeepallBackupMerge(redBackup);
  expect(await getItem(link.id)).toEqual(blue);
  expect(await getDb().assets.count()).toBe(1);
  expect(await getAsset(blueId)).toBeDefined();
  redBackup.items[0].updatedAt = blue.updatedAt + 1;
  await importKeepallBackupMerge(redBackup);
  const updated = await getItem(link.id);
  expect(updated?.type === "link" && updated.article?.text).toBe(red.article?.text);
  const updatedId = updated?.type === "link" ? articleAssetIds(updated.article)[0]! : "";
  expect((await getAsset(updatedId))?.bytes).toEqual(redBytes);
  expect(await getDb().assets.count()).toBe(1);
  expect(await getAsset(blueId)).toBeUndefined();
});
