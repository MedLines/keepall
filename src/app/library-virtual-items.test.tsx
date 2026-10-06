import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";
import { ScrollPanel } from "@/components/ui/scroll-panel";
import { LibraryVirtualItems } from "./library-virtual-items";
import { LIBRARY_LIST_GAP_PX, LIBRARY_LIST_ROW_ESTIMATE_PX } from "./library-scale";
import { ContextMenu } from "@base-ui/react/context-menu";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test.each([1, 2, 3])("fast scroll jumps cover every column synchronously in a %i-column list", async columns => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {} unobserve() {} disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-index") ? LIBRARY_LIST_ROW_ESTIMATE_PX : 600;
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1000);
  const items = Array.from({ length: 1000 }, (_, index) =>
    buildNote({ title: `Row ${index}`, content: "Saved text" }, { id: `row-${index}`, now: index + 1 }));
  function Library() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => { setLoaded(true); }, []);
    return <ScrollPanel viewportRef={scrollRef} viewportProps={{ "data-testid": "library-viewport" }}>
      {loaded ? <LibraryVirtualItems columns={columns} items={items} scrollRef={scrollRef} focusedIndex={0} renderItem={(item, placement) => <ContextMenu.Root key={item.id}><ContextMenu.Trigger render={<li tabIndex={0} data-index={placement.index} ref={placement.measureElement} style={placement.style}>{item.title}</li>} /></ContextMenu.Root>} /> : null}
    </ScrollPanel>;
  }
  const { container } = render(<Library />);
  await waitFor(() => expect(screen.getByText("Row 0")).toBeInTheDocument());
  const viewport = screen.getByTestId("library-viewport");
  screen.getByText("Row 0").focus();
  const coverage: boolean[] = [];
  const positions: string[] = [];
  act(() => {
    const stride = LIBRARY_LIST_ROW_ESTIMATE_PX + LIBRARY_LIST_GAP_PX;
    for (const target of [700, 900, 180, 400, 0]) {
      const offset = stride * Math.floor(target / columns);
      viewport.scrollTop = offset;
      viewport.dispatchEvent(new Event("scroll"));
      const index = Math.floor(offset / stride) * columns;
      coverage.push(Array.from({ length: columns }, (_, lane) => index + lane).every(index => Boolean(viewport.querySelector(`[data-index="${index}"]`))));
      positions.push(viewport.querySelector<HTMLElement>(`[data-index="${index}"]`)?.style.transform ?? "missing");
    }
  });
  expect(coverage).toEqual([true, true, true, true, true]);
  const stride = LIBRARY_LIST_ROW_ESTIMATE_PX + LIBRARY_LIST_GAP_PX;
  expect(positions).toEqual([700, 900, 180, 400, 0].map(index => `translate3d(0, ${Math.floor(index / columns) * stride}px, 0)`));
  expect(screen.getByText("Row 0")).toHaveFocus();
  expect(container.querySelectorAll("[data-index]").length).toBeLessThan(40 * columns);
  const first = viewport.querySelector<HTMLElement>('[data-index="0"]')!;
  const expected = document.createElement("div");
  expected.style.width = `calc((100% - ${(columns - 1) * LIBRARY_LIST_GAP_PX}px) / ${columns})`;
  expect(first.style.width).toBe(expected.style.width);
  if (columns > 1) {
    expect(viewport.querySelector<HTMLElement>('[data-index="1"]')?.style.insetInlineStart).not.toBe(first.style.insetInlineStart);
  }
});
