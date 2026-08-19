import { describe, expect, test } from "vitest";
import { classifyCapture, resolveCapture } from "./classify";

describe("classifyCapture", () => {
  test("treats http and https URLs as links", () => {
    expect(classifyCapture("  https://example.com/path  ")).toEqual({
      type: "link",
      url: "https://example.com/path",
    });
    expect(classifyCapture("http://example.com")).toEqual({
      type: "link",
      url: "http://example.com",
    });
  });

  test("treats javascript: and bare hosts as notes", () => {
    expect(classifyCapture("javascript:alert(1)")).toEqual({
      type: "note",
      content: "javascript:alert(1)",
    });
    expect(classifyCapture("www.example.com")).toEqual({
      type: "note",
      content: "www.example.com",
    });
  });

  test("treats ordinary text as a note", () => {
    expect(classifyCapture("  soft side light  ")).toEqual({
      type: "note",
      content: "soft side light",
    });
  });
});

describe("resolveCapture", () => {
  test("rejects empty input", () => {
    expect(resolveCapture("   ", null)).toEqual({
      ok: false,
      error: "Enter a link or note",
    });
  });

  test("honors a note override on a URL", () => {
    expect(resolveCapture("https://example.com", "note")).toEqual({
      ok: true,
      classification: {
        type: "note",
        content: "https://example.com",
      },
    });
  });

  test("rejects a link override when the text is not an http URL", () => {
    expect(resolveCapture("just a thought", "link")).toEqual({
      ok: false,
      error: "Enter an http or https URL",
    });
  });
});
