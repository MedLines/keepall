import { afterEach, expect, test, vi } from "vitest";
import { createDocumentSearchClient } from "./document-search-client";
import type { DocumentSearchRequest, DocumentSearchResponse } from "@/persistence/document-search";

class TestWorker {
  onmessage: ((event: MessageEvent<DocumentSearchResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn<(request: DocumentSearchRequest) => void>();
  terminate = vi.fn();
  reply(request: DocumentSearchRequest) {
    this.onmessage?.(new MessageEvent<DocumentSearchResponse>("message", { data: { id: request.id, query: request.query, matches: [], unavailable: 0 } }));
  }
}

afterEach(() => vi.unstubAllGlobals());

test("starts lazily, reuses its worker and ignores superseded responses", async () => {
  const worker = new TestWorker();
  const factory = vi.fn(() => worker as unknown as Worker);
  const client = createDocumentSearchClient(factory);
  expect(factory).not.toHaveBeenCalled();
  const first = client.search([], "old");
  const aborted = expect(first).rejects.toMatchObject({ name: "AbortError" });
  const second = client.search([], "new");
  const [oldRequest, newRequest] = worker.postMessage.mock.calls.map(([request]) => request);
  worker.reply(oldRequest);
  worker.reply(newRequest);
  await aborted;
  expect((await second).query).toBe("new");
  expect(factory).toHaveBeenCalledTimes(1);
  client.reset();
  expect(worker.terminate).toHaveBeenCalledOnce();
});

test("worker errors reject search, release the worker and allow retry", async () => {
  const workers = [new TestWorker(), new TestWorker()];
  const factory = vi.fn(() => workers[factory.mock.calls.length - 1] as unknown as Worker);
  const client = createDocumentSearchClient(factory);
  const failed = client.search([], "needle");
  const rejection = expect(failed).rejects.toThrow("Couldn't search file contents");
  workers[0].onerror?.({ preventDefault: vi.fn() } as unknown as ErrorEvent);
  await rejection;
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  const retry = client.search([], "needle");
  workers[1].reply(workers[1].postMessage.mock.calls[0][0]);
  expect((await retry).query).toBe("needle");
  client.reset();
});

test("constructor failure rejects through the same recoverable path", async () => {
  const client = createDocumentSearchClient(() => { throw new Error("Worker blocked"); });
  await expect(client.search([], "needle")).rejects.toThrow("Worker blocked");
  client.reset();
});
