import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import { deleteItem, listItems } from "@/persistence/items";
import { Library } from "./library";

vi.mock("@/persistence/items", () => ({
  listItems: vi.fn(),
  deleteItem: vi.fn(),
}));

const note = buildNote({ content: "A persisted note" }, { id: "n1", now: 1 });

describe("Library", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(deleteItem).mockReset();
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
});
