import type { Item } from "@/domain/item";

/**
 * Real masonry card heights by scope, column width and item revision. Saved between visits so a
 * jump deep into the grid (dragging the scrollbar) lands on real positions straight away: a card
 * that first mounts above the viewport at a guessed height makes the virtualizer correct the
 * scroll position, which moves every column for a change in one of them.
 */
const STORAGE_KEY = "keepall:card-heights:v1";
const MAX_SAVED = 6000;
const SEPARATOR = "\u0000";
/** Search results show excerpts, so their heights are scoped to the query and never saved. */
export const SEARCH_SCOPE_MARKER = "|search:";

const heights = new Map<string, number>();
/** Saved heights not yet checked against this build's card styles, by scope and width. */
const unverified = new Set<string>();
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function cardHeightGroup(scope: string, width: number) {
  return `${scope}${SEPARATOR}${width}`;
}

export function cardHeightKey(group: string, item: Item) {
  return `${group}${SEPARATOR}${item.id}${SEPARATOR}${item.updatedAt}`;
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(saved)) return;
    for (const entry of saved) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || typeof entry[1] !== "number" || entry[1] <= 0) continue;
      heights.set(entry[0], entry[1]);
      unverified.add(entry[0].split(SEPARATOR).slice(0, 2).join(SEPARATOR));
    }
  } catch {
    // Unreadable storage only means cards are measured again.
  }
}

export function knownCardHeight(key: string): number | undefined {
  load();
  return heights.get(key);
}

export function isCardHeightGroupVerified(group: string) {
  load();
  return !unverified.has(group);
}

/** Card styles changed since these were saved: drop the group's saved heights and measure again. */
export function verifyCardHeightGroup(group: string, matches: boolean) {
  unverified.delete(group);
  if (matches) return;
  for (const key of heights.keys()) if (key.startsWith(group + SEPARATOR)) heights.delete(key);
  scheduleSave();
}

export function rememberCardHeight(key: string, height: number) {
  if (!(height > 0) || heights.get(key) === height) return;
  heights.delete(key);
  heights.set(key, height);
  if (!key.includes(SEARCH_SCOPE_MARKER)) scheduleSave();
}

function scheduleSave() {
  if (typeof window === "undefined" || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      // Newest last; keep the most recent entries when over the cap. Search results are not kept.
      const entries = [...heights].filter(([key]) => !key.includes(SEARCH_SCOPE_MARKER));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_SAVED)));
    } catch {
      // Full or blocked storage: heights stay in memory for this visit.
    }
  }, 1000);
}
