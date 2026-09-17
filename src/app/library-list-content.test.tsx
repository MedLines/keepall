import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LibraryListMetadata } from "./library-list-content";

const tags = ["minimal", "typography", "motion", "reference"].map(name => ({ id: name, name }));

test("list metadata shows two tags and expands the rest without navigation", () => {
  const browse = vi.fn();
  render(<LibraryListMetadata collections={["UI inspiration"]} tags={tags} onBrowseTag={browse} />);
  expect(screen.getByLabelText("Collections")).toHaveTextContent("in UI inspiration");
  expect(screen.queryByRole("button", { name: "motion" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show 2 more tags" }));
  expect(browse).not.toHaveBeenCalled();
  const motion = screen.getByRole("button", { name: "motion" });
  fireEvent.click(motion);
  expect(browse).toHaveBeenCalledWith("motion");
  fireEvent.keyDown(motion, { key: "Escape" });
  expect(screen.queryByRole("button", { name: "motion" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show 2 more tags" })).toHaveFocus();
});

test("collection context disappears when no collection names are passed", () => {
  render(<LibraryListMetadata collections={[]} tags={tags.slice(0, 1)} onBrowseTag={vi.fn()} />);
  expect(screen.queryByLabelText("Collections")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "minimal" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /more tags/ })).not.toBeInTheDocument();
});
