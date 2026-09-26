import { normalizeItem } from "@/domain/item";
import { buildLink, normalizeLinkUrl, type LinkItem } from "@/domain/link";
import { getDb } from "./db";
import { createCaptureUndo } from "./extension-capture-undo";

export type ExtensionSelection = { captureId: string; url: string; title: string; text: string };

export async function saveExtensionSelection(input: ExtensionSelection) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.captureId)) throw new Error("Invalid capture ID");
  const url = normalizeLinkUrl(input.url);
  if (!url || input.url.length > 8192) throw new Error("This page cannot be saved to Keepall.");
  const text = input.text.trim();
  if (!text) throw new Error("Select some text to save first.");
  if (text.length > 10000 || input.title.length > 500) throw new Error("This selection is too long. Select less text and try again.");
  const db = getDb();
  const sameSource = (source: string) => normalizeLinkUrl(source) === url && new URL(source).port === new URL(input.url).port;
  return db.transaction("rw", db.items, async () => {
    const prior = await db.items.get(input.captureId);
    if (prior && (prior.type !== "link" || !sameSource(prior.url))) throw new Error("Invalid capture ID");
    const rows = await db.items.where("type").equals("link").toArray();
    const existing = rows.map(normalizeItem).find((item) => item.type === "link" && sameSource(item.url));
    if (existing?.type === "link") {
      // Treat selected page text literally, including when the existing note is Markdown.
      const literal = existing.noteFormat === "markdown" ? text.replace(/[!-/:-@\[-`{-~]/g, "\\$&") : text;
      const previous = existing.noteContent ?? "";
      if (`\n\n${previous.trim()}\n\n`.includes(`\n\n${literal}\n\n`)) {
        return { itemId: existing.id, created: false, outcome: "unchanged" };
      }
      const noteContent = previous ? `${previous}\n\n${literal}` : literal;
      if (noteContent.length > 10000) throw new Error("This note is full. Shorten it in Keepall before adding more text.");
      const updated: LinkItem = { ...existing, noteContent, updatedAt: Date.now() };
      await db.items.put(updated);
      return { itemId: existing.id, created: false, outcome: "updated" };
    }
    const item = buildLink({ url: input.url, title: input.title, noteContent: text, noteFormat: "plain" }, { id: input.captureId });
    await db.items.add(item);
    return { itemId: item.id, created: true, outcome: "created", undoToken: createCaptureUndo(item) };
  });
}
