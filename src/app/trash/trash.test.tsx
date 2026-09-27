import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import { listTrashedItems, permanentlyDeleteItem, restoreItem } from "@/persistence/items";
import { Trash } from "./trash";

vi.mock("@/persistence/items", () => ({ listTrashedItems: vi.fn(), permanentlyDeleteItem: vi.fn(), restoreItem: vi.fn() }));
const note = { ...buildNote({ content: "Keep me", title: "Saved note" }, { id: "note", now: 1 }), deletedAt: 2 };

beforeEach(() => {
  vi.mocked(listTrashedItems).mockReset().mockResolvedValue([note]);
  vi.mocked(restoreItem).mockReset();
  vi.mocked(permanentlyDeleteItem).mockReset();
});

test("load failure offers a retry without claiming Trash is empty", async () => {
  vi.mocked(listTrashedItems).mockRejectedValueOnce(new Error("offline db"));
  render(<Trash />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load Trash");
  expect(screen.queryByText("Trash is empty")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Saved note" })).toBeInTheDocument();
});

test("restore disables conflicting actions, retains failed items and supports retry", async () => {
  let fail!: (error: Error) => void;
  vi.mocked(restoreItem).mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  render(<Trash />);
  fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
  expect(screen.getByRole("button", { name: "Delete permanently" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  await act(async () => { fail(new Error("write failed")); });
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't restore");
  expect(screen.getByRole("heading", { name: "Saved note" })).toBeInTheDocument();
  vi.mocked(listTrashedItems).mockResolvedValue([]);
  vi.mocked(restoreItem).mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  expect(await screen.findByText("Trash is empty")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("restored to your library");
});

test("permanent deletion requires confirmation and keeps the dialog on failure", async () => {
  vi.mocked(permanentlyDeleteItem).mockRejectedValueOnce(new Error("write failed"));
  render(<Trash />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete permanently" }));
  const dialog = screen.getByRole("dialog");
  expect(permanentlyDeleteItem).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete permanently" }));
  await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Couldn't permanently delete"));
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(await screen.findByRole("heading", { name: "Saved note" })).toBeInTheDocument();
});
