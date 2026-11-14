import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { buildNote } from "@/domain/note";

const STORAGE_KEY = "keepall:card-heights:v1";

async function freshStore() {
  vi.resetModules();
  return import("./card-heights");
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("saved heights survive a reload and are used straight away", async () => {
  const note = buildNote({ content: "Keep this note" });
  const first = await freshStore();
  const group = first.cardHeightGroup("all", 1200);
  first.rememberCardHeight(first.cardHeightKey(group, note), 312);
  vi.advanceTimersByTime(1000);

  const reloaded = await freshStore();
  expect(reloaded.knownCardHeight(reloaded.cardHeightKey(group, note))).toBe(312);
  expect(reloaded.isCardHeightGroupVerified(group)).toBe(false);
});

test("an edit, another width or another scope needs a new measurement", async () => {
  const note = buildNote({ content: "Keep this note" });
  const store = await freshStore();
  const group = store.cardHeightGroup("all", 1200);
  store.rememberCardHeight(store.cardHeightKey(group, note), 312);

  expect(store.knownCardHeight(store.cardHeightKey(group, { ...note, updatedAt: note.updatedAt + 1 }))).toBeUndefined();
  expect(store.knownCardHeight(store.cardHeightKey(store.cardHeightGroup("all", 900), note))).toBeUndefined();
  expect(store.knownCardHeight(store.cardHeightKey(store.cardHeightGroup("collection", 1200), note))).toBeUndefined();
});

test("a failed check drops only that group's saved heights", async () => {
  const note = buildNote({ content: "Keep this note" });
  const store = await freshStore();
  const wide = store.cardHeightGroup("all", 1200);
  const narrow = store.cardHeightGroup("all", 900);
  store.rememberCardHeight(store.cardHeightKey(wide, note), 312);
  store.rememberCardHeight(store.cardHeightKey(narrow, note), 380);

  store.verifyCardHeightGroup(wide, false);

  expect(store.isCardHeightGroupVerified(wide)).toBe(true);
  expect(store.knownCardHeight(store.cardHeightKey(wide, note))).toBeUndefined();
  expect(store.knownCardHeight(store.cardHeightKey(narrow, note))).toBe(380);
});

test("search results are measured for the visit but never saved", async () => {
  const note = buildNote({ content: "Keep this note" });
  const store = await freshStore();
  const search = store.cardHeightGroup(`all${store.SEARCH_SCOPE_MARKER}react`, 1200);
  const browse = store.cardHeightGroup("all", 1200);
  store.rememberCardHeight(store.cardHeightKey(search, note), 420);
  store.rememberCardHeight(store.cardHeightKey(browse, note), 312);
  vi.advanceTimersByTime(1000);

  expect(store.knownCardHeight(store.cardHeightKey(search, note))).toBe(420);
  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as Array<[string, number]>;
  expect(saved.map(([, height]) => height)).toEqual([312]);
});

test("unreadable storage falls back to measuring", async () => {
  window.localStorage.setItem(STORAGE_KEY, "{not json");
  const store = await freshStore();
  const note = buildNote({ content: "Keep this note" });
  expect(store.knownCardHeight(store.cardHeightKey(store.cardHeightGroup("all", 1200), note))).toBeUndefined();
});
