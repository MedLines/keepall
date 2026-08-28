import { describe, expect, test, beforeEach } from "vitest";
import {
  PREVIEW_WELCOME_STORAGE_KEY,
  clearStoredWelcomeBatch,
  readStoredWelcomeBatch,
  writeStoredWelcomeBatch,
} from "./preview-welcome-storage";

describe("preview-welcome-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("round-trips a welcome batch", () => {
    writeStoredWelcomeBatch({
      total: 100,
      done: 12,
      remainingLinkIds: ["a", "b"],
    });
    expect(readStoredWelcomeBatch()).toEqual({
      total: 100,
      done: 12,
      remainingLinkIds: ["a", "b"],
    });
  });

  test("clear removes the key", () => {
    writeStoredWelcomeBatch({
      total: 1,
      done: 0,
      remainingLinkIds: ["a"],
    });
    clearStoredWelcomeBatch();
    expect(window.localStorage.getItem(PREVIEW_WELCOME_STORAGE_KEY)).toBeNull();
  });
});
