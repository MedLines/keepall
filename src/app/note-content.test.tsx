import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { NoteContent } from "./note-content";

vi.mock("./use-asset-object-url", () => ({
  useAssetObjectUrl: (id: string | null) => id ? `blob:local-${id}` : null,
}));

describe("NoteContent", () => {
  test.each(["plain", "markdown"] as const)("imported %s content cannot read library images or load external resources", (format) => {
    const { container } = render(<NoteContent allowLocalImages={false} format={format} content={'![Local](keepall-image:a1)\n\n![Remote](https://example.com/pixel)\n\n<iframe src="https://example.com"></iframe><script>alert(1)</script>'} />);
    expect(container.querySelector("img, iframe, script")).toBeNull();
    if (format === "plain") expect(container.textContent).toContain("keepall-image:a1");
    else expect(screen.getByText("Image: Local")).toBeVisible();
  });
  test("keeps quick notes literal", () => {
    render(<NoteContent content={"# Card idea\n**Keep this literal**"} format="plain" />);
    expect(screen.queryByRole("heading", { name: "Card idea" })).toBeNull();
    expect(screen.getByText(/# Card idea/)).toBeVisible();
    expect(screen.getByText(/\*\*Keep this literal\*\*/)).toBeVisible();
  });

  test("formats a pasted design note when Markdown is selected", () => {
    render(<NoteContent content={"# Card idea\n\n- [x] Test inset\n\n| View | Gap |\n| --- | --- |\n| Grid | 8px |\n\n```tsx\nconst gap = 8;\n```"} format="markdown" />);
    expect(screen.getByRole("heading", { name: "Card idea" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Test inset" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Test inset" })).toBeDisabled();
    expect(screen.getByText("Test inset")).toBeVisible();
    expect(screen.getByRole("table")).toHaveTextContent("Grid");
    expect(screen.getByText("const gap = 8;")).toBeVisible();
  });

  describe("checklists", () => {
    const content = "## Groceries\n\n- [ ] Oat **milk**\n- [x] Bread\n  - [X] Sourdough\n\n1. [ ] Ordered\n* [ ] Star\n+ [ ] Plus\n\n> - [ ] Quoted\n\n- [ ] Loose one\n\n- [x] Loose two\n";
    const boxes = ["Oat milk", "Bread", "Sourdough", "Ordered", "Star", "Plus", "Quoted", "Loose one", "Loose two"];

    test("each box is named by its item and flips only its own line", () => {
      const onTaskToggle = vi.fn();
      render(<NoteContent content={content} format="markdown" onTaskToggle={onTaskToggle} />);
      for (const name of boxes) {
        const box = screen.getByRole("checkbox", { name });
        expect(box).toBeEnabled();
        fireEvent.click(box);
        const next = onTaskToggle.mock.lastCall?.[0] as string;
        const changed = next.split("\n").map((line, index) => [line, content.split("\n")[index]]).filter(([a, b]) => a !== b);
        expect(changed).toHaveLength(1);
        expect(changed[0][1]).toContain(name.split(" ")[0]);
        expect(changed[0][0].replace(/\[[ xX]\]/, "")).toBe(changed[0][1].replace(/\[[ xX]\]/, ""));
        expect(changed[0][0]).toContain(box.matches(":checked") ? "[ ]" : "[x]");
      }
      expect(onTaskToggle).toHaveBeenCalledTimes(boxes.length);
    });

    test("keeps the same focused box after the new content renders", () => {
      function Editable() {
        const [value, setValue] = useState("- [ ] First\n- [ ] Second");
        return <NoteContent content={value} format="markdown" onTaskToggle={setValue} />;
      }
      render(<Editable />);
      const box = screen.getByRole("checkbox", { name: "Second" });
      box.focus();
      fireEvent.click(box);
      expect(screen.getByRole("checkbox", { name: "Second" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Second" })).toBe(box);
      expect(box).toHaveFocus();
      expect(screen.getByRole("checkbox", { name: "First" })).not.toBeChecked();
    });

    test("stays read-only without an edit path", () => {
      render(<NoteContent content={content} format="markdown" />);
      for (const name of boxes) expect(screen.getByRole("checkbox", { name })).toBeDisabled();
    });
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
