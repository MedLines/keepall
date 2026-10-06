import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentAsset, DocumentItem } from "@/domain/document";
import { getDocumentOriginal } from "@/persistence/documents";
import { openPdf } from "@/persistence/pdf-document";
import { usePdfDocument } from "./use-pdf-document";

vi.mock("@/persistence/documents", () => ({ getDocumentOriginal: vi.fn() }));
vi.mock("@/persistence/pdf-document", () => ({ openPdf: vi.fn(), pdfErrorMessage: () => "Couldn't read this PDF." }));
afterEach(() => vi.resetAllMocks());
const item: DocumentItem = { id: "pdf", type: "document", format: "pdf", title: "Reference", sourceFileName: "reference.pdf", assetId: "original", noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
const original: DocumentAsset = { id: "original", bytes: new Uint8Array([1]), byteLength: 1, contentHash: "hash", createdAt: 1, pdfText: "" };

test("navigation ignores a late original read and destroys the active PDF worker on unmount", async () => {
  let finish!: (value: DocumentAsset) => void;
  vi.mocked(getDocumentOriginal).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(original);
  const document = { numPages: 2 } as PDFDocumentProxy;
  const destroy = vi.fn(async () => {});
  vi.mocked(openPdf).mockResolvedValue({ promise: Promise.resolve(document), destroy } as unknown as PDFDocumentLoadingTask);
  const { result, rerender, unmount } = renderHook(({ current }) => usePdfDocument(current), { initialProps: { current: item } });
  rerender({ current: { ...item, id: "next" } });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  await act(async () => finish(original));
  expect(openPdf).toHaveBeenCalledOnce();
  expect(result.current.state).toMatchObject({ document, noText: true });
  unmount();
  expect(destroy).toHaveBeenCalledOnce();
});

test("a PDF opened after dismissal is immediately destroyed", async () => {
  vi.mocked(getDocumentOriginal).mockResolvedValue(original);
  let finish!: (task: PDFDocumentLoadingTask) => void;
  vi.mocked(openPdf).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { unmount } = renderHook(() => usePdfDocument(item));
  await waitFor(() => expect(openPdf).toHaveBeenCalledOnce());
  unmount();
  const destroy = vi.fn(async () => {});
  await act(async () => finish({ destroy } as unknown as PDFDocumentLoadingTask));
  expect(destroy).toHaveBeenCalledOnce();
});

test("missing files show recovery copy and retry reads the restored original", async () => {
  vi.mocked(getDocumentOriginal).mockResolvedValueOnce(undefined).mockResolvedValueOnce(original);
  const destroy = vi.fn(async () => {});
  vi.mocked(openPdf).mockResolvedValue({ promise: Promise.resolve({ numPages: 1 }), destroy } as unknown as PDFDocumentLoadingTask);
  const { result } = renderHook(() => usePdfDocument(item));
  await waitFor(() => expect(result.current.state).toMatchObject({ status: "error", message: expect.stringContaining("missing") }));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
});
