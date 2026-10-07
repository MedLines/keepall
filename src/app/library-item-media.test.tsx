import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { buildImageFromAssetIds } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { LibraryItemMedia } from "./library-item-media";
import { useAssetObjectUrl } from "./use-asset-object-url";
import { useThumbnailObjectUrl } from "./use-thumbnail-object-url";
import { rememberPreviewLayout } from "@/persistence/preview-layouts";

vi.mock("./use-asset-object-url", () => ({ useAssetObjectUrl: vi.fn(() => null) }));
vi.mock("./use-thumbnail-object-url", () => ({ useThumbnailObjectUrl: vi.fn(() => null) }));

test("reserves a portrait thumbnail's cached dimensions before its URL loads", async () => {
  const item = buildImageFromAssetIds({ assetIds: ["portrait-media"] });
  await rememberPreviewLayout("portrait-media", 400, 800);
  vi.mocked(useThumbnailObjectUrl).mockReturnValue(null);
  const { container, rerender } = render(<LibraryItemMedia item={item} variant="grid" />);
  expect(container.querySelector<HTMLElement>("[aria-hidden]")?.style.aspectRatio).toBe("400 / 800");
  vi.mocked(useThumbnailObjectUrl).mockReturnValue("blob:portrait");
  rerender(<LibraryItemMedia item={item} variant="grid" />);
  expect(container.querySelector("img")).toHaveAttribute("width", "400");
  expect(container.querySelector("img")).toHaveAttribute("height", "800");
  vi.mocked(useThumbnailObjectUrl).mockReturnValue(null);
});

test("favicon-only list links do not load their OG image asset", () => {
  const item = { ...buildLink({ url: "https://example.com" }), previewAssetId: "og-asset" };
  const { container } = render(<LibraryItemMedia item={item} compact faviconOnly />);
  expect(useAssetObjectUrl).toHaveBeenLastCalledWith(null, { enabled: true });
  expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("domain=example.com"));
});

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

test("keeps the loaded thumbnail visible until the full image URL resolves", () => {
  const item = buildImageFromAssetIds({ assetIds: ["image-asset"] });
  vi.mocked(useAssetObjectUrl).mockReturnValue(null);
  vi.mocked(useThumbnailObjectUrl).mockReturnValue("blob:thumbnail");
  const { container, rerender } = render(<LibraryItemMedia item={item} variant="inspect" />);
  expect(container.querySelector("img")).toHaveAttribute("src", "blob:thumbnail");
  vi.mocked(useAssetObjectUrl).mockReturnValue("blob:original");
  rerender(<LibraryItemMedia item={item} variant="inspect" />);
  expect(container.querySelector("img")).toHaveAttribute("src", "blob:original");
  vi.mocked(useAssetObjectUrl).mockReturnValue(null);
  vi.mocked(useThumbnailObjectUrl).mockReturnValue(null);
});
