import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { NoteContent } from "./note-content";

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
});
