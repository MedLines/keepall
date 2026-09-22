import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { NoteContent } from "./note-content";

vi.mock("./use-asset-object-url", () => ({
  useAssetObjectUrl: (id: string | null) => id ? `blob:local-${id}` : null,
}));

describe("NoteContent", () => {
  test("keeps quick notes literal", () => {
    render(<NoteContent content={"# Card idea\n**Keep this literal**"} format="plain" />);
    expect(screen.queryByRole("heading", { name: "Card idea" })).toBeNull();
    expect(screen.getByText(/# Card idea/)).toBeVisible();
    expect(screen.getByText(/\*\*Keep this literal\*\*/)).toBeVisible();
  });

  test("formats a pasted design note when Markdown is selected", () => {
    render(<NoteContent content={"# Card idea\n\n- [x] Test inset\n\n| View | Gap |\n| --- | --- |\n| Grid | 8px |\n\n```tsx\nconst gap = 8;\n```"} format="markdown" />);
    expect(screen.getByRole("heading", { name: "Card idea" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Completed checklist item" })).toBeDisabled();
    expect(screen.getByText("Test inset")).toBeVisible();
    expect(screen.getByRole("table")).toHaveTextContent("Grid");
    expect(screen.getByText("const gap = 8;")).toBeVisible();
  });

  test("does not execute raw HTML or load remote images", () => {
    const { container } = render(<NoteContent content={'<script>alert(1)</script>\n\n![remote](https://example.com/image.png)\n\n[unsafe](javascript:alert(1))'} format="markdown" />);
    expect(container.querySelector("script, img")).toBeNull();
    expect(screen.getByText(/Image: remote/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "unsafe" })).toBeNull();
  });

  test.each(["plain", "markdown"] as const)("renders a local image between %s paragraphs", (format) => {
    const { container } = render(<NoteContent content={"Before\n\n![Sketch](keepall-image:a1)\n\nAfter"} format={format} />);
    const image = screen.getByRole("img", { name: "Sketch" });
    expect(image).toHaveAttribute("src", "blob:local-a1");
    const text = container.textContent ?? "";
    expect(text.indexOf("Before")).toBeLessThan(text.indexOf("After"));
  });

  test("does not turn a local-looking link into an image or open a remote image", () => {
    const { container } = render(<NoteContent content="[not an image](keepall-image:a1)\n\n![remote](https://example.com/a.png)" format="markdown" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("link", { name: "not an image" })).toBeNull();
  });
});
