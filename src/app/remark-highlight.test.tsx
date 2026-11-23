import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { NoteContent } from "./note-content";

it("renders ==highlights== in Markdown notes, but not inside code or in plain notes", () => {
  const { container } = render(<NoteContent format="markdown" content={"Remember ==the deadline== and **==this==**.\n\n`==code==`"} />);
  const marks = [...container.querySelectorAll("mark.note-highlight")].map((mark) => mark.textContent);
  expect(marks).toEqual(["the deadline", "this"]);
  expect(container.querySelector("code")?.textContent).toBe("==code==");
  const plain = render(<NoteContent format="plain" content="Keep ==this== as typed" />);
  expect(plain.container.querySelector("mark")).toBeNull();
  expect(plain.container.textContent).toContain("==this==");
});

it("leaves lone and spaced equals signs alone", () => {
  const { container } = render(<NoteContent format="markdown" content={"a == b, and == c ==, x==y"} />);
  expect(container.querySelector("mark")).toBeNull();
});
