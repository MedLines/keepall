import { describe, expect, test } from "vitest";
import { normalizeItem } from "./item";
import { applyLinkEdit, buildLink, type LinkItem } from "./link";
import {
  addLinkScreenshot,
  coerceLinkScreenshotFields,
  linkCoverAssetId,
  linkScreenshotAssetIds,
  LinkScreenshotError,
  MAX_LINK_SCREENSHOTS,
  removeLinkScreenshot,
  setLinkCover,
  type LinkScreenshot,
} from "./link-screenshot";

const shot = (assetId: string): LinkScreenshot => ({ assetId, capturedAt: 10, width: 1600, height: 1000 });
const link = (fields: Partial<LinkItem> = {}): LinkItem => ({
  ...buildLink({ url: "https://studio.example/work" }, { id: "link-1", now: 1 }),
  ...fields,
});

describe("coerceLinkScreenshotFields", () => {
  test("leaves rows without screenshot fields untouched", () => {
    const row = link();
    expect(coerceLinkScreenshotFields(row)).toBe(row);
    expect(normalizeItem(row)).not.toHaveProperty("screenshots");
  });

  test("drops malformed and duplicate screenshots", () => {
    const row = link({
      screenshots: [
        shot("a"),
        shot("a"),
        { assetId: "", capturedAt: 1, width: 10, height: 10 },
        { assetId: "b", capturedAt: 1, width: 0, height: 10 },
        { assetId: "c", capturedAt: 1, width: 10.5, height: 10 },
        "nope",
        shot("d"),
      ] as unknown as LinkScreenshot[],
    });
    expect(linkScreenshotAssetIds(coerceLinkScreenshotFields(row))).toEqual(["a", "d"]);
  });

  test("removes the field when nothing valid remains", () => {
    const coerced = coerceLinkScreenshotFields(link({ screenshots: [] }));
    expect(coerced).not.toHaveProperty("screenshots");
  });

  test("clears a cover that is neither the preview nor a screenshot", () => {
    expect(coerceLinkScreenshotFields(link({ screenshots: [shot("a")], coverAssetId: "gone" })))
      .not.toHaveProperty("coverAssetId");
    expect(coerceLinkScreenshotFields(link({ previewAssetId: "p", coverAssetId: "p" })).coverAssetId).toBe("p");
    expect(normalizeItem(link({ screenshots: [shot("a")], coverAssetId: "a" }))).toMatchObject({ coverAssetId: "a" });
  });
});

describe("linkCoverAssetId", () => {
  test("prefers the chosen cover, then the preview, then the first screenshot", () => {
    expect(linkCoverAssetId(link())).toBeNull();
    expect(linkCoverAssetId(link({ screenshots: [shot("a"), shot("b")] }))).toBe("a");
    expect(linkCoverAssetId(link({ previewAssetId: "p", screenshots: [shot("a")] }))).toBe("p");
    expect(linkCoverAssetId(link({ previewAssetId: "p", screenshots: [shot("a"), shot("b")], coverAssetId: "b" }))).toBe("b");
  });

  test("ignores a stale cover choice", () => {
    expect(linkCoverAssetId(link({ previewAssetId: "p", coverAssetId: "old" }))).toBe("p");
  });
});

describe("screenshot edits", () => {
  test("addLinkScreenshot appends in order and ignores the same asset twice", () => {
    const once = addLinkScreenshot(link(), shot("a"), { now: 5 });
    const twice = addLinkScreenshot(once, shot("b"), { now: 6 });
    expect(linkScreenshotAssetIds(twice)).toEqual(["a", "b"]);
    expect(twice.updatedAt).toBe(6);
    expect(addLinkScreenshot(twice, shot("a"), { now: 7 })).toBe(twice);
  });

  test("addLinkScreenshot enforces the limit and validates input", () => {
    let full = link();
    for (let index = 0; index < MAX_LINK_SCREENSHOTS; index += 1) full = addLinkScreenshot(full, shot(`s${index}`));
    expect(() => addLinkScreenshot(full, shot("extra"))).toThrow(LinkScreenshotError);
    expect(addLinkScreenshot(full, shot("s0"))).toBe(full);
    expect(() => addLinkScreenshot(link(), { ...shot("a"), width: -1 })).toThrow(LinkScreenshotError);
  });

  test("removeLinkScreenshot drops the shot and a cover that pointed at it", () => {
    const row = link({ screenshots: [shot("a"), shot("b")], coverAssetId: "a" });
    const next = removeLinkScreenshot(row, "a", { now: 9 });
    expect(linkScreenshotAssetIds(next)).toEqual(["b"]);
    expect(next).not.toHaveProperty("coverAssetId");
    expect(removeLinkScreenshot(next, "missing")).toBe(next);
    expect(removeLinkScreenshot(next, "b")).not.toHaveProperty("screenshots");
  });

  test("removeLinkScreenshot keeps a cover on another asset", () => {
    const row = link({ previewAssetId: "p", screenshots: [shot("a")], coverAssetId: "p" });
    expect(removeLinkScreenshot(row, "a").coverAssetId).toBe("p");
  });

  test("setLinkCover accepts the preview or a screenshot and null restores automatic", () => {
    const row = link({ previewAssetId: "p", screenshots: [shot("a")] });
    expect(setLinkCover(row, "a", { now: 3 })).toMatchObject({ coverAssetId: "a", updatedAt: 3 });
    expect(setLinkCover(row, "p").coverAssetId).toBe("p");
    expect(setLinkCover({ ...row, coverAssetId: "a" }, null)).not.toHaveProperty("coverAssetId");
    expect(() => setLinkCover(row, "other")).toThrow(LinkScreenshotError);
  });
});

describe("applyLinkEdit", () => {
  test("a new URL drops screenshots and the cover choice", () => {
    const row = link({ screenshots: [shot("a")], coverAssetId: "a" });
    const edited = applyLinkEdit(row, { url: "https://other.example/" }, { now: 2 });
    expect(edited).not.toHaveProperty("screenshots");
    expect(edited).not.toHaveProperty("coverAssetId");
  });

  test("keeping the URL keeps screenshots", () => {
    const row = link({ screenshots: [shot("a")], coverAssetId: "a" });
    expect(applyLinkEdit(row, { url: row.url, title: "Renamed" }, { now: 2 })).toMatchObject({
      screenshots: [shot("a")],
      coverAssetId: "a",
    });
  });
});
