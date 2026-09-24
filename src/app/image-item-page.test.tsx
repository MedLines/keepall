import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildImageFromAssetIds } from "@/domain/image";
import {
  appendImageAssetToItem,
  assignCollectionToItem,
  assignTagToItem,
  deleteItem,
  getItem,
  removeImageAssetAtIndex,
  replaceImageAssetAtIndex,
  unassignTagFromItem,
  updateImage,
} from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { createCollection, listCollections } from "@/persistence/collections";
import { ImageItemPage } from "./image-item-page";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/persistence/items", () => ({
  getItem: vi.fn(),
  appendImageAssetToItem: vi.fn(),
  replaceImageAssetAtIndex: vi.fn(),
  removeImageAssetAtIndex: vi.fn(),
  updateImage: vi.fn(),
  deleteItem: vi.fn(),
  assignTagToItem: vi.fn(),
  unassignTagFromItem: vi.fn(),
  assignCollectionToItem: vi.fn(),
}));

vi.mock("@/persistence/tags", () => ({
  createTag: vi.fn(),
  listTags: vi.fn(),
}));

vi.mock("@/persistence/collections", () => ({
  createCollection: vi.fn(),
  listCollections: vi.fn(),
}));

vi.mock("./library-item-media", () => ({
  LibraryItemMedia: ({ assetId, variant }: { assetId?: string | null; variant?: string }) => (
    <div data-testid="rendered-asset" data-variant={variant}>{assetId}</div>
  ),
}));

describe("ImageItemPage", () => {
  beforeEach(() => {
    vi.mocked(getItem).mockReset();
    vi.mocked(appendImageAssetToItem).mockReset();
    vi.mocked(replaceImageAssetAtIndex).mockReset();
    vi.mocked(removeImageAssetAtIndex).mockReset();
    vi.mocked(updateImage).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
    vi.mocked(createTag).mockReset();
    vi.mocked(createCollection).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listCollections).mockReset();
    routerPush.mockReset();
    vi.mocked(listTags).mockResolvedValue([
      { id: "tag-1", name: "Checkout", createdAt: 1 },
    ]);
    vi.mocked(listCollections).mockResolvedValue([
      { id: "collection-1", name: "Design inspiration", createdAt: 1, pinnedItemIds: [] },
    ]);
  });

  test("adds gallery images from the item page without returning to the old overlay", async () => {
    const one = buildImageFromAssetIds(
      { assetIds: ["asset-1"] },
      { id: "image-1", now: 1 },
    );
    const two = { ...one, assetIds: ["asset-1", "asset-2"] };
    const three = { ...one, assetIds: ["asset-1", "asset-2", "asset-3"] };
    vi.mocked(getItem).mockResolvedValue(one);
    vi.mocked(appendImageAssetToItem)
      .mockResolvedValueOnce(two)
      .mockImplementationOnce(async () => {
        vi.mocked(getItem).mockResolvedValue(three);
        return three;
      });

    render(<ImageItemPage itemId="image-1" returnHref="/" />);
    await screen.findByRole("button", { name: "View image full screen" });

    fireEvent.change(screen.getByLabelText("Choose images to add"), {
      target: {
        files: [
          new File([new Uint8Array([1, 2])], "two.png", { type: "image/png" }),
          new File([new Uint8Array([3, 4])], "three.png", { type: "image/png" }),
        ],
      },
    });

    await waitFor(() => {
      expect(appendImageAssetToItem).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Show image 3" })).toHaveAttribute(
        "aria-current",
        "true",
      );
    });
  });

  test("shows one saved image as a page and opens a separate focused viewer", async () => {
    vi.mocked(getItem).mockResolvedValue(
      buildImageFromAssetIds(
        {
          assetIds: ["asset-1", "asset-2"],
          title: "Checkout references",
          caption: "Compare the empty and populated states.",
          sourceUrl: "https://example.com/checkout",
        },
        { id: "image-1", now: 1 },
      ),
    );

    render(<ImageItemPage itemId="image-1" returnHref="/?collection=design" />);

    expect(await screen.findByRole("heading", { name: "Checkout references" })).toBeInTheDocument();
    const notes = screen.getByRole("article", { name: "Notes" });
    expect(notes).toHaveTextContent("Compare the empty and populated states.");
    expect(
      within(screen.getByRole("complementary", { name: "Image details" })).queryByText(
        "Compare the empty and populated states.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute(
      "href",
      "/?collection=design",
    );
    const toolbar = screen.getByRole("banner");
    expect(within(toolbar).getByRole("button", { name: "Edit details" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Organize" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Delete item" })).toBeInTheDocument();
    expect(screen.queryByText("Saved image")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("complementary", { name: "Image details" })).queryByRole(
        "button",
        { name: "Edit details" },
      ),
    ).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Image gallery" })).getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getAllByTestId("rendered-asset")[0]).toHaveTextContent("asset-1");
    expect(
      within(screen.getByRole("navigation", { name: "Image slides" }))
        .getByRole("button", { name: "Show image 1" }),
    ).toHaveTextContent("asset-1");
    expect(
      within(screen.getByRole("navigation", { name: "Image slides" }))
        .getByRole("button", { name: "Show image 2" }),
    ).toHaveTextContent("asset-2");

    fireEvent.click(screen.getByRole("button", { name: "View image full screen" }));
    const viewer = await screen.findByRole("dialog", { name: "Focused image viewer" });
    expect(within(viewer).getByTestId("rendered-asset")).toHaveAttribute(
      "data-variant",
      "viewer",
    );
    expect(within(viewer).getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close full-screen image" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Focused image viewer" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByRole("button", { name: "Show image 2" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getAllByTestId("rendered-asset")[0]).toHaveTextContent("asset-2");
  });

  test("arrow keys move through images on the page and in the focused viewer", async () => {
    vi.mocked(getItem).mockResolvedValue(buildImageFromAssetIds(
      { assetIds: ["asset-1", "asset-2", "asset-3"], title: "Gallery" },
      { id: "image-1", now: 1 },
    ));

    render(<ImageItemPage itemId="image-1" returnHref="/" />);
    const gallery = await screen.findByRole("region", { name: "Image gallery" });

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(within(gallery).getByText("2 / 3")).toBeInTheDocument();
    expect(within(gallery).getAllByTestId("rendered-asset")[0]).toHaveTextContent("asset-2");

    fireEvent.click(screen.getByRole("button", { name: "View image full screen" }));
    const viewer = await screen.findByRole("dialog", { name: "Focused image viewer" });
    expect(within(viewer).getByText("2 / 3")).toBeInTheDocument();
    fireEvent.keyDown(viewer, { key: "ArrowRight" });
    expect(within(viewer).getByText("3 / 3")).toBeInTheDocument();
    fireEvent.keyDown(viewer, { key: "ArrowRight" });
    expect(within(viewer).getByText("3 / 3")).toBeInTheDocument();
    fireEvent.keyDown(within(viewer).getByRole("button", { name: "Next full-screen image" }), { key: "ArrowLeft" });
    expect(within(viewer).getByText("2 / 3")).toBeInTheDocument();
    fireEvent.click(within(viewer).getByRole("button", { name: "Next full-screen image" }));
    expect(within(viewer).getByText("3 / 3")).toBeInTheDocument();

    fireEvent.click(within(viewer).getByRole("button", { name: "Close full-screen image" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    const editDialog = await screen.findByRole("dialog", { name: "Edit image details" });
    fireEvent.keyDown(within(editDialog).getByLabelText("Title (optional)"), { key: "ArrowLeft" });
    expect(within(gallery).getByText("3 / 3")).toBeInTheDocument();
  });

  test("clicking the focused image zooms in and out, then navigation resets zoom", async () => {
    vi.mocked(getItem).mockResolvedValue(buildImageFromAssetIds(
      { assetIds: ["asset-1", "asset-2"], title: "Gallery" },
      { id: "image-1", now: 1 },
    ));

    render(<ImageItemPage itemId="image-1" returnHref="/" />);
    await screen.findByRole("region", { name: "Image gallery" });
    fireEvent.click(screen.getByRole("button", { name: "View image full screen" }));
    const viewer = await screen.findByRole("dialog", { name: "Focused image viewer" });
    const zoomIn = within(viewer).getByRole("button", { name: "Zoom in image" });
    vi.spyOn(zoomIn, "getBoundingClientRect").mockReturnValue({
      left: 10, top: 20, width: 100, height: 100,
    } as DOMRect);
    fireEvent.click(zoomIn, { clientX: 35, clientY: 50, detail: 1 });
    const zoomOut = within(viewer).getByRole("button", { name: "Zoom out image" });
    expect(zoomOut.querySelector("span")).toHaveStyle({ transform: "scale(2)", transformOrigin: "25% 30%" });
    fireEvent.click(zoomOut);
    fireEvent.click(within(viewer).getByRole("button", { name: "Zoom in image" }));
    fireEvent.click(within(viewer).getByRole("button", { name: /^Zoom out$/ }));
    expect(within(viewer).getByRole("button", { name: "Zoom in image" })).toBeInTheDocument();

    fireEvent.click(within(viewer).getByRole("button", { name: "Zoom in image" }));
    fireEvent.click(within(viewer).getByRole("button", { name: "Next full-screen image" }));
    expect(within(viewer).getByRole("button", { name: "Zoom in image" })).toBeInTheDocument();
    expect(within(viewer).getByText("2 / 2")).toBeInTheDocument();
  });

  test("renders an opted-in Markdown image note", async () => {
    vi.mocked(getItem).mockResolvedValue(buildImageFromAssetIds(
      { assetIds: ["asset-1"], caption: "## Design details\n\n- Keep the image crisp", captionFormat: "markdown" },
      { id: "image-1", now: 1 },
    ));
    render(<ImageItemPage itemId="image-1" returnHref="/" />);
    const notes = await screen.findByRole("article", { name: "Notes" });
    expect(within(notes).getByRole("heading", { name: "Design details" })).toBeVisible();
    expect(within(notes).getByRole("listitem")).toHaveTextContent("Keep the image crisp");
  });

  test("shows every gallery preview up to fifteen and then moves the preview window", async () => {
    const assetIds = Array.from({ length: 16 }, (_, index) => `asset-${index + 1}`);
    vi.mocked(getItem).mockResolvedValue(
      buildImageFromAssetIds(
        { assetIds, title: "Interface references" },
        { id: "image-1", now: 1 },
      ),
    );

    render(<ImageItemPage itemId="image-1" returnHref="/" />);
    await screen.findByRole("heading", { name: "Interface references" });

    expect(screen.getAllByRole("button", { name: /Show image/ })).toHaveLength(15);
    expect(screen.queryByRole("button", { name: "Show image 16" })).not.toBeInTheDocument();

    for (let index = 0; index < 8; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    }

    expect(screen.getByRole("button", { name: "Show image 16" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Show image/ })).toHaveLength(15);
  });

  test("confirms before removing the current image from a gallery", async () => {
    const image = buildImageFromAssetIds(
      { assetIds: ["asset-1", "asset-2"], title: "Interface references" },
      { id: "image-1", now: 1 },
    );
    const updated = { ...image, assetIds: ["asset-2"] };
    vi.mocked(getItem).mockResolvedValue(image);
    vi.mocked(removeImageAssetAtIndex).mockImplementation(async () => {
      vi.mocked(getItem).mockResolvedValue(updated);
      return updated;
    });

    render(<ImageItemPage itemId="image-1" returnHref="/" />);
    await screen.findByRole("heading", { name: "Interface references" });
    fireEvent.click(screen.getByRole("button", { name: "Remove current image" }));

    const confirmation = screen.getByRole("dialog", { name: "Remove this image?" });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Remove image" }),
    );

    await waitFor(() => {
      expect(removeImageAssetAtIndex).toHaveBeenCalledWith("image-1", 0);
      expect(screen.queryByRole("button", { name: "Remove current image" })).not.toBeInTheDocument();
    });
  });

  test("shows a useful recovery state when the local image no longer exists", async () => {
    vi.mocked(getItem).mockResolvedValue(null);

    render(<ImageItemPage itemId="missing" returnHref="/" />);

    expect(await screen.findByRole("heading", { name: "Image not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to library" })).toHaveAttribute("href", "/");
  });

  test("edits image details from the item page and updates the reading view", async () => {
    const image = buildImageFromAssetIds(
      {
        assetIds: ["asset-1"],
        title: "Checkout references",
        caption: "Old notes",
        sourceUrl: "https://example.com/old",
      },
      { id: "image-1", now: 1 },
    );
    const updated = {
      ...image,
      title: "Checkout flow",
      caption: "A much longer design note.",
      sourceUrl: "https://example.com/new",
    };
    vi.mocked(getItem).mockResolvedValue(image);
    vi.mocked(updateImage).mockImplementation(async () => {
      vi.mocked(getItem).mockResolvedValue(updated);
      return updated;
    });

    render(<ImageItemPage itemId="image-1" returnHref="/" />);
    await screen.findByRole("heading", { name: "Checkout references" });
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));

    const editDialog = screen.getByRole("dialog", { name: "Edit image details" });

    fireEvent.change(within(editDialog).getByLabelText("Title (optional)"), {
      target: { value: "Checkout flow" },
    });
    fireEvent.change(within(editDialog).getByLabelText("Notes"), {
      target: { value: "A much longer design note." },
    });
    fireEvent.change(within(editDialog).getByLabelText("Source URL (optional)"), {
      target: { value: "https://example.com/new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateImage).toHaveBeenCalledWith("image-1", {
        title: "Checkout flow",
        caption: "A much longer design note.",
        captionFormat: "plain",
        sourceUrl: "https://example.com/new",
      });
      expect(screen.getByRole("article", { name: "Notes" })).toHaveTextContent(
        "A much longer design note.",
      );
    });
  });

  test("opens the organizer and removes an assigned tag", async () => {
    const image = {
      ...buildImageFromAssetIds(
        { assetIds: ["asset-1"], title: "Checkout references" },
        { id: "image-1", now: 1 },
      ),
      tagIds: ["tag-1"],
    };
    const updated = { ...image, tagIds: [] };
    vi.mocked(getItem).mockResolvedValue(image);
    vi.mocked(unassignTagFromItem).mockImplementation(async () => {
      vi.mocked(getItem).mockResolvedValue(updated);
      return updated;
    });

    render(<ImageItemPage itemId="image-1" returnHref="/" />);
    await screen.findByRole("heading", { name: "Checkout references" });
    fireEvent.click(screen.getByRole("button", { name: "Organize" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Organize Checkout references" }))
        .getByRole("button", { name: "Remove tag Checkout" }),
    );

    await waitFor(() => {
      expect(unassignTagFromItem).toHaveBeenCalledWith("image-1", "tag-1");
    });
  });

  test("deletes the image after confirmation and returns to the previous library view", async () => {
    vi.mocked(getItem).mockResolvedValue(
      buildImageFromAssetIds(
        { assetIds: ["asset-1"], title: "Checkout references" },
        { id: "image-1", now: 1 },
      ),
    );
    vi.mocked(deleteItem).mockResolvedValue();

    render(
      <ImageItemPage
        itemId="image-1"
        returnHref="/?collection=design&layout=list"
      />,
    );
    await screen.findByRole("heading", { name: "Checkout references" });
    fireEvent.click(screen.getByRole("button", { name: "Delete item" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Delete this item?" }))
        .getByRole("button", { name: "Confirm delete" }),
    );

    await waitFor(() => {
      expect(deleteItem).toHaveBeenCalledWith("image-1");
      expect(routerPush).toHaveBeenCalledWith("/?collection=design&layout=list");
    });
  });
});
