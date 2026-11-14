// Invented library items for stories. Every URL uses an .example domain.
import type { DocumentItem } from "@/domain/document";
import type { ImageItem } from "@/domain/image";
import type { Item } from "@/domain/item";
import type { LinkItem } from "@/domain/link";
import type { NoteItem } from "@/domain/note";
import type { VideoItem } from "@/domain/video";

const base = { tagIds: [], collectionIds: [], createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000 };

export const noteItem: NoteItem = {
  ...base, id: "note-1", type: "note", title: "Tide table reminders",
  content: "Check the low-water time before leaving. Bring the red torch and the small field guide.",
};

export const markdownNoteItem: NoteItem = { ...noteItem, id: "note-2", title: "Packing list", format: "markdown", content: "## Packing\n- Boots\n- Field guide" };

export const linkItem: LinkItem = {
  ...base, id: "link-1", type: "link", title: "A beginner’s guide to tide pools", url: "https://tidepools.example/guide",
  noteContent: "Read the section on anemones before Saturday.",
  previewStatus: "ready", previewTitle: "A beginner’s guide to tide pools", previewDescription: "What lives between the tides and how to look without disturbing it.",
  previewImageUrl: "", previewAssetId: null, previewRetry: null, previewAttemptedAt: null,
};

export const linkWithScreenshotsItem: LinkItem = {
  ...linkItem, id: "link-2",
  screenshots: [
    { assetId: "shot-a", capturedAt: 1_700_000_000_000, width: 1280, height: 800 },
    { assetId: "shot-b", capturedAt: 1_700_000_000_000, width: 1280, height: 800 },
  ],
};

export const imageItem: ImageItem = {
  ...base, id: "image-1", type: "image", title: "Rock pool at dusk", assetIds: ["asset-1"],
  sourceUrl: "https://photos.example/rock-pool", caption: "Taken on the north side of the cove.",
};

export const galleryItem: ImageItem = { ...imageItem, id: "image-2", title: "Shore walk", assetIds: ["asset-1", "asset-2", "asset-3", "asset-4"] };

export const videoItem: VideoItem = {
  ...base, id: "video-1", type: "video", title: "Waves on the breakwater", noteContent: "", sourceFileName: "breakwater.mp4", assetId: "asset-video",
};

const documentBase = { ...base, noteContent: "", assetId: "asset-doc" };
export const pdfItem: DocumentItem = { ...documentBase, id: "doc-pdf", type: "document", format: "pdf", title: "Coastal field guide", sourceFileName: "coastal-field-guide.pdf" };
export const textItem: DocumentItem = { ...documentBase, id: "doc-txt", type: "document", format: "text", title: "Trail notes", sourceFileName: "trail-notes.txt" };
export const markdownItem: DocumentItem = { ...documentBase, id: "doc-md", type: "document", format: "markdown", title: "Field checklist", sourceFileName: "field-checklist.md" };

/** One item of every type, in the order the conventions list their colors. */
export const itemsByType: { name: string; item: Item }[] = [
  { name: "PDF", item: pdfItem },
  { name: "TXT", item: textItem },
  { name: "MD document", item: markdownItem },
  { name: "Note", item: noteItem },
  { name: "Markdown note", item: markdownNoteItem },
  { name: "Image", item: imageItem },
  { name: "Gallery", item: galleryItem },
  { name: "Link", item: linkItem },
  { name: "Link with screenshots", item: linkWithScreenshotsItem },
  { name: "Video", item: videoItem },
];

export const collections = [{ id: "col-1", name: "Weekend recipes" }];
export const longCollection = [{ id: "col-2", name: "A collection with a very long name that will need truncating" }];
export const tags = [{ id: "tag-1", name: "coast" }, { id: "tag-2", name: "field-trip" }, { id: "tag-3", name: "to-read" }];
