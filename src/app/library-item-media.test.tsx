import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { buildLink } from "@/domain/link";
import { LibraryItemMedia } from "./library-item-media";

vi.mock("./use-asset-object-url", () => ({ useAssetObjectUrl: () => null }));
vi.mock("./use-thumbnail-object-url", () => ({ useThumbnailObjectUrl: () => null }));

test("tries the site's favicon and a small favicon before showing the generic link icon", () => {
  const item = buildLink({ url: "https://www.youtube.com/@amrmohamed2608" });
  const { container, rerender } = render(<LibraryItemMedia item={item} />);
  const image = () => container.querySelector("img")!;
  expect(image()).toHaveAttribute("src", expect.stringContaining("sz=128"));
  fireEvent.error(image());
  expect(image()).toHaveAttribute("src", "https://www.youtube.com/favicon.ico");
  expect(image()).toHaveClass("size-8");
  fireEvent.error(image());
  expect(image()).toHaveAttribute("src", expect.stringContaining("sz=32"));
  fireEvent.error(image());
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).not.toBeNull();
  rerender(<LibraryItemMedia item={{ ...item, url: "https://example.com" }} />);
  expect(image()).toHaveAttribute("src", expect.stringContaining("domain=example.com"));
});
