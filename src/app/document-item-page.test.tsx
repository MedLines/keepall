import { Blob as NodeBlob } from "node:buffer";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { createDocument, getDocumentOriginal } from "@/persistence/documents";
import { getDb } from "@/persistence/db";
import { getItem } from "@/persistence/items";
import * as itemPersistence from "@/persistence/items";
import * as documentPersistence from "@/persistence/documents";
import { DocumentItemPage } from "./document-item-page";
import { DocumentContent, DocumentText } from "./document-content";
import { mockNavigation } from "../../vitest.setup";

const bytes = new TextEncoder().encode("\uFEFF# Original heading\r\n\n- [x] Unicode café مرحبا\n");
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test.each(["txt", "md"])("opens a %s file from its card snapshot while storage reads are pending", async extension => {
  const item = await createDocument({ fileName: `snapshot.${extension}`, bytes: new TextEncoder().encode("Complete saved body"), title: "Snapshot document" });
  vi.spyOn(itemPersistence, "getItem").mockReturnValue(new Promise(() => {}));
  vi.spyOn(documentPersistence, "getDocumentOriginal").mockReturnValue(new Promise(() => {}));
  render(<DocumentItemPage itemId={item.id} returnHref="/" initialSnapshot={{ item, tags: [], collections: [], animate: true, documentPreview: { text: "Already visible card text" } }} />);
  expect(screen.getByRole("heading", { name: "Snapshot document" })).toBeVisible();
  expect(screen.getByText("Already visible card text")).toBeVisible();
  expect(screen.queryByText("Loading document…")).not.toBeInTheDocument();
});

test("edits title and personal notes while preserving the exact original download", async () => {
  const item = await createDocument({ fileName: "source.md", bytes });
  render(<DocumentItemPage itemId={item.id} returnHref="/?type=document" />);
  expect(await screen.findByRole("heading", { name: "Original heading" })).toBeVisible();
  expect(screen.getByRole("checkbox", { name: "Completed checklist item" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Edit document" }));
  await screen.findByLabelText("Markdown content");
  const editor = screen.getByRole("dialog", { name: "Edit document" });
  expect(within(editor).getByLabelText("Markdown content")).toHaveValue(new TextDecoder().decode(bytes).replace(/\r\n/g, "\n"));
  fireEvent.change(within(editor).getByLabelText("Title"), { target: { value: "New title" } });
  fireEvent.change(within(editor).getByLabelText("My note (optional)"), { target: { value: "My separate note" } });
  fireEvent.click(within(editor).getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("heading", { name: "New title", level: 1 })).toBeVisible();
  expect(screen.getByRole("region", { name: "Personal note" })).toHaveTextContent("My separate note");
  expect((await getDocumentOriginal(item.id))?.bytes).toEqual(bytes);
  let downloaded: NodeBlob | undefined;
  vi.stubGlobal("Blob", NodeBlob);
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => { downloaded = blob as unknown as NodeBlob; return "blob:download"; });
  const revoked = vi.spyOn(URL, "revokeObjectURL");
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toBe("source.md"); });
  fireEvent.click(screen.getByRole("button", { name: "Download file" }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(Array.from(new Uint8Array(await downloaded!.arrayBuffer()))).toEqual(Array.from(bytes));
  await waitFor(() => expect(revoked).toHaveBeenCalledWith("blob:download"));
});

test("missing originals provide recovery controls and keep personal notes readable", async () => {
  const item = await createDocument({ fileName: "lost.txt", bytes, noteContent: "Still saved" });
  await getDb().documentAssets.delete(item.assetId);
  render(<DocumentItemPage itemId={item.id} returnHref="/" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("saved file is missing");
  expect(screen.getByText("Still saved")).toBeVisible();
  expect(screen.getByRole("link", { name: "Open backups" })).toHaveAttribute("href", "/settings#storage");
  await getDb().documentAssets.put({ id: item.assetId, bytes, byteLength: bytes.length, contentHash: "restored", createdAt: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Retry document" }));
  expect(await screen.findByText(/# Original heading/)).toBeVisible();
});

test.each(["txt", "md"])("Edit loads a %s file's body, preserves canceled changes, and saves new text", async (extension) => {
  const item = await createDocument({ fileName: `editable.${extension}`, bytes: new TextEncoder().encode("Original body") });
  render(<DocumentItemPage itemId={item.id} returnHref="/" />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit document" }));
  const label = extension === "md" ? "Markdown content" : "Text content";
  const content = await screen.findByLabelText(label);
  expect(content).toHaveValue("Original body");
  fireEvent.change(content, { target: { value: "Discard this edit" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  const confirmation = await screen.findByRole("dialog", { name: "Discard unsaved changes?" });
  fireEvent.click(within(confirmation).getByRole("button", { name: "Discard changes" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit document" })).toBeNull());
  expect(new TextDecoder().decode((await getDocumentOriginal(item.id))?.bytes)).toBe("Original body");
  fireEvent.click(screen.getByRole("button", { name: "Edit document" }));
  fireEvent.change(await screen.findByLabelText(label), { target: { value: "Updated body مرحبا" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit document" })).toBeNull());
  expect(await screen.findByText("Updated body مرحبا")).toBeVisible();
  expect(new TextDecoder().decode((await getDocumentOriginal(item.id))?.bytes)).toBe("Updated body مرحبا");
  fireEvent.click(screen.getByRole("button", { name: "Edit document" }));
  expect(await screen.findByLabelText(label)).toHaveValue("Updated body مرحبا");
});

test("Trash uses confirmation, keeps the original, and returns to the current library scope", async () => {
  const item = await createDocument({ fileName: "trash.txt", bytes });
  render(<DocumentItemPage itemId={item.id} returnHref="/?type=document" />);
  fireEvent.click(await screen.findByRole("button", { name: "Move document to Trash" }));
  expect(await getItem(item.id)).toBeDefined();
  const confirm = await screen.findByRole("dialog", { name: "Move this document to Trash?" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Move to Trash" }));
  await waitFor(() => expect(mockNavigation.push).toHaveBeenCalledWith("/?type=document"));
  expect(await getItem(item.id)).toBeNull();
  expect((await getDocumentOriginal(item.id))?.bytes).toEqual(bytes);
});

test("organizes a document through the existing collection drawer", async () => {
  const item = await createDocument({ fileName: "organize.txt", bytes });
  render(<DocumentItemPage itemId={item.id} returnHref="/" />);
  fireEvent.click(await screen.findByRole("button", { name: "Organize" }));
  const organizer = await screen.findByRole("dialog", { name: /Organize organize/ });
  fireEvent.change(within(organizer).getByRole("textbox", { name: "Move to collection" }), { target: { value: "Reading" } });
  fireEvent.keyDown(within(organizer).getByRole("textbox", { name: "Move to collection" }), { key: "Enter" });
  await waitFor(async () => expect((await getItem(item.id))?.collectionIds).toHaveLength(1));
});

test("large document previews are explicitly shortened and plain text remains literal", () => {
  const { container } = render(<DocumentText text={"<script>literal</script>\n" + "a".repeat(210_000)} format="text" />);
  expect(screen.getByRole("status")).toHaveTextContent("Download the file");
  expect(container.querySelector("script")).toBeNull();
  expect(container.textContent).toContain("<script>literal</script>");
  expect(container.textContent!.length).toBeLessThan(201_000);
});

test("quick-preview navigation discards a late read for the previous document", async () => {
  const first = await createDocument({ fileName: "first.txt", bytes });
  const second = await createDocument({ fileName: "second.txt", bytes: new TextEncoder().encode("Second body") });
  let finish!: (value: Awaited<ReturnType<typeof getDocumentOriginal>>) => void;
  const documentPersistence = await import("@/persistence/documents");
  vi.spyOn(documentPersistence, "getDocumentOriginal").mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const view = render(<DocumentContent item={first} />);
  view.rerender(<DocumentContent item={second} />);
  expect(await screen.findByText("Second body")).toBeVisible();
  finish({ id: first.assetId, bytes, byteLength: bytes.length, contentHash: "hash", createdAt: 1 });
  await waitFor(() => expect(screen.queryByText(/# Original heading/)).toBeNull());
});
