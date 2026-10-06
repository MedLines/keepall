import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { pdfFixture } from "../../test-support/pdf-fixture";
import { readPdfText } from "./pdf-document";

test("extracts real PDF text from every page without changing the original bytes", async () => {
  const bytes = pdfFixture(["First page", "Unicorn animation examples café"]);
  const original = new Uint8Array(bytes);
  const text = await readPdfText(bytes);
  expect(text).toContain("First page");
  expect(text).toContain("Unicorn animation examples café");
  expect(bytes).toEqual(original);
});

test("accepts a PDF with no selectable text and rejects an invalid PDF structure", async () => {
  expect(await readPdfText(pdfFixture([""]))).toBe("");
  await expect(readPdfText(new TextEncoder().encode("%PDF-1.7\nnot a document\n%%EOF"))).rejects.toThrow(/PDF/);
});

test("password-protected PDFs explain how to import an unlocked copy", async () => {
  const bytes = new Uint8Array(await readFile("test-support/password-protected.pdf"));
  await expect(readPdfText(bytes)).rejects.toThrow("This PDF needs a password. Add an unlocked copy instead.");
});

test("rejects PDFs beyond the page limit before extracting their content", async () => {
  await expect(readPdfText(pdfFixture(Array(1_001).fill("")))).rejects.toThrow("PDFs must have 1,000 pages or fewer.");
});
