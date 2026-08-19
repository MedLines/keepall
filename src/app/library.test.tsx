import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildLink, LinkValidationError } from "@/domain/link";
import { buildNote, NoteValidationError } from "@/domain/note";
import { deleteItem, listItems, updateLink, updateNote } from "@/persistence/items";
import { Library } from "./library";

vi.mock("@/persistence/items", () => ({
  listItems: vi.fn(),
  deleteItem: vi.fn(),
  updateNote: vi.fn(),
  updateLink: vi.fn(),
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
    expect(
      await screen.findByRole("link", { name: "https://example.com/new" }),
    ).toBeInTheDocument();
  });
});
