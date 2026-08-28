import {
  PREVIEW_DAILY_VIEWPORT_CAP,
  previewBudgetDayKey,
} from "@/domain/preview-enrich";

export const PREVIEW_BUDGET_STORAGE_KEY = "keepall:preview-budget";

export type PreviewBudgetState = {
  dayKey: string;
  viewportAutoUsed: number;
};

export function readPreviewBudget(now = Date.now()): PreviewBudgetState {
  const dayKey = previewBudgetDayKey(now);
  if (typeof window === "undefined") {
    return { dayKey, viewportAutoUsed: 0 };
  }
  try {
    const raw = window.localStorage.getItem(PREVIEW_BUDGET_STORAGE_KEY);
    if (!raw) {
      return { dayKey, viewportAutoUsed: 0 };
    }
    const parsed = JSON.parse(raw) as PreviewBudgetState;
    if (
      typeof parsed.dayKey !== "string" ||
      typeof parsed.viewportAutoUsed !== "number"
    ) {
      return { dayKey, viewportAutoUsed: 0 };
    }
    if (parsed.dayKey !== dayKey) {
      return { dayKey, viewportAutoUsed: 0 };
    }
    return parsed;
  } catch {
    return { dayKey, viewportAutoUsed: 0 };
  }
}

export function writePreviewBudget(state: PreviewBudgetState): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PREVIEW_BUDGET_STORAGE_KEY, JSON.stringify(state));
}

export function isViewportAutoBudgetCapped(now = Date.now()): boolean {
  const state = readPreviewBudget(now);
  return state.viewportAutoUsed >= PREVIEW_DAILY_VIEWPORT_CAP;
}

/** Returns false when the daily viewport cap is already spent. */
export function trySpendViewportAutoBudget(now = Date.now()): boolean {
  const dayKey = previewBudgetDayKey(now);
  const state = readPreviewBudget(now);
  if (state.viewportAutoUsed >= PREVIEW_DAILY_VIEWPORT_CAP) {
    return false;
  }
  writePreviewBudget({
    dayKey,
    viewportAutoUsed: state.viewportAutoUsed + 1,
  });
  return true;
}

export function clearPreviewBudgetForTests(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(PREVIEW_BUDGET_STORAGE_KEY);
}
