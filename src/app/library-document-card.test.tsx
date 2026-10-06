import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { DocumentItem } from "@/domain/document";
import { LibraryDocumentCard } from "./library-document-card";
import { useDocumentPreview } from "./use-document-preview";

vi.mock("./use-document-preview", () => ({ useDocumentPreview: vi.fn() }));
const item: DocumentItem = { id: "doc", type: "document", format: "markdown", title: "Research", sourceFileName: "research.md", assetId: "asset", noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
beforeEach(() => vi.mocked(useDocumentPreview).mockReturnValue({ key: "asset:markdown", text: "# Storage\n\nReliable local files." }));

test("file reading previews retain the filename, format, and navigation", () => {
  render(<LibraryDocumentCard item={item} query="reliable" pinned={false} openHref="/items/doc" onOpen={vi.fn()} />);
  expect(screen.getByRole("link", { name: "Open Research" })).toHaveAttribute("href", "/items/doc");
  expect(screen.getByRole("heading", { name: "Research" })).toBeVisible();
  expect(screen.getByText("research.md")).toBeVisible();
  expect(screen.getByRole("img", { name: "Markdown document" })).toBeVisible();
  expect(screen.getByText("Reliable", { selector: "mark" })).toBeVisible();
});

test("loading, unavailable and empty file previews remain distinct", () => {
  const props = { item, query: "", pinned: false, onOpen: vi.fn() };
  vi.mocked(useDocumentPreview).mockReturnValue(null);
  const { rerender } = render(<LibraryDocumentCard {...props} />);
  expect(screen.getByText("Loading preview…")).toBeVisible();
  vi.mocked(useDocumentPreview).mockReturnValue({ key: "asset:markdown", text: null });
  rerender(<LibraryDocumentCard {...props} />);
  expect(screen.getByText("Preview unavailable")).toBeVisible();
  vi.mocked(useDocumentPreview).mockReturnValue({ key: "asset:markdown", text: "" });
  rerender(<LibraryDocumentCard {...props} />);
  expect(screen.getByText("Empty file")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open Research" }));
  expect(props.onOpen).toHaveBeenCalledOnce();
});

test("PDF metadata avoids repeating its filename unless the title adds information", () => {
  const pdf = { ...item, format: "pdf" as const, title: "Research", sourceFileName: "Research.pdf" };
  const props = { item: pdf, query: "", pinned: false, openHref: "/items/doc", onOpen: vi.fn() };
  const { rerender } = render(<LibraryDocumentCard {...props} />);
  expect(screen.queryByText("Research.pdf")).toBeNull();
  rerender(<LibraryDocumentCard {...props} item={{ ...pdf, title: "Local storage findings", noteContent: "Read the final section", noteFormat: "markdown" }} />);
  expect(screen.getByText("Research.pdf")).toBeVisible();
  expect(screen.getByRole("link", { name: /Open notes/ })).toHaveTextContent("Read the final section");
  expect(screen.getByRole("img", { name: "Markdown note" })).toBeVisible();
});

test("trashed reading cards expose no navigation or editing controls", () => {
  render(<LibraryDocumentCard item={{ ...item, deletedAt: 2, noteContent: "Keep this note" }} query="" pinned openHref="/items/doc" onOpen={vi.fn()} />);
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByTitle("Pinned in this collection")).toBeVisible();
});
