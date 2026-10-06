import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { assertPdfBytes, DocumentValidationError } from "@/domain/document";

const MAX_PAGES = 1_000;
const MAX_TEXT_CHARACTERS = 5_000_000;

export function pdfErrorMessage(error: unknown): string {
  if (error instanceof DocumentValidationError) return error.message;
  if (error instanceof Error && error.name === "PasswordException") {
    return "This PDF needs a password. Add an unlocked copy instead.";
  }
  return "Couldn't read this PDF. Choose another file or export it again.";
}

/** Local bytes only. No PDF scripting, forms, attachments, or link actions are executed. */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentLoadingTask> {
  assertPdfBytes(bytes);
  const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const base = typeof Worker === "undefined" || typeof location === "undefined" ? undefined : new URL(`/pdfjs/${pdf.version}/`, location.href).href;
  if (base) pdf.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.mjs`;
  return pdf.getDocument({
    // PDF.js transfers ownership; never detach the saved original.
    data: new Uint8Array(bytes),
    cMapUrl: base && `${base}cmaps/`, cMapPacked: true,
    standardFontDataUrl: base && `${base}standard_fonts/`, wasmUrl: base && `${base}wasm/`,
    useSystemFonts: true, enableXfa: false,
    maxImageSize: 16_000_000, canvasMaxAreaInBytes: 64_000_000,
    verbosity: pdf.VerbosityLevel.ERRORS,
  });
}

export async function readPdfText(bytes: Uint8Array): Promise<string> {
  let task: PDFDocumentLoadingTask | undefined;
  try {
    task = await openPdf(bytes);
    const document = await task.promise;
    if (document.numPages > MAX_PAGES) throw new DocumentValidationError("PDFs must have 1,000 pages or fewer.");
    const pages: string[] = [];
    let length = 0;
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      length += text.length;
      if (length > MAX_TEXT_CHARACTERS) throw new DocumentValidationError("This PDF has too much text to import. Split it into smaller files.");
      pages.push(text);
      page.cleanup();
    }
    return pages.join("\n\n").trim();
  } catch (error) {
    throw new DocumentValidationError(pdfErrorMessage(error));
  } finally {
    await task?.destroy();
  }
}
