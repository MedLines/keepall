"use client";

import { useEffect } from "react";
import { getExtensionOrganizationOptions, saveExtensionLink, type ExtensionLinkCapture } from "@/persistence/extension-capture";
import { ITEMS_CHANGED_EVENT } from "../items-events";

const EXTENSION_ORIGIN = "chrome-extension://flmcadkppebdjebeiiellmeldfbckppo";

function isCapture(value: unknown): value is ExtensionLinkCapture {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.captureId === "string" &&
    typeof input.url === "string" &&
    typeof input.title === "string" &&
    (input.noteContent === undefined || typeof input.noteContent === "string") &&
    (input.collectionId === undefined || input.collectionId === null || typeof input.collectionId === "string") &&
    (input.tagIds === undefined || (Array.isArray(input.tagIds) && input.tagIds.every((id) => typeof id === "string"))) &&
    (input.collectionName === undefined || typeof input.collectionName === "string") &&
    (input.tagNames === undefined || (Array.isArray(input.tagNames) && input.tagNames.every((name) => typeof name === "string")));
}

export function ExtensionBridge() {
  useEffect(() => {
    if (window.parent === window) return;

    function reply(message: Record<string, unknown>) {
      window.parent.postMessage({ channel: "keepall-extension", ...message }, EXTENSION_ORIGIN);
    }

    async function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== EXTENSION_ORIGIN) return;
      if (event.data?.channel !== "keepall-extension") return;

      if (event.data.type === "organizations") {
        if (typeof event.data.requestId !== "string" || typeof event.data.url !== "string" || event.data.url.length > 8192) return;
        try {
          const options = await getExtensionOrganizationOptions(event.data.url);
          reply({ type: "organizations", requestId: event.data.requestId, ...options });
        } catch {
          reply({ type: "organizations", requestId: event.data.requestId, error: "Could not load collections and tags." });
        }
        return;
      }

      if (event.data.type !== "capture" || !isCapture(event.data.payload)) return;

      const capture = event.data.payload;
      try {
        const result = await saveExtensionLink(capture);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        reply({ type: "result", captureId: capture.captureId, ...result });
      } catch (error) {
        const message = error instanceof Error && (error.message.includes("personal note") || error.message.includes("no longer available"))
          ? error.message
          : "Could not save this link to Keepall.";
        reply({ type: "result", captureId: capture.captureId, error: message });
      }
    }

    window.addEventListener("message", onMessage);
    reply({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return <main className="sr-only">Keepall extension bridge</main>;
}
