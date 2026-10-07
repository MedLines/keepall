import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { PdfPage } from "./pdf-page";

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  AnnotationMode: { DISABLE: 0 },
  TextLayer: class {
    constructor(private options: { container: HTMLElement; textContentSource: string }) {}
    render() { this.options.container.textContent = this.options.textContentSource; return Promise.resolve(); }
    cancel() {}
  },
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function documentFixture() {
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) { this.callback([{ target, contentRect: { width: 614 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
  });
  const pending: { canvas: HTMLCanvasElement; finish: () => void; fail: () => void; cancel: ReturnType<typeof vi.fn> }[] = [];
  const document = {
    getPage: vi.fn(async (number: number) => ({
      getViewport: () => ({ width: 612, height: 792, scale: 1, userUnit: 1 }),
      streamTextContent: () => `Chapter ${number}`,
      render: ({ canvas }: { canvas: HTMLCanvasElement }) => {
        let finish!: () => void;
        let fail!: () => void;
        const promise = new Promise<void>((resolve, reject) => { finish = resolve; fail = () => reject(new Error("Interrupted paint")); });
        const cancel = vi.fn();
        pending.push({ canvas, finish, fail, cancel });
        return { promise, cancel };
      },
      cleanup: vi.fn(),
    } as unknown as PDFPageProxy)),
  } as unknown as PDFDocumentProxy;
  return { document, pending };
}

test("keeps the painted page and selectable text visible until the replacement finishes", async () => {
  const { document, pending } = documentFixture();
  const { rerender } = render(<PdfPage document={document} number={1} zoom="fit" />);
  expect(screen.getByRole("status", { name: "Loading PDF" })).toBeInTheDocument();
  await waitFor(() => expect(pending).toHaveLength(1));
  await act(async () => pending[0].finish());
  expect(screen.queryByRole("status", { name: "Loading PDF" })).not.toBeInTheDocument();
  const previous = screen.getByRole("img", { name: "PDF page 1" });
  const resets = vi.spyOn(HTMLCanvasElement.prototype, "width", "set");
  rerender(<PdfPage document={document} number={2} zoom="fit" />);
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(screen.queryByRole("status", { name: "Loading PDF" })).not.toBeInTheDocument();
  expect(previous).toBeVisible();
  expect(screen.getByText("Chapter 1")).toBeVisible();
  expect(resets.mock.contexts).not.toContain(previous);
  await act(async () => pending[1].finish());
  expect(screen.getByRole("img", { name: "PDF page 2" })).toBeVisible();
  expect(screen.getByText("Chapter 2")).toBeVisible();
  expect(screen.queryByRole("img", { name: "PDF page 1" })).not.toBeInTheDocument();
});

test("virtual scroll pages do not repaint when their reserved size object is recreated", async () => {
  const { document, pending } = documentFixture();
  const { rerender } = render(<PdfPage document={document} number={1} zoom="fit" viewportSize={{ width: 612, height: 792 }} />);
  await waitFor(() => expect(pending).toHaveLength(1));
  await act(async () => pending[0].finish());
  expect(screen.getByRole("img", { name: "PDF page 1" }).parentElement).not.toHaveClass("pdf-page-first-reveal");
  rerender(<PdfPage document={document} number={1} zoom="fit" viewportSize={{ width: 612, height: 792 }} />);
  expect(document.getPage).toHaveBeenCalledTimes(1);
});

test("rapid page changes cancel unfinished paints and cannot replace the newest page", async () => {
  const { document, pending } = documentFixture();
  const { rerender, unmount } = render(<PdfPage document={document} number={1} zoom="fit" />);
  await waitFor(() => expect(pending).toHaveLength(1));
  await act(async () => pending[0].finish());
  rerender(<PdfPage document={document} number={2} zoom="fit" />);
  await waitFor(() => expect(pending).toHaveLength(2));
  rerender(<PdfPage document={document} number={3} zoom="fit" />);
  await waitFor(() => expect(pending).toHaveLength(3));
  expect(pending[1].cancel).toHaveBeenCalledOnce();
  await act(async () => pending[2].finish());
  await act(async () => pending[1].finish());
  expect(screen.getByRole("img", { name: "PDF page 3" })).toBeVisible();
  expect(screen.getByText("Chapter 3")).toBeVisible();
  expect(screen.queryByText("Chapter 2")).not.toBeInTheDocument();
  unmount();
  expect(pending[2].cancel).toHaveBeenCalledOnce();
});

test("failed replacement paints keep the last readable page and release their buffer before retry", async () => {
  const { document, pending } = documentFixture();
  const { rerender } = render(<PdfPage document={document} number={1} zoom="fit" />);
  await waitFor(() => expect(pending).toHaveLength(1));
  await act(async () => pending[0].finish());
  rerender(<PdfPage document={document} number={2} zoom="fit" />);
  await waitFor(() => expect(pending).toHaveLength(2));
  await act(async () => pending[1].fail());
  expect(screen.getByRole("alert")).toHaveTextContent("Couldn't display this page");
  expect(screen.getByRole("img", { name: "PDF page 1" })).toBeVisible();
  expect(pending[1].canvas).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry page" }));
  await waitFor(() => expect(pending).toHaveLength(3));
  await act(async () => pending[2].finish());
  expect(screen.getByRole("img", { name: "PDF page 2" })).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
