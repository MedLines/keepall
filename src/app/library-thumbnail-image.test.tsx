import { fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryThumbnailImage } from "./library-thumbnail-image";

afterEach(() => vi.restoreAllMocks());

test("reveals a cold thumbnail only on load and keeps it visible when remounted", () => {
  const loaded = vi.fn();
  const first = render(<LibraryThumbnailImage src="blob:cold-thumbnail" alt="Preview" onLoad={loaded} />);
  const image = first.getByRole("img");
  expect(image).toHaveAttribute("data-ready", "false");
  fireEvent.load(image);
  expect(image).toHaveAttribute("data-ready", "true");
  expect(loaded).toHaveBeenCalledOnce();
  first.unmount();
  const next = render(<LibraryThumbnailImage src="blob:cold-thumbnail" alt="Preview" />);
  expect(next.getByRole("img")).toHaveAttribute("data-ready", "true");
});

test("changing to a cold source does not reuse the preceding image's loaded state", () => {
  const { getByRole, rerender } = render(<LibraryThumbnailImage src="blob:previous-thumbnail" alt="Preview" />);
  fireEvent.load(getByRole("img"));
  rerender(<LibraryThumbnailImage src="blob:next-thumbnail" alt="Preview" />);
  expect(getByRole("img")).toHaveAttribute("data-ready", "false");
  fireEvent.load(getByRole("img"));
  expect(getByRole("img")).toHaveAttribute("data-ready", "true");
});

test("browser-cached images are visible before paint without replaying the fade", () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(100);
  const { getByRole } = render(<LibraryThumbnailImage src="blob:browser-cached" alt="Preview" />);
  expect(getByRole("img")).toHaveAttribute("data-ready", "true");
});
