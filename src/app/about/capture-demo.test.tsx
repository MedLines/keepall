import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { CaptureDemo } from "./capture-demo";

test("page capture uses the toolbar and returns focus there on replay", () => {
  render(<CaptureDemo />);
  expect(screen.queryByRole("button", { name: "Save to Keepall" })).not.toBeInTheDocument();
  const toolbar = screen.getByRole("button", { name: "Save this page with Keepall" });
  fireEvent.click(toolbar);
  expect(screen.getByRole("status")).toHaveTextContent("Page saved to Unsorted");
  expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(toolbar).toHaveFocus();
  expect(toolbar).toHaveAttribute("aria-disabled", "false");
});

test("image capture opens a context menu before saving and Escape dismisses it", () => {
  render(<CaptureDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Image" }));
  const trigger = screen.getByRole("button", { name: "Right-click the image" });
  expect(screen.queryByRole("button", { name: "Save to Keepall" })).not.toBeInTheDocument();
  fireEvent.click(trigger);
  const save = screen.getByRole("button", { name: "Save to Keepall" });
  expect(save).toHaveFocus();
  fireEvent.keyDown(save, { key: "Escape" });
  expect(screen.getByRole("button", { name: "Right-click the image" })).toHaveFocus();
  fireEvent.contextMenu(screen.getByAltText("Sunlit reading corner with a chair, books, and large windows"));
  fireEvent.click(screen.getByRole("button", { name: "Save to Keepall" }));
  expect(screen.getByRole("status")).toHaveTextContent("Image saved to Unsorted");
  expect(screen.getByText("Image file · Unsorted")).toBeInTheDocument();
});

test("switching examples discards open menus and confirmations; text stays attached to its source", () => {
  render(<CaptureDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Image" }));
  fireEvent.click(screen.getByRole("button", { name: "Right-click the image" }));
  fireEvent.click(screen.getByRole("button", { name: "Text" }));
  expect(screen.queryByRole("button", { name: "Save to Keepall" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Right-click the selection" }));
  fireEvent.click(screen.getByRole("button", { name: "Save to Keepall" }));
  expect(screen.getByRole("status")).toHaveTextContent("Passage saved with its source link");
  expect(screen.getByText("Selected passage attached to the source link")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Page" }));
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save this page with Keepall" })).toHaveAttribute("aria-disabled", "false");
});
