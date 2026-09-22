import { describe, expect, test } from "vitest";
import {
  imageItemHref,
  itemPageHref,
  safeLibraryReturnHref,
} from "./item-page-navigation";

describe("image item navigation", () => {
  test("keeps the current library filters in the item-page return URL", () => {
    expect(
      imageItemHref(
        "image/one",
        "/?collection=design&layout=list",
      ),
    ).toBe(
      "/items/image%2Fone?from=%2F%3Fcollection%3Ddesign%26layout%3Dlist",
    );
  });

  test("uses the same item route for notes", () => {
    expect(itemPageHref("note/one", "/?tag=ideas")).toBe("/items/note%2Fone?from=%2F%3Ftag%3Dideas");
  });

  test("accepts only local Library return URLs", () => {
    expect(safeLibraryReturnHref("/?tag=ideas")).toBe("/?tag=ideas");
    expect(safeLibraryReturnHref("https://example.com")).toBe("/");
    expect(safeLibraryReturnHref("//example.com")).toBe("/");
    expect(safeLibraryReturnHref("/items/another")).toBe("/");
  });
});
