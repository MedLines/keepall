import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryCardContent, LibraryCardMetadata } from "./library-card-content";
import { EMPTY_LINK_PREVIEW } from "@/domain/link";

const base = { id: "item", createdAt: 1, updatedAt: 1, tagIds: [], collectionIds: [] };

describe("grid card content", () => {
  it("shows a readable note body and opens the note", () => {
    const open = vi.fn();
    const content = "Keep the card quiet.\n\nLet the image lead. ".repeat(5);
    render(<LibraryCardContent item={{ ...base, type: "note", title: "Image ideas", content }} onOpen={open} />);
    expect(screen.getByRole("button", { name: "Read Image ideas" }).textContent).toBe(content.trim());
    fireEvent.click(screen.getByRole("button", { name: "Image ideas" }));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.getByText(/Edited/)).toBeTruthy();
  });

  it("keeps link metadata and replaces a broken favicon with a glyph", () => {
    const { container } = render(<LibraryCardContent item={{ ...base, ...EMPTY_LINK_PREVIEW, type: "link", title: "", url: "https://example.com/components/footer", previewDescription: "A spacious footer." }} onOpen={vi.fn()} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.com/components/footer");
    expect(screen.getByRole("link").textContent).toContain("example.com/components/footer");
    expect(screen.getByText("A spacious footer.")).toBeTruthy();
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("uses a compact tag count before disclosing browse and removal actions", () => {
    const browse = vi.fn();
    const remove = vi.fn();
    render(<LibraryCardMetadata collections={[]} tags={[{ id: "t", name: "minimal" }]} onBrowseCollection={vi.fn()} onBrowseTag={browse} onRemoveTag={remove} />);
    expect(screen.queryByRole("list", { name: "Collections" })).toBeNull();
    expect(screen.queryByRole("button", { name: "minimal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "1 tag" }));
    expect(screen.getByRole("button", { name: "minimal" })).toBeVisible();
    const removeButton = screen.getByRole("button", { name: "Remove tag minimal" });
    expect(removeButton.querySelector("svg")).toBeTruthy();
    fireEvent.click(removeButton);
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove tag minimal" }));
    expect(remove).toHaveBeenCalledWith("t");
    fireEvent.click(screen.getByRole("button", { name: "minimal" }));
    expect(browse).toHaveBeenCalledWith("t");
  });

  it("does not add tag UI when the item has no tags", () => {
    const browseCollection = vi.fn();
    render(<LibraryCardMetadata collections={[{ id: "c", name: "Design Inspiration" }]} tags={[]} onBrowseCollection={browseCollection} onBrowseTag={vi.fn()} onRemoveTag={vi.fn()} />);
    expect(screen.queryByText("No tags")).toBeNull();
    expect(screen.queryByRole("button", { name: /tags?/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Design Inspiration" }));
    expect(browseCollection).toHaveBeenCalledWith("c");
  });
});
