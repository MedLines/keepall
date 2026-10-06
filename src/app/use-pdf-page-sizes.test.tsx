import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { usePdfPageSizes } from "./use-pdf-page-sizes";

const page = () => ({ getViewport: () => ({ width: 595, height: 842 }), cleanup: vi.fn() }) as unknown as PDFPageProxy;

test("closing a long PDF stops queued geometry reads and cleans up in-flight pages", async () => {
  const pending: ((page: PDFPageProxy) => void)[] = [];
  const getPage = vi.fn(() => new Promise<PDFPageProxy>(resolve => pending.push(resolve)));
  const document = { numPages: 1_000, getPage } as unknown as PDFDocumentProxy;
  const { unmount } = renderHook(() => usePdfPageSizes(document));
  expect(getPage).toHaveBeenCalledTimes(8);
  unmount();
  const pages = pending.map(() => page());
  await act(async () => pending.forEach((resolve, index) => resolve(pages[index])));
  expect(getPage).toHaveBeenCalledTimes(8);
  for (const page of pages) expect(page.cleanup).toHaveBeenCalledOnce();
});

test("geometry failures can be retried without losing mixed page dimensions", async () => {
  const getPage = vi.fn(async (number: number) => ({ ...page(), getViewport: () => number === 1 ? { width: 595, height: 842 } : { width: 792, height: 612 } }));
  getPage.mockRejectedValueOnce(new Error("Interrupted read"));
  const document = { numPages: 2, getPage } as unknown as PDFDocumentProxy;
  const { result } = renderHook(() => usePdfPageSizes(document));
  await waitFor(() => expect(result.current.layout.status).toBe("error"));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.layout).toEqual({ status: "ready", sizes: [{ width: 595, height: 842 }, { width: 792, height: 612 }] }));
});
