import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { SidebarResizeHandle } from "./sidebar-resize-handle";
import { SIDEBAR_WIDTH_KEY } from "./shell-styles";

beforeEach(() => localStorage.clear());

function setup() {
  function Shell() {
    const [open, setOpen] = useState(true);
    return <div>
      <aside id="library-sidebar" data-ready="true" data-state={open ? "open" : "closed"}>
        <SidebarResizeHandle expanded={open} onExpandedChange={setOpen} />
      </aside>
      <section data-library-panel><main /></section>
      <button onClick={() => setOpen(!open)}>Toggle sidebar</button>
    </div>;
  }
  const { container } = render(<Shell />);
  const handle = screen.getByRole("separator", { name: "Resize sidebar" });
  const sidebar = handle.parentElement!;
  const panel = container.querySelector<HTMLElement>("[data-library-panel]")!;
  vi.spyOn(sidebar, "getBoundingClientRect").mockImplementation(() => ({
    ...new DOMRect(), width: Number.parseFloat(sidebar.style.width) || (sidebar.dataset.state === "open" ? 256 : 56),
  }));
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ ...new DOMRect(), width: 900 });
  Object.assign(handle, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() });
  function pointer(type: string, x: number) {
    fireEvent(handle, Object.assign(new Event(type, { bubbles: true }), {
      button: 0, isPrimary: true, pointerId: 1, clientX: x,
    }));
  }
  return { handle, sidebar, panel, pointer };
}

test("a rail press with minor pointer movement toggles collapse and restores saved width", () => {
  const { pointer, sidebar } = setup();
  pointer("pointerdown", 256);
  pointer("pointerup", 258);
  expect(sidebar).toHaveAttribute("data-state", "closed");
  pointer("pointerdown", 56);
  pointer("pointerup", 57);
  expect(sidebar).toHaveAttribute("data-state", "open");
  expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe("256");
});

test("Escape cancels a drag collapse and restores width without saving the preview", async () => {
  const { pointer, handle, sidebar, panel } = setup();
  pointer("pointerdown", 256);
  pointer("pointermove", 100);
  await waitFor(() => expect(sidebar).toHaveAttribute("data-state", "closed"));
  expect(panel.style.getPropertyValue("--library-resize-width")).toBe("900px");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(sidebar).toHaveAttribute("data-state", "open");
  expect(handle).toHaveAttribute("aria-valuenow", "256");
  expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBeNull();
  expect(panel.style.getPropertyValue("--library-resize-width")).toBe("");
  expect(document.documentElement).not.toHaveAttribute("data-sidebar-resizing");
});

test("reduced motion applies keyboard and external toggles directly to the sidebar width", () => {
  const { handle, sidebar, panel } = setup();
  fireEvent.keyDown(handle, { key: "End" });
  expect(sidebar.style.width).toBe("400px");
  fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
  expect(sidebar.style.width).toBe("56px");
  fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
  expect(sidebar.style.width).toBe("400px");
  expect(panel.style.getPropertyValue("--library-resize-width")).toBe("");
});
