import { describe, expect, test } from "vitest";
import {
  applyLinkEdit,
  applyLinkPreviewResult,
  applyLinkPreviewRetry,
  buildLink,
  coerceLinkPreviewFields,
  EMPTY_LINK_PREVIEW,
  LINK_PREVIEW_PENDING_LEASE_MS,
  linkListTitle,
  linkNeedsPreviewRetry,
  LinkValidationError,
  markLinkPreviewPending,
} from "./link";

describe("buildLink", () => {
  test("creates a link with a trimmed http URL", () => {
    const link = buildLink(
      { url: "  https://example.com/x  " },
      { id: "link-1", now: 1000 },
    );

    expect(link).toEqual({
      id: "link-1",
      type: "link",
      title: "",
      url: "https://example.com/x",
      ...EMPTY_LINK_PREVIEW,
      tagIds: [],
      collectionIds: [],
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  test("rejects javascript URLs", () => {
    expect(() => buildLink({ url: "javascript:alert(1)" })).toThrow(
      LinkValidationError,
    );
  });
});

describe("applyLinkEdit", () => {
  test("keeps id and createdAt and updates url", () => {
    const link = buildLink(
      { url: "https://example.com/old" },
      { id: "l1", now: 1000 },
    );

    expect(
      applyLinkEdit(link, { url: "  https://example.com/new  " }, { now: 2000 }),
    ).toEqual({
      ...link,
      url: "https://example.com/new",
      ...EMPTY_LINK_PREVIEW,
      updatedAt: 2000,
    });
  });

  test("clears preview when the URL changes", () => {
    const link = {
      ...buildLink({ url: "https://example.com/old" }, { id: "l1", now: 1 }),
      previewStatus: "ready" as const,
      previewTitle: "Old",
      previewImageUrl: "https://cdn.example.com/a.png",
      previewRetry: "none" as const,
    };

    const next = applyLinkEdit(link, { url: "https://example.com/new" });
    expect(next.previewStatus).toBe("idle");
    expect(next.previewTitle).toBe("");
    expect(next.previewImageUrl).toBe("");
    expect(next.previewAssetId).toBeNull();
    expect(next.previewRetry).toBeNull();
  });

  test("rejects javascript URLs", () => {
    const link = buildLink({ url: "https://example.com" }, { id: "l1", now: 1 });
    expect(() => applyLinkEdit(link, { url: "javascript:alert(1)" })).toThrow(
      LinkValidationError,
    );
  });
});

describe("linkListTitle", () => {
  test("uses the hostname when the title is empty", () => {
    const link = buildLink(
      { url: "https://example.com/path" },
      { id: "l1", now: 1 },
    );
    expect(linkListTitle(link)).toBe("example.com");
  });

  test("prefers previewTitle when user title is empty", () => {
    const link = {
      ...buildLink({ url: "https://example.com" }, { id: "l1", now: 1 }),
      previewTitle: "From OG",
    };
    expect(linkListTitle(link)).toBe("From OG");
  });

  test("prefers user title over previewTitle", () => {
    const link = {
      ...buildLink(
        { title: "Mine", url: "https://example.com" },
        { id: "l1", now: 1 },
      ),
      previewTitle: "From OG",
    };
    expect(linkListTitle(link)).toBe("Mine");
  });
});

describe("link preview state helpers", () => {
  test("marks pending and applies ready or failed results", () => {
    const link = {
      ...buildLink({ url: "https://example.com" }, { id: "l1", now: 1 }),
      previewAssetId: "asset-old",
    };
    const pending = markLinkPreviewPending(link, { now: 2 });
    expect(pending.previewStatus).toBe("pending");
    expect(pending.previewAttemptedAt).toBe(2);
    expect(pending.previewRetry).toBeNull();

    const ready = applyLinkPreviewResult(
      pending,
      {
        status: "ready",
        title: "Hello",
        description: "World",
        imageUrl: "https://cdn.example.com/i.png",
      },
      { now: 3 },
    );
    expect(ready.previewStatus).toBe("ready");
    expect(ready.previewTitle).toBe("Hello");
    expect(ready.previewImageUrl).toBe("https://cdn.example.com/i.png");
    expect(ready.previewAssetId).toBeNull();
    expect(ready.previewRetry).toBe("network");

    const failed = applyLinkPreviewResult(
      pending,
      { status: "failed" },
      { now: 4 },
    );
    expect(failed.previewStatus).toBe("failed");
    expect(failed.previewRetry).toBe("network");
  });

  test("coerce fills missing retry fields on older rows", () => {
    expect(
      coerceLinkPreviewFields({
        previewStatus: "failed",
        previewTitle: "t",
      }),
    ).toEqual({
      previewStatus: "failed",
      previewTitle: "t",
      previewDescription: "",
      previewImageUrl: "",
      previewAssetId: null,
      previewRetry: null,
      previewAttemptedAt: null,
    });
  });

  test("linkNeedsPreviewRetry honors network, none, failed, and dead pending", () => {
    const base = buildLink({ url: "https://example.com" }, { id: "l1", now: 1 });

    expect(
      linkNeedsPreviewRetry({ ...base, previewRetry: "network" }, 100),
    ).toBe(true);
    expect(linkNeedsPreviewRetry({ ...base, previewRetry: "none" }, 100)).toBe(
      false,
    );
    expect(
      linkNeedsPreviewRetry({ ...base, previewStatus: "failed" }, 100),
    ).toBe(true);

    const freshPending = markLinkPreviewPending(base, { now: 1000 });
    expect(linkNeedsPreviewRetry(freshPending, 1000 + 1_000)).toBe(false);
    expect(
      linkNeedsPreviewRetry(
        freshPending,
        1000 + LINK_PREVIEW_PENDING_LEASE_MS,
      ),
    ).toBe(true);

    expect(
      linkNeedsPreviewRetry(
        applyLinkPreviewRetry(base, "none", { now: 5 }),
        9999,
      ),
    ).toBe(false);
  });
});
