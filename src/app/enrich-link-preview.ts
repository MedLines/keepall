import {
  saveLinkPreviewResult,
  setLinkPreviewPending,
} from "@/persistence/items";
import { ITEMS_CHANGED_EVENT } from "@/app/items-events";

/**
 * After a link is saved locally, ask same-origin /api/preview and store the
 * result on the link row. Never throws to the caller — failures mark failed.
 */
export async function enrichLinkPreview(linkId: string, url: string): Promise<void> {
  try {
    await setLinkPreviewPending(linkId);
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

    const response = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      await saveLinkPreviewResult(linkId, { status: "failed" });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
      return;
    }

    const body = (await response.json()) as {
      title?: unknown;
      description?: unknown;
      imageUrl?: unknown;
    };

    await saveLinkPreviewResult(linkId, {
      status: "ready",
      title: typeof body.title === "string" ? body.title : "",
      description: typeof body.description === "string" ? body.description : "",
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : "",
    });
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
  } catch {
    try {
      await saveLinkPreviewResult(linkId, { status: "failed" });
      window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    } catch {
      // Link may have been deleted while enrichment ran.
    }
  }
}
