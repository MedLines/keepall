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
afterEach(() => vi.unstubAllGlobals());

test("loads no originals without a query, rejects stale results, and keeps its worker between queries", async () => {
  const { result, rerender, unmount } = renderHook(({ query }) => useDocumentSearch(items, tags, query), { initialProps: { query: "" } });
  expect(workers).toHaveLength(0);
  expect(result.current.pending).toBe(false);
  rerender({ query: "old" });
  expect(result.current.pending).toBe(true);
  const oldRequest = workers[0].postMessage.mock.calls[0][0];
  rerender({ query: "new" });
  const newRequest = workers[0].postMessage.mock.calls[1][0];
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

test("a new library snapshot resets cached originals, including backups that reuse asset IDs", async () => {
  const { result, rerender } = renderHook(({ documents }) => useDocumentSearch(documents, tags, "keyword"), { initialProps: { documents: items } });
  await act(async () => workers[0].reply(workers[0].postMessage.mock.calls[0][0]));
  expect(result.current.matches?.size).toBe(1);
  rerender({ documents: [{ ...item, updatedAt: 2 }] });
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(workers).toHaveLength(2);
  expect(result.current.matches).toBeUndefined();
  await act(async () => workers[1].reply(workers[1].postMessage.mock.calls[0][0]));
  expect(result.current.pending).toBe(false);
});

test("search failure and unavailable files can be retried without hiding metadata results", async () => {
  const { result } = renderHook(() => useDocumentSearch(items, tags, "keyword"));
  await act(async () => workers[0].onerror?.({ preventDefault: vi.fn() } as unknown as ErrorEvent));
  expect(result.current.error).toBe(true);
  expect(result.current.matches).toBeUndefined();
  act(() => result.current.retry());
  await waitFor(() => expect(workers).toHaveLength(2));
  expect(result.current.error).toBe(false);
  await act(async () => workers[1].reply(workers[1].postMessage.mock.calls[0][0], 1));
  expect(result.current.unavailable).toBe(1);
  expect(result.current.matches?.size).toBe(1);
});
