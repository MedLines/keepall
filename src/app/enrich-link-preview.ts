import {
  saveLinkPreviewResult,
  saveLinkPreviewImage,
  setLinkPreviewPending,
  setLinkPreviewRetry,
} from "@/persistence/items";
import { isPreviewEnrichPaused } from "./preview-enrich-pause";
import { dispatchEnrichItemsChanged } from "@/app/items-events";

function wasAborted(signal: AbortSignal | undefined, error: unknown): boolean {
  if (signal?.aborted) {
    return true;
  }
  return error instanceof DOMException && error.name === "AbortError";
}

function notifyLibraryChanged(linkId: string): void {
  if (isPreviewEnrichPaused()) {
    return;
  }
  dispatchEnrichItemsChanged(linkId);
}

async function storeLocalPreviewImage(
  linkId: string,
  url: string,
  imageUrl: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!imageUrl.trim()) {
    await setLinkPreviewRetry(linkId, null, url);
    return;
  }

  let response: Response;
  try {
    response = await fetch("/api/preview-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrl }),
      signal,
    });
  } catch (error) {
    if (wasAborted(signal, error)) {
      return;
    }
    await setLinkPreviewRetry(linkId, "network", url);
    notifyLibraryChanged(linkId);
    return;
  }

  // Oversize / blocked → never retry. Upstream/network → try again later.
  if (!response.ok) {
    const retry =
      response.status === 413 || response.status === 400 ? "none" : "network";
    await setLinkPreviewRetry(linkId, retry, url);
    notifyLibraryChanged(linkId);
    return;
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  const blob = await response.blob();
  if (blob.size === 0) {
    await setLinkPreviewRetry(linkId, "none", url);
    notifyLibraryChanged(linkId);
    return;
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (signal?.aborted) return;
  await saveLinkPreviewImage(linkId, url, {
    mimeType,
    bytes,
  });
  notifyLibraryChanged(linkId);
}

export type EnrichLinkPreviewOptions = {
  signal?: AbortSignal;
};

/**
 * After a link is saved locally, ask same-origin /api/preview and store the
 * result on the link row. When an image URL is present, best-effort fetch
 * bytes via /api/preview-image into the assets table. Never throws to the caller.
 *
 * Does not notify on "pending" — that caused a full library soft-reload before
 * every fetch and made folder switching fight the enrich queue.
 */
export async function enrichLinkPreview(
  linkId: string,
  url: string,
  options?: EnrichLinkPreviewOptions,
): Promise<void> {
  const signal = options?.signal;

  try {
    if (signal?.aborted) {
      return;
    }

    await setLinkPreviewPending(linkId, url);
    // No ITEMS_CHANGED here — pending is invisible on cards that already show
    // favicon/letter; notifying forced listItems() on every queued job.

    let response: Response;
    try {
      response = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal,
      });
    } catch (error) {
      if (wasAborted(signal, error)) {
        return;
      }
      await saveLinkPreviewResult(linkId, {
        status: "failed",
        retry: "network",
      }, url);
      notifyLibraryChanged(linkId);
      return;
    }

    if (signal?.aborted) {
      return;
    }

    if (!response.ok) {
      await saveLinkPreviewResult(linkId, {
        status: "failed",
        retry: response.status === 400 ? "none" : "network",
      }, url);
      notifyLibraryChanged(linkId);
      return;
    }

    const body = (await response.json()) as {
      title?: unknown;
      description?: unknown;
      imageUrl?: unknown;
    };

    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";

    await saveLinkPreviewResult(linkId, {
      status: "ready",
      title: typeof body.title === "string" ? body.title : "",
      description: typeof body.description === "string" ? body.description : "",
      imageUrl,
    }, url);
    notifyLibraryChanged(linkId);

    try {
      await storeLocalPreviewImage(linkId, url, imageUrl, signal);
    } catch (error) {
      if (wasAborted(signal, error)) {
        return;
      }
      try {
        await setLinkPreviewRetry(linkId, "network", url);
        notifyLibraryChanged(linkId);
      } catch {
        // Link may have been deleted while enrichment ran.
      }
    }
  } catch (error) {
    if (wasAborted(signal, error)) {
      return;
    }
    try {
      await saveLinkPreviewResult(linkId, {
        status: "failed",
        retry: "network",
      }, url);
      notifyLibraryChanged(linkId);
    } catch {
      // Link may have been deleted while enrichment ran.
    }
  }
}
