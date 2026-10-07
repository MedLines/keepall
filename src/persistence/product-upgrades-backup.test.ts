import { Blob as NodeBlob } from "node:buffer";
import { expect, test } from "vitest";
import { buildAsset, hashAssetBytes } from "@/domain/asset";
import { buildImage } from "@/domain/image";
import { DEFAULT_SHORTCUTS } from "@/domain/keyboard-shortcuts";
import { matchesSearchQuery } from "@/domain/search";
import { saveLinkArticle } from "./articles";
import { exportKeepallArchive, importKeepallArchiveMerge, importKeepallArchiveReplace } from "./backup-archive";
import { deleteKeepallDatabase, getDb } from "./db";
import { createDocument, getDocumentOriginal } from "./documents";
import { saveImageAnalysis } from "./image-analysis";
import { createLink, getItem } from "./items";
import { getLibraryPreferences, putKeyboardShortcuts } from "./library-preferences";

test.each(["replace", "merge"] as const)("ZIP %s preserves articles, image analysis, documents, and shortcut preferences together", async mode => {
  const shortcuts = { ...DEFAULT_SHORTCUTS, capture: "Alt+KeyJ" };
  await putKeyboardShortcuts(shortcuts);
  const link = await createLink({ url: "https://example.com/story", noteContent: "Keep this context" });
  const article = { title: "Saved research", text: "Narwhal migration research", sourceUrl: link.url, author: "A. Writer", capturedAt: 100 };
  await saveLinkArticle(link.id, link.url, article);
  const asset = buildAsset({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" });
  const localAssetId = crypto.randomUUID();
  await getDb().assets.put(asset);
  const image = buildImage({ assetId: asset.id, title: "Receipt" }, { id: "receipt" });
  await getDb().items.put(image);
  const analysis = { assetId: asset.id, palette: ["#FF0000"], ocr: { text: "Invoice 4823", confidence: 95, language: "eng" as const, extractedAt: 100 } };
  await saveImageAnalysis(image.id, analysis);
  const documentBytes = new TextEncoder().encode("Exact original document\r\nمرحبا");
  const document = await createDocument({ fileName: "reference.txt", bytes: documentBytes, noteContent: "My document note" });
  const exported = await exportKeepallArchive();
  const archive = new NodeBlob([new Uint8Array(await exported.arrayBuffer())]) as unknown as Blob;

  await deleteKeepallDatabase();
  if (mode === "merge") {
    await putKeyboardShortcuts(DEFAULT_SHORTCUTS);
    await getDb().assets.put({ ...asset, id: localAssetId, contentHash: await hashAssetBytes(asset.bytes) });
    await importKeepallArchiveMerge(archive);
  } else {
    await importKeepallArchiveReplace(archive);
  }

  const restoredLink = await getItem(link.id);
  expect(restoredLink).toMatchObject({ article, noteContent: "Keep this context" });
  expect(matchesSearchQuery(restoredLink!, "narwhal")).toBe(true);
  const restoredImage = await getItem(image.id);
  const restoredAssetId = mode === "merge" ? localAssetId : asset.id;
  expect(restoredImage).toMatchObject({ assetIds: [restoredAssetId], analysis: [{ ...analysis, assetId: restoredAssetId }] });
  expect(matchesSearchQuery(restoredImage!, "invoice color:red")).toBe(true);
  expect(Array.from((await getDb().assets.get(restoredAssetId))!.bytes)).toEqual(Array.from(asset.bytes));
  expect(Array.from((await getDocumentOriginal(document.id))!.bytes)).toEqual(Array.from(documentBytes));
  expect(await getItem(document.id)).toMatchObject({ noteContent: "My document note" });
  expect((await getLibraryPreferences()).keyboardShortcuts).toEqual(mode === "merge" ? DEFAULT_SHORTCUTS : shortcuts);
});
