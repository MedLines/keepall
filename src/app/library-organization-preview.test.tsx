import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { buildImage } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import { buildVideo } from "@/domain/video";
import { LibraryOrganizationPreview } from "./library-organization-preview";

// eslint-disable-next-line @next/next/no-img-element -- local media stub
vi.mock("./library-item-media", () => ({ LibraryItemMedia: () => <img alt="" src="blob:preview" /> }));
vi.mock("./use-asset-object-url", () => ({ useAssetObjectUrl: (assetId: string | null) => assetId ? "blob:link-preview" : null }));

test.each([
  buildImage({ assetId: "image", title: "Image title" }, { id: "image", now: 1 }),
  buildVideo({ assetId: "video", fileName: "video.mp4", title: "Video title" }, { id: "video", now: 1 }),
])("$type folder preview shows only media without a caption", item => {
  const { container } = render(<LibraryOrganizationPreview item={item} />);
  expect(container.querySelector("img")).not.toBeNull();
  expect(container).not.toHaveTextContent(item.title);
  expect(container.querySelector(".collection-folder-preview-title")).toBeNull();
});

test("note folder preview shows its icon and title without a body excerpt", () => {
  const item = buildNote({ title: "Note title", content: "Body excerpt" }, { id: "note", now: 1 });
  const { container } = render(<LibraryOrganizationPreview item={item} />);
  expect(container.querySelector(".collection-folder-text-preview svg")).not.toBeNull();
  expect(container).toHaveTextContent("Note title");
  expect(container).not.toHaveTextContent("Body excerpt");
});

test("link without an image shows a compact icon and title", () => {
  const item = buildLink({ url: "https://example.com", title: "Research" }, { id: "link", now: 1 });
  const { container } = render(<LibraryOrganizationPreview item={item} />);
  expect(container.querySelector(".collection-folder-text-preview svg")).not.toBeNull();
  expect(container).toHaveTextContent("Research");
  expect(container.querySelector(".library-tag-link-host")).toBeNull();
});

test("link with a preview image shows only the image", () => {
  const item = { ...buildLink({ url: "https://example.com", title: "Research" }, { id: "link", now: 1 }), previewAssetId: "preview" };
  const { container } = render(<LibraryOrganizationPreview item={item} />);
  expect(container.querySelector("img")).toHaveAttribute("src", "blob:link-preview");
  expect(container).not.toHaveTextContent("Research");
  expect(container.querySelector(".collection-folder-text-preview")).toBeNull();
});
