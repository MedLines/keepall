import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { NotePreview } from "./note-preview";

test("renders headings, lists, tables and disabled task controls", () => {
  render(<NotePreview format="markdown" content={'# Heading\n\n- One\n- Two\n\n- [x] Done\n- [ ] Pending\n\n| A | B |\n| - | - |\n| 1 | 2 |'} />);
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Heading");
  expect(screen.getByRole("table")).toHaveTextContent("A");
  expect(screen.getByRole("checkbox", { name: "Completed checklist item" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Incomplete checklist item" })).toBeDisabled();
});

test("keeps HTML literal, never mounts images, and only exposes safe absolute links", () => {
  const { container } = render(<NotePreview format="markdown" content={'<img src="https://remote.example/html.png" onerror="alert(1)">\n\n![Alt](https://remote.example/image.png)\n\n[js](javascript:alert) [data](data:text/html,hi) [relative](/somewhere) [safe](https://example.com) [mail](mailto:a@example.com)'} />);
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain('<img src="https://remote.example/html.png"');
  expect(screen.getByText("Image: Alt")).toBeVisible();
  expect(screen.getAllByRole("link")).toHaveLength(2);
  expect(screen.getByRole("link", { name: "safe" })).toHaveAttribute("rel", "noopener noreferrer");
});

test("plain preview preserves literal source including markup", () => {
  const content = '# Heading\n<script>alert(1)</script>\n**bold**';
  const { container } = render(<NotePreview format="plain" content={content} />);
  expect(container.textContent).toBe(content);
  expect(container.querySelector("script,h3,strong")).toBeNull();
});
