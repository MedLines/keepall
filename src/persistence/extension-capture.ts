import { normalizeItem } from "@/domain/item";
import { buildLink, normalizeLinkUrl } from "@/domain/link";
import { getDb } from "./db";

export type ExtensionLinkCapture = {
  captureId: string;
  url: string;
  title: string;
  noteContent?: string;
};

export async function saveExtensionLink(
  input: ExtensionLinkCapture,
): Promise<{ itemId: string; created: boolean }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.captureId)) {
    throw new Error("Invalid capture ID");
  }
  if (input.url.length > 8192 || input.title.length > 500 || (input.noteContent?.length ?? 0) > 10000) {
    throw new Error("Capture is too large");
  }

  const normalizedUrl = normalizeLinkUrl(input.url);
  if (!normalizedUrl) {
    throw new Error("Enter an http or https URL");
  }

  const db = getDb();
  return db.transaction("rw", db.items, async () => {
    const prior = await db.items.get(input.captureId);
    if (prior) {
      const item = normalizeItem(prior);
      if (item.type !== "link" || normalizeLinkUrl(item.url) !== normalizedUrl) {
        throw new Error("Capture ID already belongs to another item");
      }
      return { itemId: item.id, created: false };
    }

    const links = await db.items.where("type").equals("link").toArray();
    for (const raw of links) {
      const link = normalizeItem(raw);
      if (link.type !== "link" || normalizeLinkUrl(link.url) !== normalizedUrl) {
        continue;
      }

      const nextNote = input.noteContent?.trim() ?? "";
      if (nextNote && link.noteContent?.trim() && link.noteContent.trim() !== nextNote) {
        throw new Error("This link already has a personal note. Edit it in Keepall.");
      }
      if ((!link.title && input.title.trim()) || (nextNote && !link.noteContent?.trim())) {
        await db.items.put({
          ...link,
          title: link.title || input.title.trim(),
          ...(nextNote && !link.noteContent?.trim() ? { noteContent: nextNote } : {}),
          updatedAt: Date.now(),
        });
      }
      return { itemId: link.id, created: false };
    }

    const link = buildLink({
      url: input.url,
      title: input.title,
      noteContent: input.noteContent,
    }, { id: input.captureId });
    await db.items.add(link);
    return { itemId: link.id, created: true };
  });
}
