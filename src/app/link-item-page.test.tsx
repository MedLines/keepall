import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildLink } from "@/domain/link";
import { createCollection, listCollections } from "@/persistence/collections";
import { assignCollectionToItem, assignTagToItem, getItem, updateLink } from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { LinkItemPage } from "./link-item-page";

vi.mock("@/persistence/items", () => ({ getItem: vi.fn(), updateLink: vi.fn(), assignTagToItem: vi.fn(), assignCollectionToItem: vi.fn() }));
vi.mock("@/persistence/tags", () => ({ createTag: vi.fn(), listTags: vi.fn() }));
vi.mock("@/persistence/collections", () => ({ createCollection: vi.fn(), listCollections: vi.fn() }));
vi.mock("./library-item-media", () => ({ LibraryItemMedia: () => <div data-testid="link-preview" /> }));

describe("LinkItemPage", () => {
  beforeEach(() => {
    vi.mocked(getItem).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
    vi.mocked(createTag).mockReset();
    vi.mocked(createCollection).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(listCollections).mockResolvedValue([]);
  });

  test("organizes an open link without changing its website or personal note", async () => {
    const link = {
      ...buildLink({ url: "https://example.com/article", noteContent: "My notes" }, { id: "l-org", now: 1 }),
      tagIds: ["t1"], collectionIds: ["c1"],
    };
    let stored = link;
    vi.mocked(getItem).mockImplementation(async () => stored);
    vi.mocked(listTags).mockResolvedValue([
      { id: "t1", name: "reference", createdAt: 1 },
      { id: "t2", name: "review", createdAt: 1 },
    ]);
    vi.mocked(listCollections).mockResolvedValue([
      { id: "c1", name: "Reading", createdAt: 1, pinnedItemIds: [] },
      { id: "c2", name: "Design", createdAt: 1, pinnedItemIds: [] },
    ]);
    vi.mocked(createTag).mockResolvedValue({ id: "t2", name: "review", createdAt: 1 });
    vi.mocked(assignTagToItem).mockImplementation(async () => {
      stored = { ...stored, tagIds: ["t1", "t2"] };
      return stored;
    });
    vi.mocked(createCollection).mockResolvedValue({ id: "c2", name: "Design", createdAt: 1, pinnedItemIds: [] });
    vi.mocked(assignCollectionToItem).mockImplementation(async () => {
      stored = { ...stored, collectionIds: ["c2"] };
      return stored;
    });

    render(<LinkItemPage itemId="l-org" returnHref="/" />);
    const details = await screen.findByRole("complementary", { name: "Link details" });
    expect(details).toHaveTextContent("Reading");
    expect(details).toHaveTextContent("reference");
    fireEvent.click(screen.getByRole("button", { name: "Organize" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Add tag" }), { target: { value: "review" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(assignTagToItem).toHaveBeenCalledWith("l-org", "t2"));
    fireEvent.change(screen.getByRole("combobox", { name: "Move to collection" }), { target: { value: "Design" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() => expect(assignCollectionToItem).toHaveBeenCalledWith("l-org", "c2"));
    expect(details).toHaveTextContent("Design");
    expect(details).toHaveTextContent("review");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("My notes", { selector: "article p" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Open website/ })).toHaveAttribute("href", "https://example.com/article");
  });

  test("shows the website preview separately from a Markdown personal note", async () => {
    const link = { ...buildLink({ url: "https://example.com/article", noteContent: "## Why I saved this", noteFormat: "markdown" }, { id: "l1", now: 1 }), previewTitle: "Design article", previewDescription: "Website summary" };
    vi.mocked(getItem).mockResolvedValue(link);

    render(<LinkItemPage itemId="l1" returnHref="/?tag=design" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Design article" })).toBeVisible();
    expect(screen.getByText("Website summary")).toBeVisible();
    expect(screen.queryByTestId("link-preview")).toBeNull();
    expect(screen.getByRole("heading", { name: "Why I saved this" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Open website/ })).toHaveAttribute("href", "https://example.com/article");
    expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/?tag=design");
  });

  test("shows a saved preview image when the link has one", async () => {
    vi.mocked(getItem).mockResolvedValue({ ...buildLink({ url: "https://example.com/article" }, { id: "l3", now: 1 }), previewAssetId: "preview-image" });
    render(<LinkItemPage itemId="l3" returnHref="/" />);
    expect(await screen.findByTestId("link-preview")).toBeVisible();
  });

  test("updates the preview when enrichment finishes after the page opens", async () => {
    const link = buildLink({ url: "https://example.com/article", noteContent: "My note" }, { id: "l4", now: 1 });
    vi.mocked(getItem).mockResolvedValueOnce(link).mockResolvedValue({ ...link, previewTitle: "Fetched title", previewDescription: "Fetched summary" });
    render(<LinkItemPage itemId="l4" returnHref="/" />);
    expect(await screen.findByRole("heading", { level: 1, name: "https://example.com/article" })).toBeVisible();
    fireEvent(window, new Event(ITEMS_CHANGED_EVENT));
    expect(await screen.findByRole("heading", { level: 1, name: "Fetched title" })).toBeVisible();
    expect(screen.getByText("Fetched summary")).toBeVisible();
    expect(screen.getByText("My note", { selector: "article p" })).toBeVisible();
  });

  test("adds a note to a link without replacing its fetched preview", async () => {
    const link = { ...buildLink({ url: "https://example.com/article" }, { id: "l2", now: 1 }), previewTitle: "Design article", previewDescription: "Website summary" };
    vi.mocked(getItem).mockResolvedValueOnce(link).mockResolvedValue({ ...link, noteContent: "My own note" });
    vi.mocked(updateLink).mockResolvedValue({ ...link, noteContent: "My own note" });

    render(<LinkItemPage itemId="l2" returnHref="/" />);
    fireEvent.click(await screen.findByRole("button", { name: "Write a note" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your note" }), { target: { value: "My own note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => expect(updateLink).toHaveBeenCalledWith("l2", { url: "https://example.com/article", noteContent: "My own note", noteFormat: "plain" }));
    expect(await screen.findByText("My own note")).toBeVisible();
    expect(screen.getByText("Website summary")).toBeVisible();
  });
});
