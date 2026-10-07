import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { DocumentAsset, DocumentItem } from "@/domain/document";
import { DocumentContent } from "./document-content";
import { peekPdfThumbnail } from "@/persistence/pdf-thumbnail";
import { getDocumentOriginal } from "@/persistence/documents";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="pdf-live">Loading PDF…</div> }));
vi.mock("@/persistence/pdf-thumbnail", () => ({ peekPdfThumbnail: vi.fn() }));
vi.mock("@/persistence/documents", () => ({ getDocumentOriginal: vi.fn() }));

const item: DocumentItem = { id: "pdf", assetId: "pdf-asset", type: "document", format: "pdf", title: "Preview PDF", sourceFileName: "preview.pdf", noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };

test("keeps the first-page preview until the real first page has painted", async () => {
  render(<DocumentContent item={item} initialPreview={{ pdfImage: "data:image/png;base64,preview" }} />);
  expect(screen.getByRole("img", { name: "First page of Preview PDF" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "PDF page number" })).toBeDisabled();
  const live = screen.getByTestId("pdf-live");
  expect(live.parentElement).toHaveClass("invisible", "absolute");
  const page = document.createElement("div");
  live.append(page);
  page.setAttribute("data-pdf-ready", "2");
  expect(screen.getByRole("img", { name: "First page of Preview PDF" })).toBeVisible();
  page.setAttribute("data-pdf-ready", "1");
  await waitFor(() => expect(live.parentElement).toHaveClass("pdf-preview-reveal"));
  expect(document.querySelector("[data-pdf-opening-preview]")).not.toBeNull();
  fireEvent.animationEnd(live.parentElement!, { animationName: "pdf-preview-reveal" });
  await waitFor(() => expect(screen.queryByRole("img", { name: "First page of Preview PDF" })).toBeNull());
  expect(live.parentElement).not.toHaveClass("invisible", "absolute");
  page.remove();
  expect(screen.queryByRole("img", { name: "First page of Preview PDF" })).toBeNull();
});

test("replaces the PDF preview with recovery controls when rendering fails", async () => {
  render(<DocumentContent item={item} initialPreview={{ pdfImage: "data:image/png;base64,preview" }} />);
  const alert = document.createElement("div");
  alert.setAttribute("role", "alert");
  alert.textContent = "Couldn't read this PDF";
  screen.getByTestId("pdf-live").append(alert);
  await waitFor(() => expect(screen.queryByRole("img", { name: "First page of Preview PDF" })).toBeNull());
  expect(screen.getByTestId("pdf-live").parentElement).not.toHaveClass("invisible");
});

test("uses the already-rendered card cover when a PDF opens without a navigation snapshot", () => {
  vi.mocked(peekPdfThumbnail).mockReturnValueOnce("data:image/png;base64,cached");
  render(<DocumentContent item={item} />);
  expect(peekPdfThumbnail).toHaveBeenCalledWith(item.assetId);
  expect(screen.getByRole("img", { name: "First page of Preview PDF" })).toHaveAttribute("src", "data:image/png;base64,cached");
  expect(screen.getByTestId("pdf-live").parentElement).toHaveClass("invisible");
});

test("keeps a reading placeholder while a text file is pending, then displays its content", async () => {
  let finishRead!: (original: DocumentAsset) => void;
  vi.mocked(getDocumentOriginal).mockReturnValueOnce(new Promise(resolve => { finishRead = resolve; }));
  render(<DocumentContent item={{ ...item, format: "text", sourceFileName: "preview.txt" }} />);
  expect(screen.getByRole("status", { name: "Loading document" })).toBeInTheDocument();
  expect(screen.queryByText("Saved text from the original file.")).not.toBeInTheDocument();
  const bytes = new TextEncoder().encode("Saved text from the original file.");
  await act(async () => { finishRead({ id: item.assetId, bytes, byteLength: bytes.length, contentHash: "test", createdAt: 1 }); });
  expect(screen.getByText("Saved text from the original file.")).toBeInTheDocument();
  expect(screen.queryByRole("status", { name: "Loading document" })).not.toBeInTheDocument();
});

test("a missing text file replaces the placeholder with recovery actions", async () => {
  vi.mocked(getDocumentOriginal).mockResolvedValueOnce(undefined);
  render(<DocumentContent item={{ ...item, format: "markdown", sourceFileName: "preview.md" }} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("The saved file is missing");
  expect(screen.getByRole("button", { name: "Retry document" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open backups" })).toHaveAttribute("href", "/settings#storage");
  expect(screen.queryByRole("status", { name: "Loading document" })).not.toBeInTheDocument();
});
