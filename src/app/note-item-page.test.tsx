import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import { deleteItem, getItem, updateNote } from "@/persistence/items";
import { NoteItemPage } from "./note-item-page";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock("@/persistence/items", () => ({ getItem: vi.fn(), updateNote: vi.fn(), deleteItem: vi.fn() }));

describe("NoteItemPage", () => {
  beforeEach(() => {
    vi.mocked(getItem).mockReset();
    vi.mocked(updateNote).mockReset();
    vi.mocked(deleteItem).mockReset();
    routerPush.mockReset();
  });

  test("reads the whole Markdown note on a page and saves an edit", async () => {
    const note = buildNote({ content: "# Image card redesign\n\nThe image should lead.\n\n## Details\n\nMore content below.", format: "markdown" }, { id: "n1", now: 1 });
    vi.mocked(getItem).mockResolvedValue(note);
    vi.mocked(updateNote).mockResolvedValue({ ...note, content: "# Revised card\n\nBetter spacing.", updatedAt: 2 });

    render(<NoteItemPage itemId="n1" returnHref="/?tag=design" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Image card redesign" })).toBeVisible();
    expect(screen.getByText("More content below.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/?tag=design");

    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Note content" }), { target: { value: "# Revised card\n\nBetter spacing." } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => expect(updateNote).toHaveBeenCalledWith("n1", { content: "# Revised card\n\nBetter spacing.", format: "markdown" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Revised card" })).toBeVisible();
  });

  test("deletes only after confirmation and returns to the library", async () => {
    vi.mocked(getItem).mockResolvedValue(buildNote({ content: "Quiet card" }, { id: "n2", now: 1 }));
    vi.mocked(deleteItem).mockResolvedValue();
    render(<NoteItemPage itemId="n2" returnHref="/" />);
    await screen.findByRole("heading", { level: 1, name: "Quiet card" });

    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    expect(deleteItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith("n2"));
    expect(routerPush).toHaveBeenCalledWith("/");
  });
});
