import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { CaptureDemo } from "./capture-demo";

test("capture examples reset when switching types and can be replayed", () => {
  render(<CaptureDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Save to Keepall" }));
  expect(screen.getByRole("status")).toHaveTextContent("Page saved to Unsorted");
  fireEvent.click(screen.getByRole("button", { name: "Image" }));
  expect(screen.getByRole("status")).not.toHaveTextContent("Page saved");
  expect(screen.getByRole("button", { name: "Image" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Save to Keepall" }));
  expect(screen.getByRole("status")).toHaveTextContent("Image saved to Unsorted");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.getByRole("button", { name: "Save to Keepall" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Text" }));
  fireEvent.click(screen.getByRole("button", { name: "Save to Keepall" }));
  expect(screen.getByRole("status")).toHaveTextContent("Passage saved with its source link");
});
