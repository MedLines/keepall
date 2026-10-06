import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ScrollArea } from "./scroll-area";

afterEach(() => vi.restoreAllMocks());

test("touch uses a keyboard-accessible native viewport for both axes", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(pointer: coarse)", media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: () => false,
  }));
  const { container } = render(
    <ScrollArea orientation="both" aria-label="Attachments">
      <button type="button">Open attachment</button>
    </ScrollArea>,
  );
  await waitFor(() => expect(screen.getByRole("group", { name: "Attachments" })).toBeInTheDocument());
  const viewport = container.querySelector('[data-slot="scroll-area-viewport"]');
  expect(viewport).toHaveAttribute("tabindex", "0");
  expect(viewport).toHaveClass("overflow-auto");
  expect(container.querySelector('[data-slot="scroll-area-scrollbar"]')).toBeNull();
  const attachment = screen.getByRole("button", { name: "Open attachment" });
  attachment.focus();
  fireEvent.keyDown(attachment, { key: "Enter" });
  expect(attachment).toHaveFocus();
});
