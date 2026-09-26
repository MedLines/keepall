"use client";

import { useEffect } from "react";
import { getExtensionOrganizationOptions, saveExtensionImage, saveExtensionLink, type ExtensionImageCapture, type ExtensionLinkCapture } from "@/persistence/extension-capture";
import { ITEMS_CHANGED_EVENT } from "../items-events";
import { getCaptureCollections, moveCaptureToCollection } from "@/persistence/extension-collections";
import { undoExtensionCapture } from "@/persistence/extension-capture-undo";

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

async function undoCaptureReply(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.captureId !== "string" || input.captureId.length > 100 ||
      typeof input.undoToken !== "string" || input.undoToken.length > 100) return null;
  try {
    const itemId = await undoExtensionCapture(input.undoToken);
    window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    return { type: "result", captureId: input.captureId, itemId, undone: true };
  } catch (error) {
    const message = error instanceof Error && (error.message.includes("Undo has expired") || error.message.includes("changed after saving"))
      ? error.message : "Could not undo this save. Try again.";
    return { type: "result", captureId: input.captureId, error: message };
  }
}

async function captureCollectionsReply(type: string, value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.captureId !== "string" || input.captureId.length > 100 ||
      typeof input.itemId !== "string" || input.itemId.length > 100) return null;
  const base = { type: "result", captureId: input.captureId, itemId: input.itemId };
  try {
    if (type === "capture-collections") return { ...base, ...await getCaptureCollections(input.itemId) };
    if ((input.collectionId !== null && (typeof input.collectionId !== "string" || input.collectionId.length > 100)) ||
        !Array.isArray(input.expectedCollectionIds) || input.expectedCollectionIds.length > 1 ||
        !input.expectedCollectionIds.every((id) => typeof id === "string" && id.length <= 100)) {
      return { ...base, error: "Choose a collection and try again." };
    }
    const result = await moveCaptureToCollection(input.itemId, input.collectionId as string | null, input.expectedCollectionIds);
    if (result.changed) window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));
    return { ...base, ...result };
  } catch (error) {
    const message = error instanceof Error && (error.message.includes("no longer available") || error.message.includes("changed in Keepall"))
      ? error.message : "Could not organize this item. Try again.";
    return { ...base, error: message };
  }
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

      if (event.data.type === "capture-collections" || event.data.type === "move-capture") {
        const result = await captureCollectionsReply(event.data.type, event.data.payload);
        if (result) reply(result, event.origin);
        return;
      }

      if (event.data.type === "undo-capture") {
        const result = await undoCaptureReply(event.data.payload);
        if (result) reply(result, event.origin);
        return;
      }

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
