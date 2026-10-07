import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { LibraryTextPreview } from "./library-text-preview";

test("highlights search matches in plain text and formatted Markdown samples", () => {
  const { container, rerender } = render(<LibraryTextPreview text="React animation examples" query="react animation" />);
  expect(Array.from(container.querySelectorAll("mark"), mark => mark.textContent)).toEqual(["React", "animation"]);
  rerender(<LibraryTextPreview text="# React\nUseful **animation** examples" markdown query="react animation" />);
  expect(Array.from(container.querySelectorAll("mark"), mark => mark.textContent)).toEqual(["React", "animation"]);
  expect(container.querySelector("strong mark")).toHaveTextContent("animation");
  expect(container.querySelector("mark mark")).toBeNull();
});

test("file samples cannot create links, images, scripts, or editable inputs", () => {
  const { container } = render(<LibraryTextPreview markdown text={'[Open](javascript:alert(1))\n![Remote](https://example.com/image.png)\n<script>alert(1)</script>\n\n- [x] Complete'} />);
  expect(container.querySelector("a, img, script, input")).toBeNull();
  expect(container).toHaveTextContent("Open");
  expect(container).toHaveTextContent("Complete");
});

test("bounds the displayed sample even for large notes", () => {
  const { container } = render(<LibraryTextPreview text={"a".repeat(2000)} />);
  expect(container.textContent).toHaveLength(1400);
});

test("keeps Markdown frontmatter as plain metadata and preserves the reading body", () => {
  const text = "---\ntitle: Research\ntags: [storage]\n---\n\n# Reading notes\nSearchable **documents**.";
  const { container, rerender } = render(<LibraryTextPreview text={text} markdown query="storage" />);
  expect(container.querySelector(".library-preview-frontmatter")).toHaveTextContent("title: Research");
  expect(container.querySelector(".library-preview-frontmatter mark")).toHaveTextContent("storage");
  expect(container.querySelector(".library-preview-heading")).toHaveTextContent("Reading notes");
  expect(container.querySelector("strong")).toHaveTextContent("documents");
  rerender(<LibraryTextPreview text={text} />);
  expect(container.querySelector(".library-preview-frontmatter")).toBeNull();
  expect(container.textContent).toBe(text);
});
