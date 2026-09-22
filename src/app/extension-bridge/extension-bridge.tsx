"use client";

import { useEffect } from "react";
import { saveExtensionLink, type ExtensionLinkCapture } from "@/persistence/extension-capture";
import { ITEMS_CHANGED_EVENT } from "../items-events";

const EXTENSION_ORIGIN = "chrome-extension://flmcadkppebdjebeiiellmeldfbckppo";

function isCapture(value: unknown): value is ExtensionLinkCapture {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.captureId === "string" &&
    typeof input.url === "string" &&
    typeof input.title === "string" &&
    (input.noteContent === undefined || typeof input.noteContent === "string");
}

export function ExtensionBridge() {
  useEffect(() => {
    if (window.parent === window) return;

    function reply(message: Record<string, unknown>) {
      window.parent.postMessage({ channel: "keepall-extension", ...message }, EXTENSION_ORIGIN);
    }

    async function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== EXTENSION_ORIGIN) return;
      if (event.data?.channel !== "keepall-extension" || event.data?.type !== "capture") return;
      if (!isCapture(event.data.payload)) return;

      const capture = event.data.payload;
      try {
        const result = await saveExtensionLink(capture);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        reply({ type: "result", captureId: capture.captureId, ...result });
      } catch (error) {
        const message = error instanceof Error && error.message.includes("personal note")
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
