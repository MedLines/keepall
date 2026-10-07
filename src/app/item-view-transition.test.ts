import * as React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { transitionLibraryLayout } from "./item-view-transition";

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof React>(),
  ViewTransition: () => null,
  addTransitionType: vi.fn(),
  startTransition: vi.fn((update: () => void) => update()),
}));

afterEach(() => vi.restoreAllMocks());
beforeEach(() => vi.clearAllMocks());

test("tags only the layout update for a view transition", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
  const update = vi.fn(() => expect(React.addTransitionType).toHaveBeenCalledWith("library-layout"));
  transitionLibraryLayout(update);
  expect(React.startTransition).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledTimes(1);
});

test("reduced motion updates the layout immediately without starting an animation", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  const update = vi.fn();
  transitionLibraryLayout(update);
  expect(update).toHaveBeenCalledTimes(1);
  expect(React.startTransition).not.toHaveBeenCalled();
  expect(React.addTransitionType).not.toHaveBeenCalled();
});
