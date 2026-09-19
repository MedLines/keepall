import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildLink, LinkValidationError } from "@/domain/link";
import { buildImage, ImageValidationError } from "@/domain/image";
import { buildNote, NoteValidationError } from "@/domain/note";
import {
  appendImageAssetToItem,
  assignCollectionToItem,
  assignTagToItem,
  deleteItem,
  listItems,
  replaceImageAssetAtIndex,
  unassignTagFromItem,
  updateLink,
  updateNote,
} from "@/persistence/items";
import { createCollection, listCollections, renameCollection, deleteCollection, pinItemInCollection, unpinItemInCollection } from "@/persistence/collections";
import { createTag, deleteTag, listTags } from "@/persistence/tags";
import {
  getLibraryPreferences,
  movePinnedCollectionBefore,
  pinCollection,
  unpinCollection,
} from "@/persistence/library-preferences";
import { mockNavigation } from "../../vitest.setup";
import { enrichLinkPreview } from "./enrich-link-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { Library } from "./library";
import {
  encodeLibraryDragIds,
  LIBRARY_ITEM_DRAG_MIME,
} from "./library-drag";
import type { Item } from "@/domain/item";
import type { ReactNode } from "react";

// jsdom has no layout. Masonry measurement and windowing are covered in e2e.
vi.mock("./library-masonry", () => ({
  LibraryMasonry: ({ items, renderItem }: { items: Item[]; renderItem: (item: Item) => ReactNode }) => (
    <ul>{items.map(item => renderItem(item))}</ul>
  ),
}));

function pickTopMenu(menuLabel: string, optionLabel: string) {
  fireEvent.click(screen.getByRole("button", { name: menuLabel }));
  fireEvent.click(
    screen.getByRole("option", {
      name: new RegExp(`^${optionLabel}`),
    }),
  );
}

vi.mock("@/persistence/items", () => ({
  listItems: vi.fn(),
  deleteItem: vi.fn(),
  updateNote: vi.fn(),
  updateLink: vi.fn(),
  updateImage: vi.fn(),
  appendImageAssetToItem: vi.fn(),
  replaceImageAssetAtIndex: vi.fn(),
  assignTagToItem: vi.fn(),
  unassignTagFromItem: vi.fn(),
  assignCollectionToItem: vi.fn(),
}));

vi.mock("./enrich-link-preview", () => ({
  enrichLinkPreview: vi.fn(),
}));

vi.mock("./wake-link-preview-retries", () => ({
  wakeLinkPreviewRetries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./preview-enrich-coordinator", () => ({
  startPreviewWelcomeBatch: vi.fn().mockResolvedValue(undefined),
  resumePreviewWelcomeBatch: vi.fn().mockResolvedValue(undefined),
  subscribePreviewEnrichProgress: vi.fn(() => () => {}),
  subscribePreviewViewportBudgetCapped: vi.fn(() => () => {}),
  requestPreviewEnrichViewport: vi.fn(),
  requestManualPreviewEnrich: vi.fn().mockResolvedValue(undefined),
  clearPendingViewportPreviewEnrich: vi.fn(),
  pausePreviewEnrichForNavigation: vi.fn(),
  setViewportPreviewEnrichEnabled: vi.fn(),
}));

vi.mock("@/persistence/tags", () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
}));

vi.mock("@/persistence/collections", () => ({
  listCollections: vi.fn(),
  createCollection: vi.fn(),
  renameCollection: vi.fn(),
  deleteCollection: vi.fn(),
  pinItemInCollection: vi.fn(),
  unpinItemInCollection: vi.fn(),
}));

vi.mock("@/persistence/library-preferences", () => ({
  getLibraryPreferences: vi.fn(),
  movePinnedCollectionBefore: vi.fn(),
  pinCollection: vi.fn(),
  unpinCollection: vi.fn(),
}));

const note = buildNote({ content: "A persisted note" }, { id: "n1", now: 1 });
const link = buildLink(
  { url: "https://example.com/old" },
  { id: "l1", now: 1 },
);

describe("Library", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(updateNote).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(enrichLinkPreview).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(createTag).mockReset();
    vi.mocked(deleteTag).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
    vi.mocked(pinItemInCollection).mockReset();
    vi.mocked(unpinItemInCollection).mockReset();
    vi.mocked(getLibraryPreferences).mockReset();
    vi.mocked(getLibraryPreferences).mockResolvedValue({
      id: "library",
      pinnedCollectionIds: [],
    });
    vi.mocked(pinCollection).mockReset();
    vi.mocked(unpinCollection).mockReset();
    vi.mocked(movePinnedCollectionBefore).mockReset();
  });

  test("pins a collection from its sidebar menu", async () => {
    const collection = {
      id: "c1",
      name: "Reading",
      createdAt: 1,
      pinnedItemIds: [],
    };
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(listCollections).mockResolvedValue([collection]);
    vi.mocked(pinCollection).mockResolvedValue({
      id: "library",
      pinnedCollectionIds: [collection.id],
    });

    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Reading actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pin to top" }));

    await waitFor(() => {
      expect(pinCollection).toHaveBeenCalledWith(collection.id);
    });
  });

  test("renders persisted pinned collections before unpinned collections", async () => {
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(listCollections).mockResolvedValue([
      { id: "alpha", name: "Alpha", createdAt: 1, pinnedItemIds: [] },
      { id: "beta", name: "Beta", createdAt: 2, pinnedItemIds: [] },
    ]);
    vi.mocked(getLibraryPreferences).mockResolvedValue({
      id: "library",
      pinnedCollectionIds: ["beta"],
    });

    render(<Library />);

    await screen.findByRole("button", { name: "Beta" });
    const collectionButtons = [
      screen.getByRole("button", { name: "Beta" }),
      screen.getByRole("button", { name: "Alpha" }),
    ];
    expect(
      collectionButtons.map((button) => button.compareDocumentPosition(collectionButtons[1])),
    ).toEqual([
      Node.DOCUMENT_POSITION_FOLLOWING,
      0,
    ]);
  });

  test("does not show the empty copy when loading fails", async () => {
    vi.mocked(listItems).mockRejectedValue(new Error("idb down"));
    render(<Library />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load items.",
    );
    expect(screen.queryByText("No items yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  test("ITEMS_CHANGED refresh keeps the grid without Loading", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    render(<Library />);
    expect(await screen.findByText("A persisted note")).toBeInTheDocument();

    let resolveNext!: (value: Item[]) => void;
    vi.mocked(listItems).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNext = resolve;
        }),
    );

    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(screen.getByText("A persisted note")).toBeInTheDocument();

    await waitFor(() => {
      expect(typeof resolveNext).toBe("function");
    });
    resolveNext([note]);
    await waitFor(() => {
      expect(listItems).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(screen.getByText("A persisted note")).toBeInTheDocument();
  });

  test("does not delete until confirm", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    expect(screen.getByText("Delete this item?")).toBeInTheDocument();
    expect(deleteItem).not.toHaveBeenCalled();
  });

  test("cancel leaves the item and does not call deleteItem", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByText("Delete this item?")).not.toBeInTheDocument();
    expect(deleteItem).not.toHaveBeenCalled();
    expect(screen.getByText("A persisted note")).toBeInTheDocument();
  });

  test("confirm deletes the item", async () => {
    vi.mocked(listItems)
      .mockResolvedValueOnce([note])
      .mockResolvedValue([]);
    vi.mocked(deleteItem).mockResolvedValue(undefined);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => {
      expect(deleteItem).toHaveBeenCalledWith("n1");
    });
    expect(await screen.findByText("No items yet.")).toBeInTheDocument();
  });

  test("shows an alert when delete fails and keeps the item", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    vi.mocked(deleteItem).mockRejectedValue(new Error("idb down"));
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete item.",
    );
    expect(screen.getByText("A persisted note")).toBeInTheDocument();
  });

  test("does not save a note edit until Save note", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "changed" },
    });

    expect(updateNote).not.toHaveBeenCalled();
  });

  test("cancel edit restores the original content", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));

    expect(updateNote).not.toHaveBeenCalled();
    expect(screen.getByText("A persisted note")).toBeInTheDocument();
  });

  test("save note edit persists new content", async () => {
    const updated = { ...note, content: "changed", updatedAt: 2 };
    vi.mocked(listItems)
      .mockResolvedValueOnce([note])
      .mockResolvedValue([updated]);
    vi.mocked(updateNote).mockResolvedValue(updated);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith("n1", { content: "changed" });
    });
    expect(await screen.findByText("changed")).toBeInTheDocument();
  });

  test("Ctrl+Enter saves a note edit from the textarea", async () => {
    const updated = { ...note, content: "from shortcut", updatedAt: 2 };
    vi.mocked(listItems)
      .mockResolvedValueOnce([note])
      .mockResolvedValue([updated]);
    vi.mocked(updateNote).mockResolvedValue(updated);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const field = screen.getByLabelText("Note content");
    fireEvent.change(field, { target: { value: "from shortcut" } });
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith("n1", {
        content: "from shortcut",
      });
    });
  });

  test("empty note edit shows a validation alert", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    vi.mocked(updateNote).mockRejectedValue(
      new NoteValidationError("Note content is required"),
    );
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Note content is required",
    );
    expect(screen.getByLabelText("Note content")).toBeInTheDocument();
  });

  test("rejects a javascript URL when saving a link edit", async () => {
    vi.mocked(listItems).mockResolvedValue([link]);
    vi.mocked(updateLink).mockRejectedValue(
      new LinkValidationError("Enter an http or https URL"),
    );
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter an http or https URL",
    );
    expect(updateLink).toHaveBeenCalledWith("l1", {
      url: "javascript:alert(1)",
      title: "",
    });
  });

  test("save link edit persists a new https URL", async () => {
    const updated = { ...link, url: "https://example.com/new", updatedAt: 2 };
    vi.mocked(listItems)
      .mockResolvedValueOnce([link])
      .mockResolvedValue([updated]);
    vi.mocked(updateLink).mockResolvedValue(updated);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://example.com/new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));

    await waitFor(() => {
      expect(updateLink).toHaveBeenCalledWith("l1", {
        url: "https://example.com/new",
        title: "",
      });
    });
    expect(enrichLinkPreview).toHaveBeenCalledWith(
      "l1",
      "https://example.com/new",
    );
    await waitFor(() => {
      expect(
        screen.getAllByRole("link", { name: "example.com/new" })[0],
      ).toHaveAttribute("href", "https://example.com/new");
    });
  });

  test("does not load a remote preview until local preview bytes exist", async () => {
    const ready = {
      ...link,
      previewStatus: "ready" as const,
      previewImageUrl: "https://cdn.example.com/og.png",
      previewTitle: "Example Site",
    };
    vi.mocked(listItems).mockResolvedValue([ready]);
    render(<Library />);

    await screen.findByRole("link", { name: "Example Site" });
    expect(
      document.querySelector('img[src="https://cdn.example.com/og.png"]'),
    ).toBeNull();
    const links = screen.getAllByRole("link", { name: "Example Site" });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com/old");
  });

  test("shows note content and compact link metadata without a letter thumbnail", async () => {
    vi.mocked(listItems).mockResolvedValue([note, link]);
    render(<Library />);

    expect(await screen.findByText("Note")).toBeInTheDocument();
    expect(screen.queryByText("Link")).not.toBeInTheDocument();
    expect(screen.getByText("A persisted note")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "example.com/old" })[0],
    ).toHaveAttribute("href", "https://example.com/old");
    expect(screen.getAllByText("example.com").length).toBeGreaterThanOrEqual(1);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Library pending mutations", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(updateNote).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(createTag).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("does not start a second note save while one is pending", async () => {
    const hold = deferred<typeof note>();
    vi.mocked(listItems).mockResolvedValue([note]);
    vi.mocked(updateNote).mockReturnValue(hold.promise);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    fireEvent.click(await screen.findByRole("button", { name: "Saving…" }));

    expect(updateNote).toHaveBeenCalledTimes(1);
    hold.resolve({ ...note, content: "changed", updatedAt: 2 });
  });

  test("keeps the draft and shows an error when a pending save fails", async () => {
    const hold = deferred<typeof note>();
    vi.mocked(listItems).mockResolvedValue([note]);
    vi.mocked(updateNote).mockReturnValue(hold.promise);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await screen.findByRole("button", { name: "Saving…" });
    hold.reject(new Error("idb down"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save note.",
    );
    expect(screen.getByLabelText("Note content")).toHaveValue("changed");
    expect(screen.getByRole("button", { name: "Cancel edit" })).toBeEnabled();
  });

  test("blocks Edit on another item while a save is pending", async () => {
    const other = buildNote({ content: "other note" }, { id: "n2", now: 2 });
    const hold = deferred<typeof note>();
    vi.mocked(listItems).mockResolvedValue([note, other]);
    vi.mocked(updateNote).mockReturnValue(hold.promise);
    render(<Library />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]!);
    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    expect(await screen.findByRole("button", { name: "Edit" })).toBeDisabled();
    hold.resolve({ ...note, content: "changed", updatedAt: 2 });
  });

  test("cancel cannot run during a pending save", async () => {
    const hold = deferred<typeof note>();
    vi.mocked(listItems).mockResolvedValue([note]);
    vi.mocked(updateNote).mockReturnValue(hold.promise);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    expect(
      await screen.findByRole("button", { name: "Cancel edit" }),
    ).toBeDisabled();

    hold.resolve({ ...note, content: "changed", updatedAt: 2 });
  });
});
describe("Library focus management", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(updateNote).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(createTag).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("moves focus for edit, cancel, and delete confirmation", async () => {
    vi.mocked(listItems)
      .mockResolvedValueOnce([note])
      .mockResolvedValue([]);
    vi.mocked(deleteItem).mockResolvedValue(undefined);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Note content")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm delete" })).toHaveFocus();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => {
      expect(deleteItem).toHaveBeenCalledWith("n1");
    });
    expect(await screen.findByText("No items yet.")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "All items" })).toHaveFocus();
  });
});

describe("Library tags", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(updateNote).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(createTag).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("scan face shows tag chips without empty-state copy", async () => {
    const tagged = { ...note, tagIds: ["t1"], updatedAt: 2 };
    const tag = { id: "t1", name: "inspiration", createdAt: 1 };
    vi.mocked(listItems).mockResolvedValue([tagged]);
    vi.mocked(listTags).mockResolvedValue([tag]);
    render(<Library />);

    const main = await screen.findByRole("main");
    fireEvent.click(await within(main).findByRole("button", { name: "1 tag" }));
    expect(await within(main).findByText("inspiration")).toBeInTheDocument();
    expect(within(main).queryByText("No tags yet.")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Organize" }),
    ).toBeInTheDocument();
  });

  test("opens item organization in a dedicated drawer", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    vi.mocked(listTags).mockResolvedValue([
      { id: "t1", name: "inspiration", createdAt: 1 },
    ]);
    render(<Library />);

    await screen.findByText("A persisted note");
    fireEvent.click(screen.getByRole("button", { name: "Organize" }));

    expect(
      screen.getByRole("dialog", { name: "Organize Untitled" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Add tag")).toBeInTheDocument();
    expect(screen.getByLabelText("Move to collection")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "inspiration" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Add tag"), { target: { value: "in" } });
    expect(screen.getByRole("option", { name: "inspiration" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Add tag"), { key: "Escape" });
    expect(screen.queryByRole("option", { name: "inspiration" })).not.toBeInTheDocument();
  });

  test("adds a tag to an item and shows the name after reload", async () => {
    const tagged = { ...note, tagIds: ["t1"], updatedAt: 2 };
    const tag = { id: "t1", name: "inspiration", createdAt: 1 };
    vi.mocked(listItems)
      .mockResolvedValueOnce([note])
      .mockResolvedValue([tagged]);
    vi.mocked(listTags)
      .mockResolvedValueOnce([])
      .mockResolvedValue([tag]);
    vi.mocked(createTag).mockResolvedValue(tag);
    vi.mocked(assignTagToItem).mockResolvedValue(tagged);
    render(<Library />);

    fireEvent.click(await screen.findByRole("button", { name: "Organize" }));
    fireEvent.change(screen.getByLabelText("Add tag"), {
      target: { value: "inspiration" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith({ name: "inspiration" });
      expect(assignTagToItem).toHaveBeenCalledWith("n1", "t1");
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(await within(screen.getByRole("main")).findByRole("button", { name: "1 tag" }));
    await waitFor(() => {
      expect(
        within(screen.getByRole("main")).getByText("inspiration"),
      ).toBeInTheDocument();
    });
  });

  test("clicking a tag chip filters the library and writes tag to the URL", async () => {
    const other = buildNote({ content: "other note" }, { id: "n2", now: 2 });
    const tagged = { ...note, tagIds: ["t1"], updatedAt: 2 };
    const tag = { id: "t1", name: "inspiration", createdAt: 1 };
    vi.mocked(listItems).mockResolvedValue([tagged, other]);
    vi.mocked(listTags).mockResolvedValue([tag]);
    render(<Library />);

    await screen.findByText("A persisted note");
    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "1 tag" }));
    fireEvent.click(
      within(screen.getByRole("main")).getByRole("button", {
        name: "inspiration",
      }),
    );

    expect(mockNavigation.push).toHaveBeenCalledWith("/?tag=t1", {
      scroll: false,
    });
    expect(screen.getByText("A persisted note")).toBeInTheDocument();
    expect(screen.queryByText("other note")).not.toBeInTheDocument();
    expect(screen.getByText(/Tag:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear tag" }));

    expect(mockNavigation.push).toHaveBeenCalledWith("/", {
      scroll: false,
    });
    expect(screen.getByText("other note")).toBeInTheDocument();
  });

  test("removes a tag from an item without deleting the tag library row", async () => {
    const tagged = { ...note, tagIds: ["t1"], updatedAt: 2 };
    const untagged = { ...note, tagIds: [], updatedAt: 3 };
    const tag = { id: "t1", name: "inspiration", createdAt: 1 };
    vi.mocked(listItems)
      .mockResolvedValueOnce([tagged])
      .mockResolvedValue([untagged]);
    vi.mocked(listTags).mockResolvedValue([tag]);
    vi.mocked(unassignTagFromItem).mockResolvedValue(untagged);
    render(<Library />);

    fireEvent.click(await within(screen.getByRole("main")).findByRole("button", { name: "Untitled" }));
    await within(screen.getByRole("dialog")).findByRole("button", { name: "Remove tag inspiration" });
    fireEvent.click(
      screen.getByRole("button", { name: "Remove tag inspiration" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm remove tag inspiration" }),
    );

    await waitFor(() => {
      expect(unassignTagFromItem).toHaveBeenCalledWith("n1", "t1");
    });
    fireEvent.click(screen.getByRole("button", { name: "Close detail" }));
    await waitFor(() => {
      expect(
        within(screen.getByRole("main")).queryByRole("button", { name: "1 tag" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Tag inspiration" })).toBeInTheDocument();
    expect(listTags).toHaveBeenCalled();
  });
});

describe("Library type filter", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
  });

  test("filters by type and keeps tag AND semantics", async () => {
    const designNote = {
      ...buildNote({ content: "design note" }, { id: "n1", now: 1 }),
      tagIds: ["t1"],
    };
    const designLink = {
      ...buildLink(
        { title: "Design link", url: "https://example.com/design" },
        { id: "l1", now: 2 },
      ),
      tagIds: ["t1"],
    };
    const plainLink = buildLink(
      { title: "Other link", url: "https://example.com/other" },
      { id: "l2", now: 3 },
    );
    vi.mocked(listItems).mockResolvedValue([designNote, designLink, plainLink]);
    vi.mocked(listTags).mockResolvedValue([
      { id: "t1", name: "design", createdAt: 1 },
    ]);
    render(<Library />);

    await screen.findByText("design note");
    pickTopMenu("Filter by type", "Links");

    expect(mockNavigation.push).toHaveBeenCalledWith("/?type=link", {
      scroll: false,
    });
    expect(screen.queryByText("design note")).not.toBeInTheDocument();
    expect(screen.getByText("Design link")).toBeInTheDocument();
    expect(screen.getByText("Other link")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "1 tag" }));
    fireEvent.click(screen.getByRole("button", { name: "design" }));

    expect(mockNavigation.push).toHaveBeenCalledWith("/?tag=t1&type=link", {
      scroll: false,
    });
    expect(screen.getByText("Design link")).toBeInTheDocument();
    expect(screen.queryByText("Other link")).not.toBeInTheDocument();
    expect(screen.queryByText("design note")).not.toBeInTheDocument();

    pickTopMenu("Filter by type", "All types");

    expect(mockNavigation.push).toHaveBeenCalledWith("/?tag=t1", {
      scroll: false,
    });
    expect(screen.getByText("Design link")).toBeInTheDocument();
  });
});

describe("Library collections", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(updateNote).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(createTag).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(renameCollection).mockReset();
    vi.mocked(deleteCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("does not expose collection creation in the sidebar", async () => {
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(listCollections).mockResolvedValue([]);
    render(<Library />);

    expect(await screen.findByText("No collections yet.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New collection" }),
    ).not.toBeInTheDocument();
  });

  test("assigns a collection and browses to only that collection", async () => {
    const other = buildNote({ content: "other note" }, { id: "n2", now: 2 });
    const collection = {
      id: "c1",
      name: "Reading",
      createdAt: 1,
      pinnedItemIds: [],
    };
    const tagged = { ...note, collectionIds: ["c1"], updatedAt: 3 };
    vi.mocked(listItems)
      .mockResolvedValueOnce([note, other])
      .mockResolvedValue([tagged, other]);
    vi.mocked(listCollections)
      .mockResolvedValueOnce([])
      .mockResolvedValue([collection]);
    vi.mocked(createCollection).mockResolvedValue(collection);
    vi.mocked(assignCollectionToItem).mockResolvedValue(tagged);
    render(<Library />);

    await screen.findByText("A persisted note");
    const noteCard = screen.getByText("A persisted note").closest("li")!;
    fireEvent.click(
      within(noteCard).getByRole("button", { name: "Organize" }),
    );
    fireEvent.change(screen.getByLabelText("Move to collection"), {
      target: { value: "Reading" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => {
      expect(createCollection).toHaveBeenCalledWith({ name: "Reading" });
      expect(assignCollectionToItem).toHaveBeenCalledWith("n1", "c1");
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(
      await within(screen.getByRole("complementary", { name: "Sidebar" }))
        .findByRole("button", { name: "Reading" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Sidebar" }))
        .getByRole("button", { name: "Reading" }),
    );

    expect(screen.getByText("A persisted note")).toBeInTheDocument();
    expect(screen.queryByText("other note")).not.toBeInTheDocument();
  });

  test("renames and deletes the selected collection without deleting items", async () => {
    const collection = {
      id: "c1",
      name: "Reading",
      createdAt: 1,
      pinnedItemIds: [],
    };
    const renamed = {
      id: "c1",
      name: "Later",
      createdAt: 1,
      pinnedItemIds: [],
    };
    const tagged = { ...note, collectionIds: ["c1"], updatedAt: 2 };
    const unsorted = { ...note, collectionIds: [], updatedAt: 3 };
    vi.mocked(listItems)
      .mockResolvedValueOnce([tagged])
      .mockResolvedValueOnce([tagged])
      .mockResolvedValue([unsorted]);
    vi.mocked(listCollections)
      .mockResolvedValueOnce([collection])
      .mockResolvedValueOnce([renamed])
      .mockResolvedValue([]);
    vi.mocked(renameCollection).mockResolvedValue(renamed);
    vi.mocked(deleteCollection).mockResolvedValue(undefined);
    render(<Library />);

    fireEvent.click(
      await within(screen.getByRole("complementary", { name: "Sidebar" }))
        .findByRole("button", { name: "Reading" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reading actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Rename collection"), {
      target: { value: "Later" },
    });
    fireEvent.submit(
      screen.getByLabelText("Rename collection").closest("form")!,
    );

    await waitFor(() => {
      expect(renameCollection).toHaveBeenCalledWith("c1", "Later");
    });

    fireEvent.click(
      await within(screen.getByRole("complementary", { name: "Sidebar" }))
        .findByRole("button", { name: "Later" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Later actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete collection?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete collection" }));

    await waitFor(() => {
      expect(deleteCollection).toHaveBeenCalledWith("c1");
    });
    expect(mockNavigation.push).toHaveBeenCalledWith("/", { scroll: false });
    expect(await screen.findByText("A persisted note")).toBeInTheDocument();
  });

  test("deletes a tag through a centered confirmation", async () => {
    const tag = { id: "t1", name: "inspiration", createdAt: 1 };
    vi.mocked(listItems).mockResolvedValue([{ ...note, tagIds: [tag.id] }]);
    vi.mocked(listTags).mockResolvedValueOnce([tag]).mockResolvedValue([]);
    vi.mocked(deleteTag).mockResolvedValue(undefined);
    render(<Library />);

    const sidebar = screen.getByRole("complementary", { name: "Sidebar" });
    fireEvent.click(await within(sidebar).findByRole("button", { name: "Tag inspiration" }));
    fireEvent.click(within(sidebar).getByRole("button", { name: "inspiration actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(screen.getByRole("dialog", { name: "Delete tag?" })).toHaveTextContent(
      "It will be removed from every item",
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete tag" }));

    await waitFor(() => expect(deleteTag).toHaveBeenCalledWith("t1"));
    expect(mockNavigation.push).toHaveBeenCalledWith("/", { scroll: false });
  });

  test("Unsorted shows items that have no collection", async () => {
    const filed = { ...note, collectionIds: ["c1"] };
    const inbox = buildNote({ content: "captured fast" }, { id: "n2", now: 2 });
    vi.mocked(listItems).mockResolvedValue([filed, inbox]);
    vi.mocked(listCollections).mockResolvedValue([
      { id: "c1", name: "Reading", createdAt: 1, pinnedItemIds: [] },
    ]);
    render(<Library />);

    expect(await screen.findByText("A persisted note")).toBeInTheDocument();
    expect(screen.getByText("captured fast")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unsorted" }));

    expect(mockNavigation.push).toHaveBeenCalledWith("/?unsorted=1", {
      scroll: false,
    });
    expect(screen.getByText("captured fast")).toBeInTheDocument();
    expect(screen.queryByText("A persisted note")).not.toBeInTheDocument();
  });
});

describe("Library search", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(updateNote).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(createTag).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("filters items by title, content, URL, and tag names", async () => {
    const designNote = {
      ...buildNote(
        { content: "A persisted note about Design" },
        { id: "n1", now: 1 },
      ),
      tagIds: ["t1"],
    };
    const otherNote = buildNote(
      { content: "grocery list" },
      { id: "n2", now: 2 },
    );
    const docsLink = buildLink(
      { title: "API Docs", url: "https://example.com/guide" },
      { id: "l1", now: 3 },
    );
    vi.mocked(listItems).mockResolvedValue([designNote, otherNote, docsLink]);
    vi.mocked(listTags).mockResolvedValue([
      { id: "t1", name: "inspiration", createdAt: 1 },
    ]);
    render(<Library />);

    await screen.findByText("A persisted note about Design");
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "  DESIGN  " },
    });

    expect(screen.getByText("A persisted note about Design")).toBeInTheDocument();
    expect(screen.queryByText("grocery list")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).queryByRole("link"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "inspiration" },
    });

    expect(screen.getByText("A persisted note about Design")).toBeInTheDocument();
    expect(screen.queryByText("grocery list")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "example.com" },
    });

    expect(screen.getAllByRole("link", { name: "API Docs" })[0]).toHaveAttribute(
      "href",
      "https://example.com/guide",
    );
    expect(
      screen.queryByText("A persisted note about Design"),
    ).not.toBeInTheDocument();
  });
});

describe("Library view state", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(updateNote).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(createTag).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("writes search and sort into the URL", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    render(<Library />);

    await screen.findByText("A persisted note");
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "persisted" },
    });

    expect(mockNavigation.replace).toHaveBeenCalledWith("/?q=persisted", {
      scroll: false,
    });

    pickTopMenu("Sort library", "Oldest");

    expect(mockNavigation.push).toHaveBeenCalledWith(
      "/?q=persisted&sort=oldest",
      { scroll: false },
    );
  });

  test("toggles list layout with replace and keeps filters", async () => {
    vi.mocked(listItems).mockResolvedValue([note, link]);
    render(<Library />);

    await screen.findByText("A persisted note");
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "false");

    expect(mockNavigation.replace).toHaveBeenCalledWith("/?layout=list", {
      scroll: false,
    });
    expect(
      screen.getByRole("button", { name: "Open Untitled" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A persisted note")).toBeInTheDocument();

    pickTopMenu("Filter by type", "Notes");

    expect(mockNavigation.push).toHaveBeenCalledWith(
      "/?type=note&layout=list",
      { scroll: false },
    );
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Open example.com" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("A persisted note")).toBeInTheDocument();
  });

  test("bulk tag dialog applies tags and can remove every selected tag", async () => {
    const tagged = {
      ...buildNote({ content: "one" }, { id: "n1", now: 1 }),
      tagIds: ["t1"],
    };
    const other = buildNote({ content: "two" }, { id: "n2", now: 2 });
    vi.mocked(listItems).mockResolvedValue([tagged, other]);
    vi.mocked(listTags).mockResolvedValue([
      { id: "t1", name: "work", createdAt: 1 },
    ]);
    vi.mocked(createTag).mockResolvedValue({
      id: "t1",
      name: "work",
      createdAt: 1,
    });
    vi.mocked(assignTagToItem).mockResolvedValue(tagged);

    render(<Library />);

    await screen.findByText("one");
    const [first, second] = screen.getAllByRole("checkbox");
    fireEvent.click(first);
    fireEvent.click(second);
    const bulk = screen.getByRole("region", { name: "Bulk actions" });
    fireEvent.click(within(bulk).getByRole("button", { name: "Tags" }));
    expect(screen.getByRole("dialog", { name: "Tags for 2 selected items" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Add tag to selection"), {
      target: { value: "work" },
    });
    const tagInput = screen.getByLabelText("Add tag to selection");
    const tagOption = screen.getByRole("option", { name: "work" });
    expect(tagInput).toHaveAttribute("aria-controls", tagOption.closest("ul")?.id);
    expect(tagOption).toHaveAttribute("aria-selected", "true");
    const tagForm = screen.getByLabelText("Add tag to selection").closest("form");
    fireEvent.click(within(tagForm!).getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith({ name: "work" });
    });
    expect(assignTagToItem).toHaveBeenCalledTimes(2);
    expect(assignTagToItem).toHaveBeenCalledWith("n1", "t1");
    expect(assignTagToItem).toHaveBeenCalledWith("n2", "t1");

    fireEvent.click(screen.getByRole("button", { name: "Remove all tags" }));
    await waitFor(() => {
      expect(unassignTagFromItem).toHaveBeenCalledWith("n1", "t1");
    });
    expect(screen.getByRole("dialog", { name: "Tags for 2 selected items" })).toBeInTheDocument();
  });

  test("select all and deselect all visible items", async () => {
    const one = buildNote({ content: "one" }, { id: "n1", now: 1 });
    const two = buildNote({ content: "two" }, { id: "n2", now: 2 });
    vi.mocked(listItems).mockResolvedValue([one, two]);

    render(<Library />);

    await screen.findByText("one");
    const [first] = screen.getAllByRole("checkbox");
    fireEvent.click(first);
    const bulk = screen.getByRole("region", { name: "Bulk actions" });
    expect(within(bulk).getByRole("button", { name: "Deselect all" })).toBeInTheDocument();
    expect(within(bulk).getByRole("button", { name: "Select all" })).toBeInTheDocument();

    fireEvent.click(within(bulk).getByRole("button", { name: "Select all" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(within(bulk).getByRole("button", { name: "Deselect all" }));
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  test("clear selection with Escape when inspect is closed", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    render(<Library />);

    await screen.findByText("A persisted note");
    const [checkbox] = screen.getAllByRole("checkbox");
    fireEvent.click(checkbox);
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });

  test("drops an item onto a collection to move it", async () => {
    const movable = buildNote({ content: "move me" }, { id: "n1", now: 1 });
    const collection = {
      id: "c1",
      name: "Reading",
      createdAt: 1,
      pinnedItemIds: [],
    };
    vi.mocked(listItems).mockResolvedValue([movable]);
    vi.mocked(listCollections).mockResolvedValue([collection]);
    vi.mocked(assignCollectionToItem).mockResolvedValue({
      ...movable,
      collectionIds: ["c1"],
      updatedAt: 2,
    });

    render(<Library />);
    await screen.findByText("move me");

    const dataTransfer = {
      dropEffect: "none" as const,
      effectAllowed: "none" as const,
      types: [] as string[],
      _store: {} as Record<string, string>,
      setData(type: string, value: string) {
        this._store[type] = value;
        this.types = Object.keys(this._store);
      },
      getData(type: string) {
        return this._store[type] ?? "";
      },
    };

    fireEvent.dragStart(screen.getByRole("listitem"), { dataTransfer });
    const target = screen.getByRole("button", { name: "Reading" });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    await waitFor(() => {
      expect(assignCollectionToItem).toHaveBeenCalledWith("n1", "c1");
    });
  });

  test("drops a selection onto a collection", async () => {
    const first = buildNote({ content: "one" }, { id: "n1", now: 1 });
    const second = buildNote({ content: "two" }, { id: "n2", now: 2 });
    const collection = {
      id: "c1",
      name: "Reading",
      createdAt: 1,
      pinnedItemIds: [],
    };
    vi.mocked(listItems).mockResolvedValue([first, second]);
    vi.mocked(listCollections).mockResolvedValue([collection]);
    vi.mocked(assignCollectionToItem).mockImplementation(async (id) => {
      const item = id === "n1" ? first : second;
      return { ...item, collectionIds: ["c1"], updatedAt: 3 };
    });

    render(<Library />);
    await screen.findByText("one");

    const dataTransfer = {
      dropEffect: "none" as const,
      effectAllowed: "none" as const,
      types: [LIBRARY_ITEM_DRAG_MIME],
      getData(type: string) {
        if (type === LIBRARY_ITEM_DRAG_MIME) {
          return encodeLibraryDragIds(["n1", "n2"]);
        }
        return "";
      },
      setData() {},
    };

    const target = screen.getByRole("button", { name: "Reading" });
    fireEvent.drop(target, { dataTransfer });

    await waitFor(() => {
      expect(assignCollectionToItem).toHaveBeenCalledTimes(2);
    });
  });

  test("pins an item when browsing a collection", async () => {
    const pinnedNote = buildNote({ content: "pin me" }, { id: "n1", now: 1 });
    const collection = {
      id: "c1",
      name: "Reading",
      createdAt: 1,
      pinnedItemIds: [],
    };
    vi.mocked(listItems).mockResolvedValue([
      { ...pinnedNote, collectionIds: ["c1"] },
    ]);
    vi.mocked(listCollections).mockResolvedValue([collection]);
    vi.mocked(pinItemInCollection).mockResolvedValue({
      ...collection,
      pinnedItemIds: ["n1"],
    });

    mockNavigation.replace("/?collection=c1");
    render(<Library />);

    await screen.findByText("pin me");
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));

    await waitFor(() => {
      expect(pinItemInCollection).toHaveBeenCalledWith("c1", "n1");
    });
  });

  test("sorts visible items oldest first", async () => {
    const older = buildNote({ content: "older note" }, { id: "n1", now: 1 });
    const newer = buildNote({ content: "newer note" }, { id: "n2", now: 2 });
    vi.mocked(listItems).mockResolvedValue([newer, older]);
    render(<Library />);

    await screen.findByText("newer note");
    pickTopMenu("Sort library", "Oldest");

    const texts = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    const olderIndex = texts.findIndex((text) => text.includes("older note"));
    const newerIndex = texts.findIndex((text) => text.includes("newer note"));
    expect(olderIndex).toBeGreaterThanOrEqual(0);
    expect(newerIndex).toBeGreaterThanOrEqual(0);
    expect(olderIndex).toBeLessThan(newerIndex);
  });
});

describe("Library inspect", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(updateNote).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(listTags).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(createTag).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("opens detail from the card and sets item in the URL", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    render(<Library />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Read Untitled" }),
    );

    expect(mockNavigation.push).toHaveBeenCalled();
    const href = String(mockNavigation.push.mock.calls.at(-1)?.[0] ?? "");
    expect(href).toContain("item=n1");
    expect(
      await screen.findByRole("dialog", { name: "Untitled" }),
    ).toBeInTheDocument();
  });

  test("image inspect can add a gallery slide and update slide in the URL", async () => {
    const image = buildImage({ assetId: "a1" }, { id: "i1", now: 1 });
    const withTwo = { ...image, assetIds: ["a1", "a2"] as string[] };
    const withThree = { ...image, assetIds: ["a1", "a2", "a3"] as string[] };
    vi.mocked(listItems).mockResolvedValue([image]);
    let appendCount = 0;
    vi.mocked(appendImageAssetToItem).mockImplementation(async () => {
      appendCount += 1;
      const next = appendCount >= 2 ? withThree : withTwo;
      vi.mocked(listItems).mockResolvedValue([next]);
      return next;
    });

    render(<Library />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Image" }));

    const dialog = await screen.findByRole("dialog", { name: "Image" });
    const fileInputs = dialog.querySelectorAll('input[type="file"]');

    fireEvent.change(fileInputs[0]!, {
      target: {
        files: [
          new File([new Uint8Array([1, 2])], "two.png", { type: "image/png" }),
          new File([new Uint8Array([3, 4])], "three.png", { type: "image/png" }),
        ],
      },
    });

    await waitFor(() => {
      expect(appendImageAssetToItem).toHaveBeenCalledTimes(2);
      expect(appendImageAssetToItem).toHaveBeenNthCalledWith(1, "i1", {
        bytes: expect.any(Uint8Array),
        mimeType: "image/png",
      });
      expect(appendImageAssetToItem).toHaveBeenNthCalledWith(2, "i1", {
        bytes: expect.any(Uint8Array),
        mimeType: "image/png",
      });
      expect(
        String(mockNavigation.replace.mock.calls.at(-1)?.[0] ?? ""),
      ).toContain("slide=2");
    });
  });
});
