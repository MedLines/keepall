import { expect, test } from "vitest";
import { classifyCaptureFile } from "./capture-file";

test("detects text extensions regardless of missing or generic MIME metadata", () => {
  expect(classifyCaptureFile({ name: "Plan.MD", type: "application/octet-stream" })).toMatchObject({ kind: "document" });
  expect(classifyCaptureFile({ name: "Notes.TXT", type: "" })).toMatchObject({ kind: "document" });
});

test("recognizes media with MIME metadata or known extensions and rejects future formats", () => {
  expect(classifyCaptureFile({ name: "clipboard", type: "image/png" })).toMatchObject({ kind: "image" });
  expect(classifyCaptureFile({ name: "Photo.JPG", type: "" })).toEqual({ kind: "image", mimeType: "image/jpeg" });
  expect(classifyCaptureFile({ name: "Clip.WEBM", type: "application/octet-stream" })).toEqual({ kind: "video", mimeType: "video/webm" });
  for (const name of ["file.pdf", "file.html", "file.svg", "file.txt.exe"]) {
    expect(classifyCaptureFile({ name, type: "" }).kind).toBe("unsupported");
  }
});
