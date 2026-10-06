import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import type { Item } from "@/domain/item";
import { LibraryMainGrid, type LibraryPreviewHandle } from "./library-main-grid";

const notes = ["Alpha", "Beta", "Gamma"].map((title, i) => buildNote(
  { title, content: `${title} body` }, { id: title.toLowerCase(), now: i },
));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test("list columns respond to width and the chosen limit; vertical arrows follow rows", async () => {
  const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1400);
  let resize: ResizeObserverCallback;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe() {} unobserve() {} disconnect() {}
  });
  const scrollRef = createRef<HTMLElement>();
  const items = [...notes, buildNote({ title: "Delta", content: "body" }, { id: "delta", now: 4 })];
  const props = { visibleItems: items, scopeKey: "all", layout: "list" as const, scrollRef, empty: null,
    selectedIds: new Set<string>(), onSelectIds: vi.fn(), onOpenItem: vi.fn(),
    renderItem: (item: Item) => <li key={item.id} tabIndex={0} data-item-id={item.id}>{item.title}</li> };
  const { rerender } = render(<LibraryMainGrid {...props} listColumns="3" />);
  const list = screen.getByRole("list", { name: "Library items" });
  expect(list.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
  act(() => screen.getByText("Alpha").focus());
  fireEvent.keyDown(screen.getByText("Alpha"), { key: "ArrowDown" });
  await waitFor(() => expect(screen.getByText("Delta")).toHaveFocus());
  act(() => resize([{ contentRect: { width: 900 } } as ResizeObserverEntry], {} as ResizeObserver));
  expect(list.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
  rerender(<LibraryMainGrid {...props} listColumns="auto" />);
  expect(list.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
  rerender(<LibraryMainGrid {...props} listColumns="1" />);
  expect(list.style.gridTemplateColumns).toBe("repeat(1, minmax(0, 1fr))");
  width.mockRestore();
});

function setup(selectedIds = new Set<string>()) {
  const open = vi.fn();
  const select = vi.fn();
  const scrollRef = createRef<HTMLElement>();
  const previewRef = createRef<LibraryPreviewHandle>();
  function Harness() {
    const [selection, setSelection] = useState(selectedIds);
    return <main ref={scrollRef}><button onClick={() => previewRef.current?.openPreview()}>Preview results</button><button onClick={() => previewRef.current?.openPreview("gamma")}>Preview Gamma</button><LibraryMainGrid ref={previewRef}
    visibleItems={notes} scopeKey="all" layout="list" scrollRef={scrollRef}
    empty={null} selectedIds={selection} onSelectIds={ids => { select(ids); setSelection(ids); }} onOpenItem={open}
    renderItem={item => <li key={item.id} data-item-id={item.id} tabIndex={0} aria-label={item.title}>
      {item.title}<button type="button">Actions {item.title}</button>
    </li>}
  /></main>;
  }
  render(<Harness />);
  return { open, select, alpha: screen.getByRole("listitem", { name: "Alpha" }) };
}

describe("Library keyboard browsing", () => {
  test("toolbar entry starts with the first result and then reuses the last focused item", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Preview results" }));
    const dialog = await screen.findByRole("dialog", { name: "Alpha" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const beta = screen.getByRole("listitem", { name: "Beta" });
    act(() => beta.focus());
    fireEvent.click(screen.getByRole("button", { name: "Preview results" }));
    expect(await screen.findByRole("dialog", { name: "Beta" })).toHaveTextContent("Beta body");
  });

  test("item entry starts from the requested result and restores focus there", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Preview Gamma" }));
    const dialog = await screen.findByRole("dialog", { name: "Gamma" });
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("listitem", { name: "Gamma" })).toHaveFocus());
    expect(dialog).not.toBeInTheDocument();
  });

  test("moves focus in result order without wrapping and opens the focused item", async () => {
    const { alpha, open } = setup();
    alpha.focus();
    fireEvent.keyDown(alpha, { key: "ArrowDown" });
    const beta = screen.getByRole("listitem", { name: "Beta" });
    await waitFor(() => expect(beta).toHaveFocus());
    fireEvent.keyDown(beta, { key: "Enter" });
    expect(open).toHaveBeenCalledWith(notes[1]);
    fireEvent.keyDown(beta, { key: "ArrowRight" });
    const gamma = screen.getByRole("listitem", { name: "Gamma" });
    await waitFor(() => expect(gamma).toHaveFocus());
    fireEvent.keyDown(gamma, { key: "ArrowRight" });
    expect(gamma).toHaveFocus();
  });

  test("keeps one preview open across items and returns focus to the last previewed card", async () => {
    const { alpha } = setup();
    alpha.focus();
    fireEvent.keyDown(alpha, { key: " " });
    const dialog = await screen.findByRole("dialog", { name: "Alpha" });
    expect(dialog).toHaveTextContent("Alpha body");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Beta" })).toBe(dialog));
    expect(dialog).toHaveTextContent("Beta body");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("listitem", { name: "Beta" })).toHaveFocus());
  });

  test("extends and contracts a range while preserving an unrelated selection", async () => {
    const { alpha, select } = setup(new Set(["hidden"]));
    alpha.focus();
    fireEvent.keyDown(alpha, { key: "ArrowDown", shiftKey: true });
    const beta = screen.getByRole("listitem", { name: "Beta" });
    await waitFor(() => expect(beta).toHaveFocus());
    expect(select).toHaveBeenLastCalledWith(new Set(["hidden", "alpha", "beta"]));
    fireEvent.keyDown(beta, { key: "ArrowDown", shiftKey: true });
    const gamma = screen.getByRole("listitem", { name: "Gamma" });
    await waitFor(() => expect(gamma).toHaveFocus());
    expect(select).toHaveBeenLastCalledWith(new Set(["hidden", "alpha", "beta", "gamma"]));
    fireEvent.keyDown(gamma, { key: "ArrowUp", shiftKey: true });
    await waitFor(() => expect(beta).toHaveFocus());
    expect(select).toHaveBeenLastCalledWith(new Set(["hidden", "alpha", "beta"]));
  });

  test("starts a new selection range after focus moves independently", async () => {
    const { alpha, select } = setup();
    alpha.focus();
    fireEvent.keyDown(alpha, { key: "ArrowDown", shiftKey: true });
    await waitFor(() => expect(screen.getByRole("listitem", { name: "Beta" })).toHaveFocus());
    const gamma = screen.getByRole("listitem", { name: "Gamma" });
    gamma.focus();
    fireEvent.keyDown(gamma, { key: "ArrowUp", shiftKey: true });
    expect(select).toHaveBeenLastCalledWith(new Set(["alpha", "beta", "gamma"]));
  });

  test("leaves nested actions and modified shortcuts alone", () => {
    const { alpha, open } = setup();
    const actions = screen.getByRole("button", { name: "Actions Alpha" });
    actions.focus();
    fireEvent.keyDown(actions, { key: " " });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    alpha.focus();
    fireEvent.keyDown(alpha, { key: "Enter", ctrlKey: true });
    expect(open).not.toHaveBeenCalled();
  });
});
