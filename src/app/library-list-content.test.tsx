import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LibraryListContent } from "./library-list-content";
import { LibraryCardMetadata } from "./library-card-content";
import { buildImage } from "@/domain/image";
import { EMPTY_LINK_PREVIEW } from "@/domain/link";
import type { DocumentItem } from "@/domain/document";

test("untitled list images have a readable label without exposing a generated filename", () => {
  const item = buildImage({ assetId: "a", sourceFileName: "abc123.png" });
  const open = vi.fn();
  const { container } = render(<LibraryListContent item={item} pinned={false} onOpen={open} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Image" }));
  expect(open).toHaveBeenCalledOnce();
  expect(screen.queryByText("abc123.png")).not.toBeInTheDocument();
  expect(screen.queryByText("Saved locally")).not.toBeInTheDocument();
  expect(container.querySelector(".library-list-summary")).toBeNull();
  expect(container.querySelector("time")).toBeNull();
});

const tags = ["minimal", "typography", "motion", "reference"].map(name => ({ id: name, name }));

test("list metadata browses through the shared tag popup and restores focus on Escape", async () => {
  const browse = vi.fn();
  const browseCollection = vi.fn();
  render(<LibraryCardMetadata className="library-list-metadata" collections={[{ id: "c", name: "UI inspiration" }]} tags={tags} onBrowseCollection={browseCollection} onBrowseTag={browse} onRemoveTag={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "UI inspiration" }));
  expect(browseCollection).toHaveBeenCalledWith("c");
  expect(screen.queryByRole("button", { name: "motion" })).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: "4 tags" });
  fireEvent.click(trigger);
  expect(browse).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "motion" }));
  expect(browse).toHaveBeenCalledWith("motion");
  await waitFor(() => expect(screen.queryByRole("button", { name: "motion" })).not.toBeInTheDocument());
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole("button", { name: "reference" }), { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  expect(trigger).toHaveFocus();
});

test("list metadata has no collection placeholder when only tags are assigned", () => {
  render(<LibraryCardMetadata className="library-list-metadata" collections={[]} tags={tags.slice(0, 1)} onBrowseCollection={vi.fn()} onBrowseTag={vi.fn()} onRemoveTag={vi.fn()} />);
  expect(screen.queryByLabelText("Collections")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1 tag" })).toBeVisible();
});

test("links omit repeated descriptions and keep their source and Markdown note separate", () => {
  render(<LibraryListContent item={{ id: "link", createdAt: 1, updatedAt: 1, tagIds: [], collectionIds: [], ...EMPTY_LINK_PREVIEW,
    type: "link", title: "Useful reference", url: "https://example.com/article", previewDescription: "Useful reference",
    noteContent: "**Try this later**", noteFormat: "markdown",
  }} pinned={false} onOpen={vi.fn()} openHref="/items/link" />);
  expect(screen.getAllByText("Useful reference")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "example.com" })).toHaveAttribute("href", "https://example.com/article");
  expect(screen.getByRole("link", { name: "Open notes for Useful reference" })).toHaveAttribute("href", "/items/link");
  expect(screen.getByRole("link", { name: "Open notes for Useful reference" }).closest(".library-list-secondary .library-list-icons")).not.toBeNull();
  expect(screen.getByRole("link", { name: "Open notes for Useful reference" })).not.toHaveAttribute("title");
  expect(screen.getByRole("img", { name: "Link" }).closest(".library-list-secondary")).not.toBeNull();
  expect(screen.getByRole("img", { name: "Markdown note" })).toBeVisible();
});

test("gallery counts remain visible outside the thumbnail", () => {
  const item = { ...buildImage({ assetId: "a" }), assetIds: ["a", "b", "c"] };
  const { container } = render(<LibraryListContent item={item} pinned={false} onOpen={vi.fn()} />);
  expect(screen.getByText("3 images")).toBeVisible();
  expect(container.querySelector(".library-list-secondary .library-list-type-icon")).toHaveAttribute("aria-label", "3 images");
});

test("documents retain the file name, search highlights, and attached personal note", async () => {
  const item: DocumentItem = { id: "pdf", type: "document", format: "pdf", title: "Design reference", sourceFileName: "guide.pdf",
    assetId: "pdf-asset", noteContent: "Check the spacing", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
  const { container } = render(<LibraryListContent item={item} pinned={false} onOpen={vi.fn()} openHref="/items/pdf" query="guide" />);
  expect(screen.getByRole("link", { name: "Open Design reference" })).toHaveAttribute("href", "/items/pdf");
  expect(container.querySelector("mark")).toHaveTextContent("guide");
  const note = screen.getByRole("link", { name: "Open notes for Design reference" });
  expect(note).not.toHaveAttribute("title");
  act(() => { note.focus(); });
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Check the spacing");
});

test("note hover previews expose a bounded excerpt instead of the whole note", async () => {
  const item = { ...buildImage({ assetId: "a", caption: `${"Remember the useful detail. ".repeat(30)}Hidden tail of the note` }), title: "Reference image" };
  render(<LibraryListContent item={item} pinned={false} onOpen={vi.fn()} openHref="/items/image" />);
  const note = screen.getByRole("link", { name: "Open notes for Reference image" });
  expect(note).not.toHaveAttribute("title");
  act(() => { note.focus(); });
  const tooltip = await screen.findByRole("tooltip");
  const excerpt = tooltip.querySelector(".library-note-excerpt");
  expect(excerpt).toHaveTextContent("Remember the useful detail.");
  expect(excerpt?.textContent?.length).toBeLessThanOrEqual(241);
  expect(excerpt).not.toHaveTextContent("Hidden tail of the note");
  expect(excerpt).toHaveAttribute("data-truncated", "true");
});
