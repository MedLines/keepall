import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import { createCollection, listCollections } from "@/persistence/collections";
import { clearCollectionOnItem, assignCollectionToItem, assignTagToItem, deleteItem, getItem, saveNoteWithImages, unassignTagFromItem } from "@/persistence/items";
import { createTag, listTags } from "@/persistence/tags";
import { NoteItemPage } from "./note-item-page";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock("@/persistence/items", () => ({
  clearCollectionOnItem: vi.fn(), getItem: vi.fn(), saveNoteWithImages: vi.fn(), deleteItem: vi.fn(),
  assignTagToItem: vi.fn(), unassignTagFromItem: vi.fn(), assignCollectionToItem: vi.fn(),
}));
vi.mock("@/persistence/tags", () => ({ createTag: vi.fn(), listTags: vi.fn() }));
vi.mock("@/persistence/collections", () => ({ createCollection: vi.fn(), listCollections: vi.fn() }));

describe("NoteItemPage", () => {
  beforeEach(() => {
    vi.mocked(getItem).mockReset();
    vi.mocked(saveNoteWithImages).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(assignTagToItem).mockReset();
    vi.mocked(unassignTagFromItem).mockReset();
    vi.mocked(assignCollectionToItem).mockReset();
    vi.mocked(createTag).mockReset();
    vi.mocked(createCollection).mockReset();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(listCollections).mockResolvedValue([]);
    routerPush.mockReset();
  });

  test("renders the library handoff while IndexedDB revalidation is pending", () => {
    const item = buildNote({ content: "Ready before navigation" }, { id: "note-handoff", now: 1 });
    vi.mocked(getItem).mockReturnValue(new Promise(() => {}));
    render(<NoteItemPage itemId={item.id} returnHref="/" initialSnapshot={{ item, tags: [], collections: [], animate: true }} />);
    expect(screen.queryByText(/Loading (item|image|note)/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ready before navigation" })).toBeVisible();
  });

  test("uses a short item label in Trash and organize when a saved title contains an article", async () => {
    const article = "Component Playground\n\n" + "A long article about components. ".repeat(100);
    vi.mocked(getItem).mockResolvedValue(buildNote({ title: article, content: article }, { id: "long-note" }));
    render(<NoteItemPage itemId="long-note" returnHref="/" />);
    await screen.findByRole("button", { name: "Organize" });
    fireEvent.click(screen.getByRole("button", { name: "Move note to Trash" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Move “Component Playground” to Trash?");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("A long article");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Organize" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Organize Component Playground");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("A long article");
  });

  test("shows a note's collection and tags and organizes it", async () => {
    const note = {
      ...buildNote({ content: "Card ideas" }, { id: "n3", now: 1 }),
      collectionIds: ["c1"], tagIds: ["t1"],
    };
    vi.mocked(getItem).mockResolvedValue(note);
    vi.mocked(listCollections).mockResolvedValue([
      { id: "c1", name: "Inspiration", createdAt: 1, pinnedItemIds: [] },
      { id: "c2", name: "Writing", createdAt: 1, pinnedItemIds: [] },
    ]);
    vi.mocked(listTags).mockResolvedValue([
      { id: "t1", name: "visual", createdAt: 1 },
      { id: "t2", name: "review", createdAt: 1 },
    ]);
    vi.mocked(createTag).mockResolvedValue({ id: "t2", name: "review", createdAt: 1 });
    vi.mocked(assignTagToItem).mockResolvedValue({ ...note, tagIds: ["t1", "t2"] });
    vi.mocked(unassignTagFromItem).mockResolvedValue({ ...note, tagIds: ["t2"] });
    vi.mocked(createCollection).mockResolvedValue({ id: "c2", name: "Writing", createdAt: 1, pinnedItemIds: [] });
    vi.mocked(assignCollectionToItem).mockResolvedValue({ ...note, collectionIds: ["c2"], tagIds: ["t2"] });

    render(<NoteItemPage itemId="n3" returnHref="/" />);

    const details = await screen.findByRole("complementary", { name: "Note details" });
    expect(details).toHaveTextContent("Inspiration");
    expect(details).toHaveTextContent("visual");
    expect(screen.getByRole("link", { name: "Inspiration" })).toHaveAttribute("href", "/?collection=c1");
    expect(screen.getByRole("link", { name: "visual" })).toHaveAttribute("href", "/?tag=t1");

    fireEvent.click(screen.getByRole("button", { name: "Organize" }));
    const tagInput = screen.getByRole("textbox", { name: "Add tag" });
    fireEvent.change(tagInput, { target: { value: "review" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Add tag" }), { key: "Enter" });
    await waitFor(() => expect(assignTagToItem).toHaveBeenCalledWith("n3", "t2"));
    expect(details).toHaveTextContent("review");

    fireEvent.click(screen.getByRole("button", { name: "Remove tag visual" }));
    await waitFor(() => expect(unassignTagFromItem).toHaveBeenCalledWith("n3", "t1"));
    expect(details).not.toHaveTextContent("visual");

    const collectionInput = screen.getByRole("textbox", { name: "Move to collection" });
    fireEvent.change(collectionInput, { target: { value: "Writing" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Move to collection" }), { key: "Enter" });
    await waitFor(() => expect(assignCollectionToItem).toHaveBeenCalledWith("n3", "c2"));
    expect(details).toHaveTextContent("Writing");
    expect(details).not.toHaveTextContent("Inspiration");
  });

  test("reads the whole Markdown note on a page and saves an edit", async () => {
    const note = buildNote({ content: "# Image card redesign\n\nThe image should lead.\n\n## Details\n\nMore content below.", format: "markdown" }, { id: "n1", now: 1 });
    vi.mocked(getItem).mockResolvedValue(note);
    vi.mocked(saveNoteWithImages).mockResolvedValue({ ...note, content: "# Revised card\n\nBetter spacing.", updatedAt: 2 });

    render(<NoteItemPage itemId="n1" returnHref="/?tag=design" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Image card redesign" })).toBeVisible();
    expect(screen.getByText("More content below.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/?tag=design");

    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    const editorDialog = screen.getByRole("dialog", { name: "Edit note" });
    expect(within(editorDialog).getByRole("button", { name: "Edit" })).toBeVisible();
    const buttons = within(editorDialog).getAllByRole("button");
    expect(buttons.indexOf(within(editorDialog).getByRole("button", { name: "Cancel edit" })))
      .toBeLessThan(buttons.indexOf(within(editorDialog).getByRole("button", { name: "Save note" })));
    fireEvent.change(screen.getByRole("textbox", { name: "Note content" }), { target: { value: "# Revised card\n\nBetter spacing." } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => expect(saveNoteWithImages).toHaveBeenCalledWith("n1", { content: "# Revised card\n\nBetter spacing.", format: "markdown" }, []));
    expect(await screen.findByRole("heading", { level: 1, name: "Revised card" })).toBeVisible();
  });

  test("inserts an image at the cursor and saves its bytes with the note", async () => {
    const note = buildNote({ content: "Heading\n\nBefore\n\nAfter" }, { id: "n-image", now: 1 });
    vi.mocked(getItem).mockResolvedValue(note);
    vi.mocked(saveNoteWithImages).mockImplementation(async (_id, input) => ({
      ...note,
      content: input.content.replace(/keepall-image:[A-Za-z0-9_-]+/, "keepall-image:saved-image"),
    }));
    const createObjectURL = vi.fn(() => "blob:pending-image");
    const revokeObjectURL = vi.fn();
    const previousCreate = URL.createObjectURL;
    const previousRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    try {
      render(<NoteItemPage itemId="n-image" returnHref="/" />);
      await screen.findByRole("heading", { name: "Heading" });
      fireEvent.click(screen.getByRole("button", { name: "Add image" }));
      const editor = screen.getByRole("textbox", { name: "Note content" }) as HTMLTextAreaElement;
      const cursor = editor.value.indexOf("After");
      editor.setSelectionRange(cursor, cursor);
      fireEvent.click(screen.getByRole("button", { name: "Add image at cursor" }));
      const file = new File([new Uint8Array([1, 2, 3])], "study.png", { type: "image/png" });
      Object.defineProperty(file, "arrayBuffer", { value: async () => new Uint8Array([1, 2, 3]).buffer });
      fireEvent.change(screen.getByLabelText("Choose note images"), { target: { files: [file] } });
      await waitFor(() => expect(editor.value).toMatch(/Before\n\n!\[Image\]\(keepall-image:[A-Za-z0-9_-]+\)\n\nAfter/));
      expect(screen.getByRole("region", { name: "Images in this note" })).toHaveTextContent("Image 1");
      expect(screen.getByRole("button", { name: "Remove image 1" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Preview" }));
      expect(screen.getByRole("img", { name: "Image" })).toHaveAttribute("src", "blob:pending-image");
      fireEvent.click(screen.getByRole("button", { name: "Save note" }));
      await waitFor(() => expect(saveNoteWithImages).toHaveBeenCalledWith(
        "n-image",
        expect.objectContaining({ content: expect.stringContaining("keepall-image:") }),
        [expect.objectContaining({ mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) })],
      ));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:pending-image");
    } finally {
      URL.createObjectURL = previousCreate;
      URL.revokeObjectURL = previousRevoke;
    }
  });

  test("removes a saved inline image with a button instead of editing its marker", async () => {
    const note = buildNote({
      content: "Heading\n\nBefore\n\n![Image](keepall-image:saved-image)\n\nAfter",
      format: "markdown",
    }, { id: "n-saved-image", now: 1 });
    vi.mocked(getItem).mockResolvedValue(note);
    vi.mocked(saveNoteWithImages).mockImplementation(async (_id, input) => ({ ...note, content: input.content }));

    render(<NoteItemPage itemId={note.id} returnHref="/" />);
    await screen.findByRole("heading", { name: "Heading" });
    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    expect(screen.getByRole("region", { name: "Images in this note" })).toHaveTextContent("Image 1");
    fireEvent.click(screen.getByRole("button", { name: "Remove image 1" }));
    expect(screen.getByRole("textbox", { name: "Note content" })).toHaveValue("Heading\n\nBefore\n\nAfter");
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() => expect(saveNoteWithImages).toHaveBeenCalledWith(note.id, {
      content: "Heading\n\nBefore\n\nAfter", format: "markdown",
    }, []));
  });

  test("deletes only after confirmation and returns to the library", async () => {
    vi.mocked(getItem).mockResolvedValue(buildNote({ content: "Quiet card" }, { id: "n2", now: 1 }));
    vi.mocked(deleteItem).mockResolvedValue();
    render(<NoteItemPage itemId="n2" returnHref="/" />);
    await screen.findByRole("heading", { level: 1, name: "Quiet card" });

    fireEvent.click(screen.getByRole("button", { name: "Move note to Trash" }));
    expect(deleteItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));
    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith("n2"));
    expect(routerPush).toHaveBeenCalledWith("/");
  });
});


test("moves note to Unsorted with busy protection, error retry, immediate state and retained tags", async () => {
  const original = { ...buildNote({ content: "Keep" }, { id: "unsorted-test", now: 1 }), tagIds: ["t"], collectionIds: ["c"] };
  let stored = original;
  vi.mocked(getItem).mockImplementation(async () => stored);
  vi.mocked(listTags).mockResolvedValue([{ id: "t", name: "Reference", createdAt: 1 }]);
  vi.mocked(listCollections).mockResolvedValue([{ id: "c", name: "Reading", createdAt: 1, pinnedItemIds: [] }]);
  let reject!: (reason: Error) => void;
  vi.mocked(clearCollectionOnItem).mockReset().mockImplementationOnce(() => new Promise((_resolve, no) => { reject = no; })).mockImplementationOnce(async () => {
    stored = { ...original, collectionIds: [], updatedAt: 2 };
    return stored;
  });
  const changed = vi.fn();
  window.addEventListener("keepall:items-changed", changed);
  render(<NoteItemPage itemId="unsorted-test" returnHref="/" />);
  fireEvent.click(await screen.findByRole("button", { name: "Organize" }));
  fireEvent.click(screen.getByRole("button", { name: "Unsorted" }));
  expect(screen.getByRole("button", { name: "Unsorted" })).toBeDisabled();
  reject(new Error("failed"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Unsorted" })).toBeEnabled());
  expect(screen.getByRole("dialog")).toHaveTextContent("Couldn't");
  fireEvent.click(screen.getByRole("button", { name: "Unsorted" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Unsorted" })).toHaveAttribute("aria-pressed", "true"));
  expect(screen.getByRole("dialog")).toHaveTextContent("Reference");
  expect(screen.getByRole("button", { name: "Unsorted" })).toHaveAttribute("aria-pressed", "true");
  expect(clearCollectionOnItem).toHaveBeenCalledTimes(2);
  expect(createCollection).not.toHaveBeenCalled();
  expect(stored).toEqual({ ...original, collectionIds: [], updatedAt: 2 });
  expect(changed).toHaveBeenCalledOnce();
  window.removeEventListener("keepall:items-changed", changed);
});
