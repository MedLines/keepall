import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { SearchHighlight } from "./search-highlight";

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
