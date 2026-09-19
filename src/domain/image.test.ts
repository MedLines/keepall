import { describe, expect, test } from "vitest";
import {
  appendImageAsset,
  assertLocalImageBytes,
  applyImageEdit,
  buildImage,
  buildImageFromAssetIds,
  clampImageSlideIndex,
  coerceImageFields,
  imageCoverAssetId,
  imageListTitle,
  ImageValidationError,
  MAX_LOCAL_IMAGE_BYTES,
  removeImageAssetAt,
  replaceImageAssetAt,
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
      assetIds: ["a1"],
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

describe("buildImageFromAssetIds", () => {
  test("creates one item with ordered assetIds", () => {
    const image = buildImageFromAssetIds(
      { assetIds: ["a1", "a2", "a3"] },
      { id: "i1", now: 1 },
    );
    expect(image.assetIds).toEqual(["a1", "a2", "a3"]);
  });
});

describe("coerceImageFields", () => {
  test("migrates legacy assetId to a one-item assetIds list", () => {
    expect(coerceImageFields({ assetId: "abc" }).assetIds).toEqual(["abc"]);
  });

  test("prefers assetIds when present", () => {
    expect(
      coerceImageFields({ assetId: "old", assetIds: ["a1", "a2"] }).assetIds,
    ).toEqual(["a1", "a2"]);
  });
});

describe("appendImageAsset", () => {
  test("adds at the end and leaves cover at index 0", () => {
    const image = buildImage({ assetId: "a1" }, { id: "i1", now: 1 });
    const next = appendImageAsset(image, "a2", { now: 2 });
    expect(next.assetIds).toEqual(["a1", "a2"]);
    expect(imageCoverAssetId(next)).toBe("a1");
    expect(next.updatedAt).toBe(2);
  });
});

describe("replaceImageAssetAt", () => {
  test("swaps one slide and keeps order", () => {
    const image = appendImageAsset(
      buildImage({ assetId: "a1" }, { id: "i1", now: 1 }),
      "a2",
    );
    const next = replaceImageAssetAt(image, 1, "a3", { now: 3 });
    expect(next.assetIds).toEqual(["a1", "a3"]);
    expect(next.updatedAt).toBe(3);
  });

  test("rejects out-of-range index", () => {
    const image = buildImage({ assetId: "a1" }, { id: "i1", now: 1 });
    expect(() => replaceImageAssetAt(image, 1, "a2")).toThrow(
      ImageValidationError,
    );
  });
});

describe("removeImageAssetAt", () => {
  test("removes one image and keeps the remaining order", () => {
    const image = buildImageFromAssetIds(
      { assetIds: ["a1", "a2", "a3"] },
      { id: "i1", now: 1 },
    );
    const next = removeImageAssetAt(image, 1, { now: 3 });
    expect(next.assetIds).toEqual(["a1", "a3"]);
    expect(next.updatedAt).toBe(3);
  });

  test("keeps at least one image in the item", () => {
    const image = buildImage({ assetId: "a1" }, { id: "i1", now: 1 });
    expect(() => removeImageAssetAt(image, 0)).toThrow(ImageValidationError);
  });
});

describe("clampImageSlideIndex", () => {
  test("clamps to valid range", () => {
    expect(clampImageSlideIndex(["a", "b", "c"], 99)).toBe(2);
    expect(clampImageSlideIndex(["a", "b", "c"], -1)).toBe(0);
    expect(clampImageSlideIndex([], 5)).toBe(0);
  });
});

describe("applyImageEdit", () => {
  test("adds, preserves and clears a title without changing file information", () => {
    const image = buildImage({ assetId: "a1", sourceFileName: "abc-123.png" });
    expect(image.title).toBe("");
    const titled = applyImageEdit(image, { title: "  Footer ideas  " });
    expect(titled.title).toBe("Footer ideas");
    expect(applyImageEdit(titled, { caption: "A reference" }).title).toBe("Footer ideas");
    const cleared = applyImageEdit(titled, { title: "   " });
    expect(cleared.title).toBe("");
    expect(cleared.sourceFileName).toBe("abc-123.png");
    expect(cleared.assetIds).toEqual(image.assetIds);
  });

  test("updates caption and sourceUrl without changing assetIds", () => {
    const image = buildImage(
      { assetId: "a1", caption: "old", sourceUrl: "https://a.com" },
      { id: "i1", now: 1 },
    );
    const next = applyImageEdit(
      image,
      { caption: "new", sourceUrl: "https://b.com" },
      { now: 2 },
    );
    expect(next.assetIds).toEqual(["a1"]);
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
