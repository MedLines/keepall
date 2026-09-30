import { useRef } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import { emptyTrash, permanentlyDeleteItem, restoreItem, restoreItems } from "@/persistence/items";
import { useLibraryTrashActions } from "./library-trash-actions";

vi.mock("@/persistence/items", () => ({ emptyTrash: vi.fn(), permanentlyDeleteItem: vi.fn(), restoreItem: vi.fn(), restoreItems: vi.fn() }));
const note = { ...buildNote({ content: "Keep me" }, { id: "note", now: 1 }), deletedAt: 2 };
function Harness({ onItemsRemoved, selectedIds = ["note", "other"], hiddenCount = 1 }: { onItemsRemoved?: (ids: string[]) => void; selectedIds?: string[]; hiddenCount?: number }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const actions = useLibraryTrashActions(heading, onItemsRemoved);
  return <><h1 ref={heading} tabIndex={-1}>Trash</h1>
    <button disabled={actions.busy} onClick={() => actions.restore(note)}>Restore</button>
    <button onClick={() => actions.restoreSelected(selectedIds)}>Restore selected</button>
    <button disabled={actions.busy} onClick={() => actions.requestEmpty([note])}>Empty</button>
    <button disabled={actions.busy} onClick={() => actions.requestDelete(note)}>Delete</button>
    <button disabled={actions.busy} onClick={() => actions.requestDeleteSelected(selectedIds, hiddenCount)}>Delete selection</button>
    {actions.error ? <p role="alert">{actions.error}</p> : null}
    <p role="status">{actions.notice}</p>{actions.dialog}</>;
}

beforeEach(() => vi.resetAllMocks());

test("restore disables conflicting actions and supports failure retry", async () => {
  let fail!: (error: Error) => void;
  vi.mocked(restoreItem).mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  expect(screen.getByRole("button", { name: "Empty" })).toBeDisabled();
  await act(async () => { fail(new Error("write failed")); });
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
  vi.mocked(restoreItem).mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  await screen.findByText("Keep me restored to your library.");
  expect(screen.getByRole("heading")).toHaveFocus();
});

test("empty Trash requires confirmation, supports cancellation and retains failure dialog", async () => {
  vi.mocked(emptyTrash).mockRejectedValueOnce(new Error("write failed"));
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Empty" }));
  expect(emptyTrash).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Empty" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Empty Trash" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
  expect(emptyTrash).toHaveBeenCalledWith(["note"]);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("single permanent deletion also requires confirmation", async () => {
  vi.mocked(permanentlyDeleteItem).mockResolvedValue(undefined);
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(permanentlyDeleteItem).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete permanently" }));
  await screen.findByText("Item permanently deleted.");
  expect(permanentlyDeleteItem).toHaveBeenCalledWith("note");
});

test("selected deletion retains selection on cancel or failure and removes only confirmed ids on success", async () => {
  const onItemsRemoved = vi.fn();
  vi.mocked(emptyTrash).mockRejectedValueOnce(new Error("write failed")).mockResolvedValue(undefined);
  render(<Harness onItemsRemoved={onItemsRemoved} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete selection" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("2 selected items");
  expect(screen.getByRole("dialog")).toHaveTextContent("1 selected item is hidden by search or filters");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(emptyTrash).not.toHaveBeenCalled();
  expect(onItemsRemoved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete selection" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
  expect(onItemsRemoved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
  await screen.findByText("Selected items permanently deleted.");
  expect(emptyTrash).toHaveBeenLastCalledWith(["note", "other"]);
  expect(onItemsRemoved).toHaveBeenCalledExactlyOnceWith(["note", "other"]);
  expect(permanentlyDeleteItem).not.toHaveBeenCalled();
});

test("permanent deletion uses the IDs and hidden count captured when the dialog opened", async () => {
  vi.mocked(emptyTrash).mockResolvedValue(undefined);
  const { rerender } = render(<Harness selectedIds={["note", "other"]} hiddenCount={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete selection" }));
  const dialog = screen.getByRole("dialog", { name: "Permanently delete selected items?" });
  rerender(<Harness selectedIds={["new"]} hiddenCount={0} />);
  expect(dialog).toHaveTextContent("2 selected items");
  expect(dialog).toHaveTextContent("1 selected item is hidden");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete permanently" }));
  await screen.findByText("Selected items permanently deleted.");
  expect(emptyTrash).toHaveBeenCalledExactlyOnceWith(["note", "other"]);
});


test("selected restore captures IDs, guards pending work and reports only actual restored IDs", async () => {
  const onItemsRemoved = vi.fn();
  const event = vi.fn();
  window.addEventListener("keepall:items-changed", event);
  let finish!: (ids: string[]) => void;
  vi.mocked(restoreItems).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const ids = ["note", "other", "note"];
  const { rerender } = render(<Harness onItemsRemoved={onItemsRemoved} selectedIds={ids} />);
  fireEvent.click(screen.getByRole("button", { name: "Restore selected" }));
  ids.push("late");
  rerender(<Harness onItemsRemoved={onItemsRemoved} selectedIds={["new"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Restore selected" }));
  expect(restoreItems).toHaveBeenCalledExactlyOnceWith(["note", "other"]);
  expect(screen.getByRole("button", { name: "Delete selection" })).toBeDisabled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await act(async () => { finish(["note"]); });
  expect(screen.getByRole("status")).toHaveTextContent("1 item restored to your library.");
  expect(onItemsRemoved).toHaveBeenCalledExactlyOnceWith(["note"]);
  expect(screen.getByRole("heading")).toHaveFocus();
  expect(event).toHaveBeenCalledOnce();
  window.removeEventListener("keepall:items-changed", event);
});

test("selected restore retains selection on failure, allows retry and reloads a stale zero result", async () => {
  const onItemsRemoved = vi.fn();
  const event = vi.fn();
  window.addEventListener("keepall:items-changed", event);
  vi.mocked(restoreItems).mockRejectedValueOnce(new Error("Write failed")).mockResolvedValueOnce([]);
  const { rerender } = render(<Harness onItemsRemoved={onItemsRemoved} />);
  fireEvent.click(screen.getByRole("button", { name: "Restore selected" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
  expect(onItemsRemoved).not.toHaveBeenCalled();
  expect(event).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Restore selected" }));
  await screen.findByText("No items restored. The selected items are no longer in Trash.");
  expect(onItemsRemoved).toHaveBeenCalledExactlyOnceWith([]);
  expect(event).toHaveBeenCalledOnce();
  rerender(<Harness selectedIds={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Restore selected" }));
  expect(restoreItems).toHaveBeenCalledTimes(2);
  window.removeEventListener("keepall:items-changed", event);
});
