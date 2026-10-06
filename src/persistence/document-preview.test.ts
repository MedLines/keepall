import { expect, test, vi } from "vitest";
import { createDocumentPreviewReader } from "./document-preview";
import type { DocumentAsset } from "@/domain/document";

const original = (text: string): DocumentAsset => ({ id: "asset", bytes: new TextEncoder().encode(text), byteLength: text.length, contentHash: "hash", createdAt: 1 });

test("shares bounded text previews without retaining whole originals", async () => {
  const read = vi.fn(async () => original("A".repeat(10000)));
  const preview = createDocumentPreviewReader(read, 2);
  expect(await preview("asset", "revision")).toHaveLength(1400);
  expect(await preview("asset", "revision")).toHaveLength(1400);
  expect(read).toHaveBeenCalledTimes(1);
});

test("refreshes after a restore and evicts old entries", async () => {
  const read = vi.fn(async () => original("Before"));
  const preview = createDocumentPreviewReader(read, 2);
  expect(await preview("asset", "one")).toBe("Before");
  read.mockResolvedValue(original("After"));
  expect(await preview("asset", "two")).toBe("After");
  await preview("other", "two");
  await preview("third", "two");
  await preview("asset", "two");
  expect(read).toHaveBeenCalledTimes(5);
});

test("missing files and failed reads can recover on the next attempt", async () => {
  const read = vi.fn<() => Promise<DocumentAsset | undefined>>().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Read failed")).mockResolvedValue(original("Recovered"));
  const preview = createDocumentPreviewReader(read);
  expect(await preview("asset", "one")).toBeNull();
  await expect(preview("asset", "one")).rejects.toThrow("Read failed");
  expect(await preview("asset", "one")).toBe("Recovered");
});
