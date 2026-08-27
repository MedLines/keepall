import {
  saveLinkPreviewResult,
  setLinkPreviewAssetId,
  setLinkPreviewPending,
  setLinkPreviewRetry,
} from "@/persistence/items";
import { putAsset } from "@/persistence/assets";
import { ITEMS_CHANGED_EVENT } from "@/app/items-events";

async function storeLocalPreviewImage(
  linkId: string,
  imageUrl: string,
): Promise<void> {
  if (!imageUrl.trim()) {
    await setLinkPreviewRetry(linkId, null);
    return;
  }

  let response: Response;
  try {
    response = await fetch("/api/preview-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrl }),
    });
  } catch {
    await setLinkPreviewRetry(linkId, "network");
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    return;
  }

  // Oversize / blocked → never retry. Upstream/network → try again later.
  if (!response.ok) {
    const retry =
      response.status === 413 || response.status === 400 ? "none" : "network";
    await setLinkPreviewRetry(linkId, retry);
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    return;
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  const blob = await response.blob();
  if (blob.size === 0) {
    await setLinkPreviewRetry(linkId, "none");
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    return;
  }

  const asset = await putAsset({
    mimeType,
    bytes: new Uint8Array(await blob.arrayBuffer()),
  });
  await setLinkPreviewAssetId(linkId, asset.id);
  window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
}

/**
 * After a link is saved locally, ask same-origin /api/preview and store the
 * result on the link row. When an image URL is present, best-effort fetch
 * bytes via /api/preview-image into the assets table. Never throws to the caller.
 */
export async function enrichLinkPreview(
  linkId: string,
  url: string,
): Promise<void> {
  try {
    await setLinkPreviewPending(linkId);
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

    let response: Response;
    try {
      response = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } catch {
      await saveLinkPreviewResult(linkId, {
        status: "failed",
        retry: "network",
      });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      return;
    }

    if (!response.ok) {
      await saveLinkPreviewResult(linkId, {
        status: "failed",
        retry: response.status === 400 ? "none" : "network",
      });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
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
    });
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

    try {
      await storeLocalPreviewImage(linkId, imageUrl);
    } catch {
      try {
        await setLinkPreviewRetry(linkId, "network");
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      } catch {
        // Link may have been deleted while enrichment ran.
      }
    }
  } catch {
    try {
      await saveLinkPreviewResult(linkId, {
        status: "failed",
        retry: "network",
      });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      // Link may have been deleted while enrichment ran.
    }
  }
}
