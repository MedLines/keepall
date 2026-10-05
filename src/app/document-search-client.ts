import type { DocumentSearchRequest, DocumentSearchResponse } from "@/persistence/document-search";

export function createDocumentSearchClient(
  createWorker = () => new Worker(new URL("../persistence/document-search.worker.ts", import.meta.url), { type: "module" }),
) {
  let worker: Worker | null = null;
  let sequence = 0;
  let pending: { id: number; resolve: (result: DocumentSearchResponse) => void; reject: (error: Error) => void } | null = null;

  function cancel() {
    pending?.reject(new DOMException("Search superseded", "AbortError"));
    pending = null;
    worker?.postMessage({ id: ++sequence, query: "", entries: [] } satisfies DocumentSearchRequest);
  }

  function reset() {
    pending?.reject(new DOMException("Search canceled", "AbortError"));
    pending = null;
    worker?.terminate();
    worker = null;
  }

  async function search(entries: DocumentSearchRequest["entries"], query: string): Promise<DocumentSearchResponse> {
    pending?.reject(new DOMException("Search superseded", "AbortError"));
    pending = null;
    if (!worker) {
      worker = createWorker();
      worker.onmessage = (event: MessageEvent<DocumentSearchResponse>) => {
        if (event.data.id !== pending?.id) return;
        pending.resolve(event.data);
        pending = null;
      };
      worker.onerror = (event) => {
        event.preventDefault();
        pending?.reject(new Error("Couldn't search file contents"));
        pending = null;
        reset();
      };
    }
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending = { id, resolve, reject };
      worker!.postMessage({ id, entries, query } satisfies DocumentSearchRequest);
    });
  }

  return { search, cancel, reset };
}
