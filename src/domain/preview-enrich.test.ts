import { describe, expect, test } from "vitest";
import { buildLink } from "./link";
import { linkNeedsPreviewEnrich } from "./preview-enrich";

describe("linkNeedsPreviewEnrich", () => {
  test("is true for idle links", () => {
    const link = buildLink({ url: "https://example.com" }, { id: "l1", now: 1 });
    expect(linkNeedsPreviewEnrich(link)).toBe(true);
  });

  test("is false once enrich has started or finished", () => {
    const link = buildLink({ url: "https://example.com" }, { id: "l1", now: 1 });
    expect(linkNeedsPreviewEnrich({ ...link, previewStatus: "pending" })).toBe(
      false,
    );
    expect(linkNeedsPreviewEnrich({ ...link, previewStatus: "ready" })).toBe(
      false,
    );
    expect(linkNeedsPreviewEnrich({ ...link, previewStatus: "failed" })).toBe(
      false,
    );
  });
});
