import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DocumentItem } from "@/domain/document";
import type { Tag } from "@/domain/tag";
import type { DocumentSearchRequest, DocumentSearchResponse } from "@/persistence/document-search";
import { useDocumentSearch } from "./use-document-search";

const item: DocumentItem = { id: "document", type: "document", format: "text", title: "Reference", sourceFileName: "reference.txt", assetId: "original", noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };
const items = [item];
const tags: Tag[] = [];
const workers: TestWorker[] = [];
class TestWorker {
  onmessage: ((event: MessageEvent<DocumentSearchResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn<(request: DocumentSearchRequest) => void>();
  terminate = vi.fn();
  constructor() { workers.push(this); }
  reply(request: DocumentSearchRequest, unavailable = 0) {
    this.onmessage?.(new MessageEvent<DocumentSearchResponse>("message", { data: { id: request.id, query: request.query, matches: [[item.id, { score: 4, excerpt: { label: "File contents", text: request.query } }]], unavailable } }));
  }
}

beforeEach(() => { workers.length = 0; vi.stubGlobal("Worker", TestWorker); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function request(worker = 0, call = 0) {
  await waitFor(() => expect(workers[worker]?.postMessage.mock.calls.length ?? 0).toBeGreaterThan(call));
  return workers[worker].postMessage.mock.calls[call][0];
}

test("unchanged document snapshots and unrelated tags do not restart a settled search", async () => {
  const { result, rerender } = renderHook(({ documents, labels }) => useDocumentSearch(documents, labels, "keyword"), { initialProps: { documents: items, labels: tags } });
  const initial = await request();
  await act(async () => workers[0].reply(initial));
  const settled = result.current.matches;
  rerender({ documents: [{ ...item, tagIds: [], collectionIds: [] }], labels: [{ id: "unrelated", name: "Other", createdAt: 1 }] });
  expect(result.current.pending).toBe(false);
  expect(result.current.matches).toBe(settled);
  expect(workers).toHaveLength(1);
  expect(workers[0].terminate).not.toHaveBeenCalled();
  expect(workers[0].postMessage).toHaveBeenCalledOnce();
});

test("loads no originals without a query, rejects stale results, and keeps its worker between queries", async () => {
  const { result, rerender, unmount } = renderHook(({ query }) => useDocumentSearch(items, tags, query), { initialProps: { query: "" } });
  expect(workers).toHaveLength(0);
  expect(result.current.pending).toBe(false);
  rerender({ query: "old" });
  expect(result.current.pending).toBe(true);
  expect(result.current.query).toBe("old");
  const oldRequest = await request();
  rerender({ query: "new" });
  expect(result.current.query).toBe("new");
  const newRequest = await request(0, 1);
  await act(async () => workers[0].reply(oldRequest));
  expect(result.current.matches).toBeUndefined();
  await act(async () => workers[0].reply(newRequest));
  expect(result.current.matches?.get(item.id)?.excerpt?.text).toBe("new");
  expect(result.current.pending).toBe(false);
  expect(workers).toHaveLength(1);
  rerender({ query: "" });
  expect(result.current.matches).toBeUndefined();
  unmount();
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});

test("original revisions reset cached bytes even when backups reuse all document metadata and IDs", async () => {
  const { result, rerender } = renderHook(({ revision }) => useDocumentSearch(items, tags, "keyword", revision), { initialProps: { revision: "original" } });
  const initial = await request();
  await act(async () => workers[0].reply(initial));
  expect(result.current.matches?.size).toBe(1);
  const settled = result.current.matches;
  rerender({ revision: "restored" });
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(result.current.matches).toBe(settled);
  expect(result.current.query).toBe("keyword");
  expect(result.current.pending).toBe(true);
  const restored = await request(1);
  await act(async () => workers[1].reply(restored));
  expect(result.current.pending).toBe(false);
});

test("keeps settled results and their query together while the next document search is pending", async () => {
  const { result, rerender } = renderHook(({ query }) => useDocumentSearch(items, tags, query), { initialProps: { query: "animation" } });
  const initial = await request();
  await act(async () => workers[0].reply(initial));
  const settled = result.current.matches;

  rerender({ query: "animation examples" });
  expect(result.current.pending).toBe(true);
  expect(result.current.matches).toBe(settled);
  expect(result.current.query).toBe("animation");

  const next = await request(0, 1);
  await act(async () => workers[0].reply(next));
  expect(result.current.pending).toBe(false);
  expect(result.current.query).toBe("animation examples");
  expect(result.current.matches?.get(item.id)?.excerpt?.text).toBe("animation examples");

  rerender({ query: "" });
  expect(result.current.pending).toBe(false);
  expect(result.current.query).toBe("");
  expect(result.current.matches).toBeUndefined();
  rerender({ query: "another subject" });
  expect(result.current.pending).toBe(true);
  expect(result.current.query).toBe("another subject");
  expect(result.current.matches).toBeUndefined();
});

test("search failure and unavailable files can be retried without hiding metadata results", async () => {
  const { result } = renderHook(() => useDocumentSearch(items, tags, "keyword"));
  await request();
  await act(async () => workers[0].onerror?.({ preventDefault: vi.fn() } as unknown as ErrorEvent));
  expect(result.current.error).toBe(true);
  expect(result.current.matches).toBeUndefined();
  act(() => result.current.retry());
  const retried = await request(1);
  expect(result.current.error).toBe(false);
  await act(async () => workers[1].reply(retried, 1));
  expect(result.current.unavailable).toBe(1);
  expect(result.current.matches?.size).toBe(1);
});

test("rapid typing searches only the final query", async () => {
  vi.useFakeTimers();
  const { rerender } = renderHook(({ query }) => useDocumentSearch(items, tags, query), { initialProps: { query: "" } });
  rerender({ query: "ani" });
  rerender({ query: "animation" });
  rerender({ query: "animation examples" });
  expect(workers).toHaveLength(0);
  await act(async () => vi.advanceTimersByTimeAsync(150));
  expect(workers).toHaveLength(1);
  expect(workers[0].postMessage).toHaveBeenCalledOnce();
  expect(workers[0].postMessage.mock.calls[0][0].query).toBe("animation examples");
});

test("editing searchable document metadata refreshes results while reusing cached originals", async () => {
  const { result, rerender } = renderHook(({ documents }) => useDocumentSearch(documents, tags, "keyword"), { initialProps: { documents: items } });
  const initial = await request();
  await act(async () => workers[0].reply(initial));
  rerender({ documents: [{ ...item, title: "Changed title" }] });
  expect(result.current.pending).toBe(true);
  const updated = await request(0, 1);
  expect(updated.entries[0].item.title).toBe("Changed title");
  expect(workers).toHaveLength(1);
  expect(workers[0].terminate).not.toHaveBeenCalled();
  await act(async () => workers[0].reply(updated));
  expect(result.current.pending).toBe(false);
});
