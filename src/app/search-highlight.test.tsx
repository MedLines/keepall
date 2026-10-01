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
