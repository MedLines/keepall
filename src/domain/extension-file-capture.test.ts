import { expect, test } from "vitest";
import { validateFileManifest, MAX_TRANSFER_BYTES } from "./extension-file-capture";
const manifest = () => ({ manifestId: crypto.randomUUID(), itemIds: [crypto.randomUUID()], files: [{ name: "a.txt", type: "text/plain", size: 1 }], imageMode: "separate", organization: {} });
test("validates UUIDs, counts, enums, strings and per-file limits before transfer", () => {
  const valid = manifest();
  expect(validateFileManifest(valid)).toEqual(valid);
  for (const change of [{ manifestId: "wrong" }, { itemIds: [] }, { imageMode: "other" }, { files: [] }, { files: [{ name: "x.txt", type: "text/plain", size: MAX_TRANSFER_BYTES }] }, { organization: { tagIds: [""] } }, { metadata: { noteFormat: "html" } }]) expect(() => validateFileManifest({ ...valid, ...change })).toThrow();
});
test("gallery is image-only and has exactly one stable output ID", () => {
  expect(() => validateFileManifest({ ...manifest(), imageMode: "gallery" })).toThrow("images");
});
