import { expect, test } from "vitest";
import { assertPdfBytes, decodeTextDocument, documentFormat, MAX_PDF_DOCUMENT_BYTES, MAX_TEXT_DOCUMENT_BYTES } from "./document";

const encode = (text: string) => new TextEncoder().encode(text);

test("uses the filename to recognize plain text and Markdown", () => {
  expect(documentFormat("notes.TXT", 2)).toBe("text");
  expect(documentFormat("readme.MD", 2)).toBe("markdown");
  expect(() => documentFormat("page.html", 2)).toThrow(/txt.*md/i);
  expect(() => documentFormat("../notes.txt", 2)).toThrow(/filename/i);
  expect(() => documentFormat("large.md", MAX_TEXT_DOCUMENT_BYTES + 1)).toThrow(/10 MiB/);
});

test("decodes UTF-8, preserves whitespace, strips only the display BOM, and accepts empty files", () => {
  expect(decodeTextDocument(encode("\uFEFF# مرحبا\r\n  café\n"))).toBe("# مرحبا\r\n  café\n");
  expect(decodeTextDocument(new Uint8Array())).toBe("");
});

test("rejects invalid UTF-8 and binary control characters instead of silently replacing bytes", () => {
  expect(() => decodeTextDocument(new Uint8Array([0xff, 0xfe, 65, 0]))).toThrow(/UTF-8/);
  expect(() => decodeTextDocument(encode("MZ\u0000binary"))).toThrow(/binary/i);
  expect(() => decodeTextDocument(encode("abc\u0007def"))).toThrow(/binary/i);
});

test("recognizes PDFs and applies their own size and signature checks", () => {
  expect(documentFormat("Reference.PDF", 20 * 1024 * 1024)).toBe("pdf");
  expect(() => documentFormat("large.pdf", MAX_PDF_DOCUMENT_BYTES + 1)).toThrow(/50 MiB/);
  expect(() => documentFormat("large.txt", MAX_TEXT_DOCUMENT_BYTES + 1)).toThrow(/10 MiB/);
  expect(() => assertPdfBytes(encode("%PDF-1.7\ncontent\n%%EOF\n"))).not.toThrow();
  expect(() => assertPdfBytes(encode("Not a PDF\n%%EOF"))).toThrow(/PDF/);
  expect(() => assertPdfBytes(encode("%PDF-1.7\nunfinished"))).toThrow(/PDF/);
});
