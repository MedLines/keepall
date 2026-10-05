import { createDocumentSearcher, type DocumentSearchRequest, type DocumentSearchResponse } from "./document-search";

const search = createDocumentSearcher();
let generation = 0;

self.onmessage = async (event: MessageEvent<DocumentSearchRequest>) => {
  const current = ++generation;
  const result = await search(event.data, () => current === generation);
  if (result) self.postMessage(result satisfies DocumentSearchResponse);
};
