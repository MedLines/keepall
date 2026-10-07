import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { getItem } from "@/persistence/items";
import { ItemPageContent } from "./item-page-content";

vi.mock("@/persistence/items", () => ({ getItem: vi.fn() }));
vi.mock("./image-item-page", () => ({ ImageItemPage: () => <p>Image loaded</p> }));
vi.mock("./link-item-page", () => ({ LinkItemPage: () => <p>Link loaded</p> }));
vi.mock("./note-item-page", () => ({ NoteItemPage: () => <p>Note loaded</p> }));
vi.mock("./video-item-page", () => ({ VideoItemPage: () => <p>Video loaded</p> }));
vi.mock("./document-item-page", () => ({ DocumentItemPage: () => <p>Document loaded</p> }));
beforeEach(() => vi.mocked(getItem).mockReset());

test("retries the same item after a failed read and keeps its return path", async () => {
  vi.mocked(getItem).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue(null);
  render(<ItemPageContent itemId="n1" returnHref="/?q=saved" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Try loading again");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Item not found. It may be in Trash.")).toBeInTheDocument();
  expect(getItem).toHaveBeenNthCalledWith(2, "n1");
  expect(screen.getByRole("link", { name: "Return to library" })).toHaveAttribute("href", "/?q=saved");
});

test("ignores a stale failure when navigation changes the requested item", async () => {
  let rejectOld!: (error: Error) => void;
  vi.mocked(getItem).mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; })).mockResolvedValue(null);
  const { rerender } = render(<ItemPageContent itemId="old" returnHref="/" />);
  rerender(<ItemPageContent itemId="new" returnHref="/" />);
  expect(await screen.findByText("Item not found. It may be in Trash.")).toBeInTheDocument();
  await act(async () => rejectOld(new Error("Old failure")));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Trash" })).toBeInTheDocument();
});
