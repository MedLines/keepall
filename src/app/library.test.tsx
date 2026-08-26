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
  updateLink,
  updateNote,
} from "@/persistence/items";
import { createCollection, listCollections } from "@/persistence/collections";
import { createTag, listTags } from "@/persistence/tags";
import { mockNavigation } from "../../vitest.setup";
import { enrichLinkPreview } from "./enrich-link-preview";
import { ITEMS_CHANGED_EVENT } from "./items-events";
import { Library } from "./library";
import type { Item } from "@/domain/item";

vi.mock("@/persistence/items", () => ({
  listItems: vi.fn(),
  deleteItem: vi.fn(),
  updateNote: vi.fn(),
  updateLink: vi.fn(),
  updateImage: vi.fn(),
  appendImageAssetToItem: vi.fn(),
  replaceImageAssetAtIndex: vi.fn(),
  assignTagToItem: vi.fn(),
  assignCollectionToItem: vi.fn(),
}));

vi.mock("./enrich-link-preview", () => ({
  enrichLinkPreview: vi.fn(),
}));

vi.mock("@/persistence/tags", () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
}));

vi.mock("@/persistence/collections", () => ({
  listCollections: vi.fn(),
  createCollection: vi.fn(),
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
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
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
    expect(
      (await screen.findAllByRole("link", { name: "example.com" }))[0],
    ).toHaveAttribute("href", "https://example.com/new");
  });

  test("shows preview image when ready with image URL", async () => {
    const ready = {
      ...link,
      previewStatus: "ready" as const,
      previewImageUrl: "https://cdn.example.com/og.png",
      previewTitle: "Example Site",
    };
    vi.mocked(listItems).mockResolvedValue([ready]);
    render(<Library />);

    await waitFor(() => {
      expect(
        document.querySelector('img[src="https://cdn.example.com/og.png"]'),
      ).not.toBeNull();
    });
    const links = screen.getAllByRole("link", { name: "Example Site" });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com/old");
  });

  test("shows card initial, type chip, and secondary line", async () => {
    vi.mocked(listItems).mockResolvedValue([note, link]);
    render(<Library />);

    expect(await screen.findByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("A persisted note")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "example.com" })[0],
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
    expect(
      screen.getByRole("button", { name: "Confirm delete" }),
    ).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => {
      expect(deleteItem).toHaveBeenCalledWith("n1");
    });
    expect(await screen.findByText("No items yet.")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Library" })).toHaveFocus();
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

    expect(await screen.findByText("inspiration")).toBeInTheDocument();
    expect(screen.queryByText("No tags yet.")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add tag" }),
    ).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: "Add tag" }));
    fireEvent.change(screen.getByPlaceholderText("Tag name"), {
      target: { value: "inspiration" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith({ name: "inspiration" });
      expect(assignTagToItem).toHaveBeenCalledWith("n1", "t1");
    });
    expect(await screen.findByText("inspiration")).toBeInTheDocument();
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
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("assigns a collection and browses to only that collection", async () => {
    const other = buildNote({ content: "other note" }, { id: "n2", now: 2 });
    const collection = { id: "c1", name: "Reading", createdAt: 1 };
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
      within(noteCard).getByRole("button", { name: "Add to collection" }),
    );
    fireEvent.change(document.getElementById("add-collection-n1")!, {
      target: { value: "Reading" },
    });
    fireEvent.click(within(noteCard).getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createCollection).toHaveBeenCalledWith({ name: "Reading" });
      expect(assignCollectionToItem).toHaveBeenCalledWith("n1", "c1");
    });
    expect(await screen.findByRole("button", { name: "Reading" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reading" }));

    expect(screen.getByText("A persisted note")).toBeInTheDocument();
    expect(screen.queryByText("other note")).not.toBeInTheDocument();
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
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("filters items by title, content, and URL without matching tags", async () => {
    const designNote = buildNote(
      { content: "A persisted note about Design" },
      { id: "n1", now: 1 },
    );
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
      { id: "t1", name: "design", createdAt: 1 },
    ]);
    render(<Library />);

    await screen.findByText("A persisted note about Design");
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "  DESIGN  " },
    });

    expect(screen.getByText("A persisted note about Design")).toBeInTheDocument();
    expect(screen.queryByText("grocery list")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

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

    fireEvent.click(screen.getByRole("button", { name: "Oldest" }));

    expect(mockNavigation.replace).toHaveBeenCalledWith(
      "/?q=persisted&sort=oldest",
      { scroll: false },
    );
  });

  test("sorts visible items oldest first", async () => {
    const older = buildNote({ content: "older note" }, { id: "n1", now: 1 });
    const newer = buildNote({ content: "newer note" }, { id: "n2", now: 2 });
    vi.mocked(listItems).mockResolvedValue([newer, older]);
    render(<Library />);

    await screen.findByText("newer note");
    fireEvent.click(screen.getByRole("button", { name: "Oldest" }));

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
    vi.mocked(listCollections).mockReset();
    vi.mocked(listCollections).mockResolvedValue([]);
    vi.mocked(createCollection).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
  });

  test("opens detail from the card and sets item in the URL", async () => {
    vi.mocked(listItems).mockResolvedValue([note]);
    render(<Library />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Open Untitled" }),
    );

    expect(mockNavigation.replace).toHaveBeenCalled();
    const href = String(mockNavigation.replace.mock.calls.at(-1)?.[0] ?? "");
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
