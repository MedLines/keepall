import { describe, expect, test } from "vitest";
import {
  assertLocalImageBytes,
  applyImageEdit,
  buildImage,
  imageListTitle,
  ImageValidationError,
  MAX_LOCAL_IMAGE_BYTES,
  textFieldsFromAccompanyingText,
} from "./image";

describe("textFieldsFromAccompanyingText", () => {
  test("maps http URL to sourceUrl and other text to caption", () => {
    expect(textFieldsFromAccompanyingText("https://example.com/x")).toEqual({
      sourceUrl: "https://example.com/x",
      caption: "",
    });
    expect(textFieldsFromAccompanyingText("  hello  ")).toEqual({
      sourceUrl: "",
      caption: "hello",
    });
    expect(textFieldsFromAccompanyingText("")).toEqual({
      sourceUrl: "",
      caption: "",
    });
  });
});

describe("buildImage", () => {
  test("requires assetId and accepts optional fields", () => {
    const image = buildImage(
      {
        assetId: "a1",
        sourceUrl: "https://example.com",
        caption: "UI still",
      },
      { id: "i1", now: 1 },
    );
    expect(image).toMatchObject({
      id: "i1",
      type: "image",
      assetId: "a1",
      sourceUrl: "https://example.com",
      caption: "UI still",
    });
  });

  test("rejects missing asset and bad sourceUrl", () => {
    expect(() => buildImage({ assetId: "" })).toThrow(ImageValidationError);
    expect(() =>
      buildImage({ assetId: "a1", sourceUrl: "javascript:alert(1)" }),
    ).toThrow(ImageValidationError);
  });
});

describe("assertLocalImageBytes", () => {
  test("rejects oversize and bad mime", () => {
    expect(() =>
      assertLocalImageBytes(new Uint8Array(1), "text/plain"),
    ).toThrow(ImageValidationError);
    expect(() =>
      assertLocalImageBytes(
        new Uint8Array(MAX_LOCAL_IMAGE_BYTES + 1),
        "image/png",
      ),
    ).toThrow(ImageValidationError);
  });
});

describe("imageListTitle", () => {
  test("falls back through title, caption, host, Image", () => {
    const base = buildImage({ assetId: "a1" }, { id: "i1", now: 1 });
    expect(imageListTitle(base)).toBe("Image");
    expect(imageListTitle({ ...base, caption: "Shot" })).toBe("Shot");
    expect(
      imageListTitle({ ...base, sourceUrl: "https://example.com/path" }),
    ).toBe("example.com");
  });
});

describe("applyImageEdit", () => {
  test("updates caption and sourceUrl without changing assetId", () => {
    const image = buildImage(
      { assetId: "a1", caption: "old", sourceUrl: "https://a.com" },
      { id: "i1", now: 1 },
    );
    const next = applyImageEdit(
      image,
      { caption: "new", sourceUrl: "https://b.com" },
      { now: 2 },
    );
    expect(next.assetId).toBe("a1");
    expect(next.caption).toBe("new");
    expect(next.sourceUrl).toBe("https://b.com");
    expect(next.updatedAt).toBe(2);
  });

  test("rejects non-http sourceUrl", () => {
    const image = buildImage({ assetId: "a1" }, { id: "i1", now: 1 });
    expect(() =>
      applyImageEdit(image, { sourceUrl: "javascript:alert(1)" }),
    ).toThrow(ImageValidationError);
  });
});
