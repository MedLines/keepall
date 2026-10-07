import { afterEach, expect, test, vi } from "vitest";
import type { DocumentItem } from "@/domain/document";
import { getDocumentPreview } from "@/persistence/document-preview";
import { prepareDocumentNavigationPreview, prepareItemNavigation, readItemNavigation } from "./item-navigation-snapshot";

vi.mock("@/persistence/document-preview", () => ({ getDocumentPreview: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
const item: DocumentItem = { id: "navigation-document", type: "document", format: "text", assetId: "navigation-asset", title: "Saved file", sourceFileName: "saved.txt", noteContent: "", collectionIds: [], tagIds: [], createdAt: 1, updatedAt: 1 };

test("prepares one bounded preview on intent and hands it to list navigation", async () => {
  vi.mocked(getDocumentPreview).mockResolvedValue("Ready list preview");
  prepareDocumentNavigationPreview(item);
  prepareDocumentNavigationPreview(item);
  await Promise.resolve();
  expect(getDocumentPreview).toHaveBeenCalledTimes(1);
  prepareItemNavigation({ item, tags: [], collections: [], animate: true });
  expect(readItemNavigation(item.id)?.documentPreview?.text).toBe("Ready list preview");
});

test("a changed document cannot reuse the earlier content preview", async () => {
  const newer = { ...item, updatedAt: 2 };
  prepareItemNavigation({ item: newer, tags: [], collections: [], animate: true });
  expect(readItemNavigation(item.id)?.documentPreview?.text).toBeUndefined();
  vi.mocked(getDocumentPreview).mockResolvedValue("Edited body");
  prepareDocumentNavigationPreview(newer);
  await Promise.resolve();
  prepareItemNavigation({ item: newer, tags: [], collections: [], animate: true });
  expect(readItemNavigation(item.id)?.documentPreview?.text).toBe("Edited body");
});

test("PDF intent does not read text or original bytes", () => {
  prepareDocumentNavigationPreview({ ...item, format: "pdf" });
  expect(getDocumentPreview).not.toHaveBeenCalled();
});
