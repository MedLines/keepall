import { describe, expect, test } from "vitest";
import { MAX_LOCAL_IMAGE_BYTES } from "./image";
import {
  classifyImageFolderFile,
  imageTitleFromFileName,
  inferImageFolderMimeType,
  suggestImageFolderCollectionName,
} from "./image-folder-import";

describe("classifyImageFolderFile", () => {
  test("accepts a small PNG", () => {
    expect(classifyImageFolderFile("photo.png", 100, "image/png")).toEqual({
      kind: "import",
      mimeType: "image/png",
    });
  });

  test("skips oversize and invalid files", () => {
    const oversize = classifyImageFolderFile(
      "big.jpg",
      MAX_LOCAL_IMAGE_BYTES + 1,
      "image/jpeg",
    );
    expect(oversize.kind === "skip" && oversize.reason).toBe("oversize");
    const invalid = classifyImageFolderFile("notes.txt", 12, "text/plain");
    expect(invalid.kind === "skip" && invalid.reason).toBe("invalid-mime");
  });

  test("infers mime from extension when the browser omits type", () => {
    expect(inferImageFolderMimeType("shots/scan.webp", "")).toBe("image/webp");
    expect(classifyImageFolderFile("scan.webp", 50, "")).toEqual({
      kind: "import",
      mimeType: "image/webp",
    });
  });
});

describe("imageTitleFromFileName", () => {
  test("strips folders and extensions", () => {
    expect(imageTitleFromFileName("vacation/img-001.JPG")).toBe("img-001");
  });
});

describe("suggestImageFolderCollectionName", () => {
  test("uses the top-level folder segment", () => {
    expect(
      suggestImageFolderCollectionName([
        { webkitRelativePath: "Vacation 2024/IMG_001.jpg", name: "IMG_001.jpg" },
      ]),
    ).toBe("Vacation 2024");
  });
});
