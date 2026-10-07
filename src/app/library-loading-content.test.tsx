import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ItemPageLoading, LibraryLoadingContent, LibraryStartupContent } from "./library-loading-content";

test("exposes one loading announcement and no interactive placeholder cards", () => {
  const { container, rerender } = render(<LibraryLoadingContent layout="grid" />);
  expect(screen.getByRole("status", { name: "Loading library" })).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull();
  expect(container.querySelectorAll(".library-loading-card")).toHaveLength(12);
  rerender(<LibraryLoadingContent layout="list" columns="3" />);
  expect(container.querySelector<HTMLElement>(".library-loading-list")?.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
});

afterEach(() => vi.useRealTimers());

test("keeps the delayed skeleton through the content handoff and never repeats it for filtering", () => {
  vi.useFakeTimers();
  const { container, rerender } = render(<LibraryStartupContent loading layout="grid"><span>First content</span></LibraryStartupContent>);
  const wrapper = container.firstElementChild!;
  expect(screen.queryByText("First content")).toBeNull();
  act(() => vi.advanceTimersByTime(151));
  rerender(<LibraryStartupContent loading={false} layout="grid"><span>First content</span></LibraryStartupContent>);
  expect(wrapper).toHaveAttribute("data-phase", "handoff");
  expect(screen.getByText("First content")).toBeInTheDocument();
  expect(container.querySelector(".library-loading-grid")).toBeInTheDocument();
  expect(screen.queryByRole("status")).toBeNull();
  act(() => vi.advanceTimersByTime(160));
  expect(wrapper).toHaveAttribute("data-phase", "ready");
  expect(container.querySelector(".library-loading-grid")).toBeNull();
  rerender(<LibraryStartupContent loading={false} layout="grid"><span>Filtered content</span></LibraryStartupContent>);
  expect(wrapper).toHaveAttribute("data-phase", "ready");
  expect(container.querySelector(".library-startup-content")).toBeNull();
});

test("quick reads skip the skeleton handoff instead of fading content from a blank screen", () => {
  vi.useFakeTimers();
  const { container, rerender } = render(<LibraryStartupContent loading layout="list">Ready</LibraryStartupContent>);
  act(() => vi.advanceTimersByTime(100));
  rerender(<LibraryStartupContent loading={false} layout="list">Ready</LibraryStartupContent>);
  expect(container.firstElementChild).toHaveAttribute("data-phase", "ready");
  expect(container.querySelector(".library-startup-content")).toBeNull();
  expect(container.querySelector(".library-loading-list")).toBeNull();
});

test("organization placeholders use folder artwork and tag collages instead of item cards", () => {
  const { container, rerender } = render(<LibraryLoadingContent layout="grid" kind="collections" />);
  expect(screen.getByRole("status", { name: "Loading collections" })).toBeInTheDocument();
  expect(container.querySelectorAll(".collection-folder-stage")).toHaveLength(12);
  expect(container.querySelector(".library-loading-card")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  rerender(<LibraryLoadingContent layout="list" kind="tags" />);
  expect(screen.getByRole("status", { name: "Loading tags" })).toBeInTheDocument();
  expect(container.querySelector(".organization-list")).toBeInTheDocument();
  expect(container.querySelectorAll(".library-tag-previews")).toHaveLength(12);
  expect(container.querySelector(".collection-folder-stage")).toBeNull();
});

test("direct item loading keeps the header and preserves its return destination", () => {
  render(<ItemPageLoading returnHref="/?collection=references" />);
  expect(screen.getByRole("status", { name: "Loading item" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/?collection=references");
  expect(screen.queryByText("Loading image…")).toBeNull();
});
