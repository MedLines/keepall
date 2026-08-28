import { beforeEach, describe, expect, test } from "vitest";
import { PREVIEW_DAILY_VIEWPORT_CAP } from "@/domain/preview-enrich";
import {
  clearPreviewBudgetForTests,
  isViewportAutoBudgetCapped,
  trySpendViewportAutoBudget,
} from "./preview-budget-storage";

describe("preview-budget-storage", () => {
  beforeEach(() => {
    clearPreviewBudgetForTests();
  });

  test("allows spending up to the daily viewport cap", () => {
    for (let index = 0; index < PREVIEW_DAILY_VIEWPORT_CAP; index += 1) {
      expect(trySpendViewportAutoBudget(1_700_000_000_000)).toBe(true);
    }
    expect(trySpendViewportAutoBudget(1_700_000_000_000)).toBe(false);
    expect(isViewportAutoBudgetCapped(1_700_000_000_000)).toBe(true);
  });
});
