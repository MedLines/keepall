import { Blob as NodeBlob } from "node:buffer";
import { BlobReader, TextWriter, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Item } from "@/domain/item";
import { linkScreenshotAssetIds } from "@/domain/link-screenshot";
import {
  contextPackFileName,
  contextPackFromSnapshot,
  readContextPackSnapshot,
  writeContextPackArchive,
} from "./context-pack-archive";
import { deleteKeepallDatabase, getDb } from "./db";
import { addLinkScreenshotImage, createLink, createNote, deleteItem } from "./items";

vi.mock("./pdf-document", () => ({ readPdfText: vi.fn(async () => "Extracted PDF text") }));

const URL = "https://studio.example/work";
const SOURCE = { kind: "selection" as const, description: "Selected items" };
const NOW = Date.UTC(2026, 10, 12);

async function seedDocuments() {
  const db = getDb();
  const base = { noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
  await db.documentAssets.bulkPut([
    { id: "md-bytes", bytes: new TextEncoder().encode("# Plan\nShip it"), byteLength: 14, contentHash: "md-hash", createdAt: 1 },
    { id: "pdf-bytes", bytes: new Uint8Array([37, 80, 68, 70]), byteLength: 4, contentHash: "pdf-hash", createdAt: 1 },
  ]);
  await db.videoAssets.put({ id: "video-bytes", mimeType: "video/webm", byteLength: 3, blob: new NodeBlob([new Uint8Array([7, 8, 9])], { type: "video/webm" }) as unknown as Blob, createdAt: 1 });
  const seeded: Item[] = [
    { ...base, id: "doc-md", type: "document", format: "markdown", title: "Plan", sourceFileName: "plan.md", assetId: "md-bytes" },
    { ...base, id: "doc-pdf", type: "document", format: "pdf", title: "Scan", sourceFileName: "scan.pdf", assetId: "pdf-bytes" },
    { ...base, id: "video", type: "video", title: "Walkthrough", sourceFileName: "walk.webm", assetId: "video-bytes" },
  ];
  await db.items.bulkPut(seeded);
}

async function unzip(blob: Blob) {
  const reader = new ZipReader(new BlobReader(new NodeBlob([new Uint8Array(await blob.arrayBuffer())]) as unknown as Blob));
  const entries = await reader.getEntries();
  const files = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (!entry.directory) files.set(entry.filename, await entry.getData!(new Uint8ArrayWriter()));
  }
  const text = async (path: string) => {
    const entry = entries.find((candidate) => candidate.filename === path);
    return entry && !entry.directory ? entry.getData!(new TextWriter()) : undefined;
  };
  await reader.close();
  return { files, text };
}

describe("Context Pack archive", () => {
  beforeEach(async () => {
    await deleteKeepallDatabase();
  });

  test("reads items in the requested order with their files and extracted text, skipping Trash", async () => {
    const link = await createLink({ url: URL, title: "Studio" });
    const shot = await addLinkScreenshotImage(link.id, URL, { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/webp", width: 1600, height: 1000 });
    const trashed = await createNote({ content: "gone" });
    await deleteItem(trashed.id);
    await seedDocuments();

    const snapshot = await readContextPackSnapshot(["video", trashed.id, "doc-pdf", link.id, "doc-md"]);
    expect(snapshot.items.map((item) => item.id)).toEqual(["video", "doc-pdf", link.id, "doc-md"]);
    const [shotId] = linkScreenshotAssetIds(shot);
    expect(snapshot.assets.get(shotId!)).toMatchObject({ store: "assets", mimeType: "image/webp", byteLength: 3, width: 1600, height: 1000 });
    expect(snapshot.assets.get("video-bytes")).toMatchObject({ store: "videoAssets", mimeType: "video/webm" });
    expect(snapshot.assets.get("pdf-bytes")).toMatchObject({ store: "documentAssets", mimeType: "application/pdf", sha256: "pdf-hash" });
    expect(snapshot.documentText.get("doc-md")).toBe("# Plan\nShip it");
    expect(snapshot.documentText.get("doc-pdf")).toBe("Extracted PDF text");
  });

  test("writes a ZIP whose paths, text and bytes match the built pack", async () => {
    const link = await createLink({ url: URL, title: "Studio" });
    await addLinkScreenshotImage(link.id, URL, { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/webp", width: 10, height: 10 });
    await seedDocuments();
    const snapshot = await readContextPackSnapshot([link.id, "doc-md", "video"]);
    // fake-indexeddb does not round-trip Blobs; browsers return the stored Blob, so restore one here.
    snapshot.sources.set("video-bytes", new NodeBlob([new Uint8Array([7, 8, 9])], { type: "video/webm" }) as unknown as Blob);
    const pack = contextPackFromSnapshot(snapshot, { name: "My pack", source: SOURCE, includeFiles: true, exportedAt: NOW });
    const progress: number[] = [];
    const zip = await writeContextPackArchive(pack, snapshot, { onProgress: (step) => progress.push(step.completed ?? -1) });

    const { files, text } = await unzip(zip);
    expect([...files.keys()]).toEqual(pack.files.map((file) => file.path));
    expect(contextPackFileName(pack)).toBe("my-pack.zip");
    expect(await text("my-pack/items/002-plan.md")).toContain("### Plan");
    expect(JSON.parse((await text("my-pack/manifest.json"))!)).toEqual(pack.manifest);
    expect(Array.from(files.get("my-pack/files/001-studio-screenshot-1.webp")!)).toEqual([1, 2, 3]);
    expect(Array.from(files.get("my-pack/files/003-walkthrough.webm")!)).toEqual([7, 8, 9]);
    expect(progress.at(-1)).toBe(pack.files.length);
  });

  test("a text-only pack contains no binary files", async () => {
    const link = await createLink({ url: URL, title: "Studio" });
    await addLinkScreenshotImage(link.id, URL, { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/webp", width: 10, height: 10 });
    const snapshot = await readContextPackSnapshot([link.id]);
    const pack = contextPackFromSnapshot(snapshot, { name: "Text", source: SOURCE, includeFiles: false, exportedAt: NOW });
    const { files } = await unzip(await writeContextPackArchive(pack, snapshot));
    expect([...files.keys()]).toEqual(["text/README.md", "text/index.md", "text/manifest.json", "text/items/001-studio.md"]);
  });

  test("cancelling stops before writing", async () => {
    const note = await createNote({ content: "x" });
    const snapshot = await readContextPackSnapshot([note.id]);
    const pack = contextPackFromSnapshot(snapshot, { name: "x", source: SOURCE, includeFiles: true, exportedAt: NOW });
    const controller = new AbortController();
    controller.abort();
    await expect(writeContextPackArchive(pack, snapshot, { signal: controller.signal })).rejects.toThrow();
    await expect(readContextPackSnapshot([note.id], { signal: controller.signal })).rejects.toThrow();
  });
});
