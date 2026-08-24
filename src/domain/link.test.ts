import { describe, expect, test } from "vitest";
import {
  applyLinkEdit,
  applyLinkPreviewResult,
  buildLink,
  EMPTY_LINK_PREVIEW,
  linkListTitle,
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
    };

    const next = applyLinkEdit(link, { url: "https://example.com/new" });
    expect(next.previewStatus).toBe("idle");
    expect(next.previewTitle).toBe("");
    expect(next.previewImageUrl).toBe("");
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
    const link = buildLink({ url: "https://example.com" }, { id: "l1", now: 1 });
    const pending = markLinkPreviewPending(link, { now: 2 });
    expect(pending.previewStatus).toBe("pending");

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

    const failed = applyLinkPreviewResult(pending, { status: "failed" }, { now: 4 });
    expect(failed.previewStatus).toBe("failed");
  });
});
