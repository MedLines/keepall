import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DocumentItem } from "@/domain/document";
import { PdfCardThumbnail } from "./pdf-card-thumbnail";

const thumbnail = vi.hoisted(() => ({ get: vi.fn(), peek: vi.fn() }));
vi.mock("@/persistence/pdf-thumbnail", () => ({ getPdfThumbnail: thumbnail.get, peekPdfThumbnail: thumbnail.peek }));
const item: DocumentItem = { id: "paper", type: "document", format: "pdf", assetId: "paper-asset", title: "Paper", sourceFileName: "paper.pdf", noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
let finish: (image: string | null) => void;
beforeEach(() => {
  thumbnail.peek.mockReturnValue(null);
  thumbnail.get.mockReturnValue(new Promise<string | null>(resolve => { finish = resolve; }));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe() { this.callback([{ isIntersecting: true }] as IntersectionObserverEntry[], this as unknown as IntersectionObserver); }
    disconnect() {}
  });
});
afterEach(() => vi.unstubAllGlobals());

test("keeps white paper behind a cold PDF without an intermediate loading icon", async () => {
  const { container } = render(<PdfCardThumbnail item={item} compact />);
  const paper = container.querySelector("[data-pdf-preview]");
  expect(paper).toHaveClass("bg-white");
  expect(container.querySelector("svg")).toBeNull();
  expect(screen.getByText("Loading preview…")).toHaveClass("sr-only");
  await act(async () => finish("data:image/png,cold-paper"));
  const image = screen.getByRole("img", { name: "First page of Paper" });
  expect(image).toHaveAttribute("data-ready", "false");
  fireEvent.load(image);
  expect(image).toHaveAttribute("data-ready", "true");
  expect(paper).toHaveClass("bg-white");
});

test("returning to a warm PDF skips both its loading placeholder and thumbnail fade", () => {
  thumbnail.peek.mockReturnValue("data:image/png,warm-paper");
  const first = render(<PdfCardThumbnail item={item} compact />);
  fireEvent.load(screen.getByRole("img", { name: "First page of Paper" }));
  first.unmount();
  render(<PdfCardThumbnail item={item} compact />);
  expect(screen.queryByText("Loading preview…")).toBeNull();
  expect(screen.getByRole("img", { name: "First page of Paper" })).toHaveAttribute("data-ready", "true");
});
