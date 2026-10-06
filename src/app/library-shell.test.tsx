import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { LibraryShell } from "./library-shell";
import { useShellMobile } from "./use-shell-mobile";

vi.mock("./use-shell-mobile", () => ({ useShellMobile: vi.fn() }));

function props(overrides: Partial<ComponentProps<typeof LibraryShell>> = {}): ComponentProps<typeof LibraryShell> {
  return {
    panelOpen: true,
    panelReady: true,
    onPanelOpenChange: vi.fn(),
    browseCollectionId: null,
    browseUnsorted: false,
    browseType: null,
    browseTagId: null,
    collections: [],
    pinnedCollectionIds: [],
    tags: [],
    sidebarCounts: { all: 0, unsorted: 0, pdfDocuments: 0, byType: { link: 0, note: 0, image: 0, video: 0, document: 0 }, byCollectionId: {}, byTagId: {} },
    dropTargetCollectionId: null,
    collectionManageError: null,
    dragError: null,
    mutationBusy: false,
    onGoHome: vi.fn(),
    onGoAll: vi.fn(),
    onGoUnsorted: vi.fn(),
    onGoCollection: vi.fn(),
    onGoTag: vi.fn(),
    onCollectionDragOver: vi.fn(),
    onCollectionDragLeave: vi.fn(),
    onCollectionDrop: vi.fn(),
    onRenameCollection: vi.fn(),
    onTogglePinnedCollection: vi.fn(),
    onMovePinnedCollection: vi.fn(),
    onDeleteCollection: vi.fn(),
    onDeleteTag: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());

test("mobile navigation closes once after choosing All items", () => {
  vi.mocked(useShellMobile).mockReturnValue(true);
  const input = props();
  render(<LibraryShell {...input} />);
  const dialog = screen.getByRole("dialog", { name: "Sidebar navigation" });
  fireEvent.click(within(dialog).getByRole("button", { name: "All items" }));
  expect(input.onGoAll).toHaveBeenCalledOnce();
  expect(input.onPanelOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test("desktop navigation does not close the sidebar after choosing All items", () => {
  vi.mocked(useShellMobile).mockReturnValue(false);
  const input = props();
  render(<LibraryShell {...input} />);
  fireEvent.click(within(screen.getByRole("complementary", { name: "Sidebar" })).getByRole("button", { name: "All items" }));
  expect(input.onGoAll).toHaveBeenCalledOnce();
  expect(input.onPanelOpenChange).not.toHaveBeenCalled();
});


test("preview keeps mobile navigation closed after resizing while preserving desktop navigation", () => {
  vi.mocked(useShellMobile).mockReturnValue(false);
  const input = props({ previewOpen: true });
  const { rerender } = render(<LibraryShell {...input} />);
  expect(input.onPanelOpenChange).not.toHaveBeenCalled();
  vi.mocked(useShellMobile).mockReturnValue(true);
  rerender(<LibraryShell {...input} />);
  expect(screen.queryByRole("dialog", { name: "Sidebar navigation" })).not.toBeInTheDocument();
  expect(input.onPanelOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});
