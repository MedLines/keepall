import { describe, expect, test } from "vitest";
import { applyLinkEdit, buildLink, linkListTitle, LinkValidationError } from "./link";

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
      tagIds: [],
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
      updatedAt: 2000,
    });
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
});
