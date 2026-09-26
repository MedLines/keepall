"use client";

import { useEffect } from "react";
import { getExtensionOrganizationOptions, saveExtensionImage, saveExtensionLink, type ExtensionImageCapture, type ExtensionLinkCapture } from "@/persistence/extension-capture";
import { ITEMS_CHANGED_EVENT } from "../items-events";

const EXTENSION_ORIGINS = [
  "chrome-extension://flmcadkppebdjebeiiellmeldfbckppo",
  "chrome-extension://ehloefgfecmfjbncknaoleakbnjhkpea",
] as const;

function isExistingLink(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const link = value as Record<string, unknown>;
  return typeof link.id === "string" && typeof link.title === "string" &&
    typeof link.noteContent === "string" && (link.noteFormat === "plain" || link.noteFormat === "markdown") &&
    Array.isArray(link.collectionIds) && link.collectionIds.every((id) => typeof id === "string") &&
    Array.isArray(link.tagIds) && link.tagIds.every((id) => typeof id === "string");
}

function hasValidCaptureNote(input: Record<string, unknown>) {
  return (input.noteContent === undefined || typeof input.noteContent === "string") &&
    (input.noteFormat === undefined || input.noteFormat === "plain" || input.noteFormat === "markdown") &&
    (input.existingLink === undefined || (isExistingLink(input.existingLink) &&
      typeof input.noteContent === "string" && (input.noteFormat === "plain" || input.noteFormat === "markdown")));
}

function isCapture(value: unknown): value is ExtensionLinkCapture {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.captureId === "string" &&
    typeof input.url === "string" &&
    typeof input.title === "string" &&
    hasValidCaptureNote(input) &&
    (input.collectionId === undefined || input.collectionId === null || typeof input.collectionId === "string") &&
    (input.tagIds === undefined || (Array.isArray(input.tagIds) && input.tagIds.every((id) => typeof id === "string"))) &&
    (input.collectionName === undefined || typeof input.collectionName === "string") &&
    (input.tagNames === undefined || (Array.isArray(input.tagNames) && input.tagNames.every((name) => typeof name === "string")));
}

function isImageCapture(value: unknown): value is ExtensionImageCapture {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.captureId === "string" &&
    typeof input.sourcePageUrl === "string" &&
    typeof input.mimeType === "string" &&
    input.bytes instanceof Uint8Array &&
    input.bytes.byteLength <= 20 * 1024 * 1024;
}

export function ExtensionBridge() {
  useEffect(() => {
    if (window.parent === window) return;

    function reply(message: Record<string, unknown>, origin: string) {
      window.parent.postMessage({ channel: "keepall-extension", ...message }, origin);
    }

    async function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || !EXTENSION_ORIGINS.some((origin) => origin === event.origin)) return;
      if (event.data?.channel !== "keepall-extension") return;

      if (event.data.type === "organizations") {
        if (typeof event.data.requestId !== "string" || typeof event.data.url !== "string" || event.data.url.length > 8192) return;
        try {
          const options = await getExtensionOrganizationOptions(event.data.url);
          reply({ type: "organizations", requestId: event.data.requestId, ...options }, event.origin);
        } catch {
          reply({ type: "organizations", requestId: event.data.requestId, error: "Could not load collections and tags." }, event.origin);
        }
        return;
      }

      if (event.data.type === "capture-image") {
        if (!isImageCapture(event.data.payload)) return;
        const capture = event.data.payload;
        try {
          const result = await saveExtensionImage(capture);
          if (result.created) window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
          reply({ type: "result", captureId: capture.captureId, ...result }, event.origin);
        } catch (error) {
          const message = error instanceof Error && (
            error.message.includes("PNG, JPEG") ||
            error.message.includes("20 MiB") ||
            error.message.includes("empty")
          ) ? error.message : "Could not save this image to Keepall.";
          reply({ type: "result", captureId: capture.captureId, error: message }, event.origin);
        }
        return;
      }

      if (event.data.type !== "capture" || !isCapture(event.data.payload)) return;

      const capture = event.data.payload;
      try {
        const result = await saveExtensionLink(capture);
        window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
        reply({ type: "result", captureId: capture.captureId, ...result }, event.origin);
      } catch (error) {
        const message = error instanceof Error && (error.message.includes("personal note") || error.message.includes("no longer available") || error.message.includes("changed in Keepall") || error.message.includes("local images"))
          ? error.message
          : "Could not save this link to Keepall.";
        reply({ type: "result", captureId: capture.captureId, error: message }, event.origin);
      }
    }

    window.addEventListener("message", onMessage);
    for (const origin of EXTENSION_ORIGINS) reply({ type: "ready" }, origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return <main className="sr-only">Keepall extension bridge</main>;
}
