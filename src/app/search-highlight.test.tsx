import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { DocumentItem } from "@/domain/document";
import { SearchHighlight, SearchResult } from "./search-highlight";

test("file-content excerpts remain visible when another term matches the displayed title", () => {
  const item: DocumentItem = { id: "file", type: "document", format: "text", title: "Reference", sourceFileName: "reference.txt", assetId: "original", noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
  const rect = new DOMRect(0, 0, 100, 20);
  const rectangles = vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([rect] as unknown as DOMRectList);
  const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(rect);
  try {
    const { container } = render(<SearchResult item={item} query="reference animation" excerpt={{ label: "File contents", text: "Useful Animation examples" }}>
      <h2><SearchHighlight text={item.title} query="reference animation" /></h2>
    </SearchResult>);
    expect(container.querySelector(".search-excerpt")).toBeVisible();
    expect(container.querySelector(".search-excerpt mark")).toHaveTextContent("Animation");
  } finally { rectangles.mockRestore(); bounds.mockRestore(); }
});

test("highlights every literal match while retaining text and case", () => {
  const { container, rerender } = render(<SearchHighlight text="A+B then a+b" query="a+b" />);
  expect(Array.from(container.querySelectorAll("mark"), mark => mark.textContent)).toEqual(["A+B", "a+b"]);
  expect(container.textContent).toBe("A+B then a+b");
  rerender(<SearchHighlight text="A+B then a+b" query=" " />);
  expect(container.querySelector("mark")).toBeNull();
});

test("renders saved HTML as text rather than elements", () => {
  const text = '<img src=x onerror="alert(1)"> **saved**';
  const { container } = render(<SearchHighlight text={text} query="img" />);
  expect(container.textContent).toBe(text);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("mark")).toHaveTextContent("img");
});

test("highlights separate words and exact phrases without duplicating overlapping text", () => {
  const { container, rerender } = render(<SearchHighlight text="React patterns for animation" query="animation react" />);
  expect(Array.from(container.querySelectorAll("mark"), mark => mark.textContent)).toEqual(["React", "animation"]);
  rerender(<SearchHighlight text="React animation examples" query='react "animation examples"' />);
  expect(Array.from(container.querySelectorAll("mark"), mark => mark.textContent)).toEqual(["React", "animation examples"]);
  rerender(<SearchHighlight text="Animation" query="anim animation" />);
  expect(container.textContent).toBe("Animation");
  expect(container.querySelectorAll("mark")).toHaveLength(1);
  rerender(<SearchHighlight text="İstanbul DESIGN" query="design i̇st" />);
  expect(Array.from(container.querySelectorAll("mark"), mark => mark.textContent)).toEqual(["İst", "DESIGN"]);
});
