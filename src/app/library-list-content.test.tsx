import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  countFittingTags,
  LibraryListContent,
  LibraryListMetadata,
} from "./library-list-content";
import { buildImage } from "@/domain/image";

test("untitled images omit the empty title button and keep the saved date", () => {
  const { container } = render(<LibraryListContent item={buildImage({ assetId: "a", sourceFileName: "abc123.png" })} pinned={false} onOpen={vi.fn()} />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(container.querySelector("time")).toBeTruthy();
});

const tags = ["minimal", "typography", "motion", "reference"].map(name => ({ id: name, name }));

test("list metadata uses the full tag row before reserving overflow space", () => {
  expect(countFittingTags([48, 72, 56], 184, 32)).toBe(3);
  expect(countFittingTags([48, 72, 56], 159, 32)).toBe(1);
});

test("list metadata shows two tags and expands the rest without navigation", () => {
  const browse = vi.fn();
  const browseCollection = vi.fn();
  render(<LibraryListMetadata collections={[{ id: "c", name: "UI inspiration" }]} tags={tags} onBrowseCollection={browseCollection} onBrowseTag={browse} />);
  expect(screen.getByLabelText("Collections")).toHaveTextContent("in UI inspiration");
  fireEvent.click(screen.getByRole("button", { name: "in UI inspiration" }));
  expect(browseCollection).toHaveBeenCalledWith("c");
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
  render(<LibraryListMetadata collections={[]} tags={tags.slice(0, 1)} onBrowseCollection={vi.fn()} onBrowseTag={vi.fn()} />);
  expect(screen.queryByLabelText("Collections")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "minimal" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /more tags/ })).not.toBeInTheDocument();
});
