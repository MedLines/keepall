import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { buildImage } from "@/domain/image";
import { buildLink } from "@/domain/link";
import { buildNote } from "@/domain/note";
import { buildVideo } from "@/domain/video";
import { createVideo } from "@/persistence/videos";
import { LibraryQuickPreview } from "./library-quick-preview";

afterEach(() => vi.restoreAllMocks());

const callbacks = () => ({ onMove: vi.fn(), onClose: vi.fn(), onOpenItem: vi.fn(), returnFocus: () => null });

test("reads saved link notes safely and keeps source navigation explicit", async () => {
  const item = buildLink({ url: "https://example.com/article", title: "An article", noteContent: "## Context\nWhy I saved this.", noteFormat: "markdown" }, { id: "link", now: 1 });
  const actions = callbacks();
  render(<LibraryQuickPreview item={item} index={0} count={2} {...actions} />);
  expect(await screen.findByRole("heading", { name: "Context" })).toBeVisible();
  expect(screen.getByRole("link", { name: `Open source: ${item.url}` })).toHaveAttribute("href", item.url);
  expect(actions.onOpenItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Open full item" }));
  expect(actions.onOpenItem).toHaveBeenCalledWith(item);
});

test("loads the local video, preserves native playback keys, and releases its object URL on item change", async () => {
  const item = await createVideo(new File(["test video"], "local.webm", { type: "video/webm" }), null, "Local recording");
  const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:quick-preview-video");
  const revokeUrl = vi.spyOn(URL, "revokeObjectURL");
  const actions = callbacks();
  const { rerender } = render(<LibraryQuickPreview item={item} index={0} count={2} {...actions} />);
  const video = await screen.findByLabelText("Local recording", { selector: "video" });
  await waitFor(() => expect(video).toHaveAttribute("src", "blob:quick-preview-video"));
  expect(video).toHaveAttribute("controls");
  expect(video).not.toHaveAttribute("autoplay");
  expect(video).toHaveAttribute("data-ready", "false");
  expect(screen.getByRole("status", { name: "Loading video" })).toBeInTheDocument();
  fireEvent.loadedMetadata(video);
  expect(video).toHaveAttribute("data-ready", "true");
  expect(screen.queryByRole("status", { name: "Loading video" })).not.toBeInTheDocument();
  fireEvent.keyDown(video, { key: "ArrowRight" });
  fireEvent.keyDown(video, { key: " " });
  expect(actions.onMove).not.toHaveBeenCalled();
  expect(actions.onClose).not.toHaveBeenCalled();
  const note = buildNote({ title: "Next note", content: "Saved text" }, { id: "note", now: 2 });
  rerender(<LibraryQuickPreview item={note} index={1} count={2} {...actions} />);
  await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith("blob:quick-preview-video"));
  expect(createUrl).toHaveBeenCalledTimes(1);
});

test("missing local video shows a recovery path without preventing navigation", async () => {
  const item = buildVideo({ assetId: "missing", fileName: "missing.webm", title: "Missing video" }, { id: "video", now: 1 });
  const actions = callbacks();
  render(<LibraryQuickPreview item={item} index={0} count={2} {...actions} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Open the full item to retry");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
  expect(actions.onMove).toHaveBeenCalledWith(1);
});

test("untitled image captions and note bodies appear once as content rather than becoming titles", async () => {
  const caption = "Long saved context that belongs below the image.";
  const item = buildImage({ assetId: "missing-image", caption }, { id: "image", now: 1 });
  const actions = callbacks();
  const { rerender } = render(<LibraryQuickPreview item={item} index={0} count={2} {...actions} />);
  expect(await screen.findByRole("dialog", { name: "Image" })).toBeVisible();
  expect(screen.getAllByText(caption)).toHaveLength(1);
  const note = buildNote({ content: "Saved plain text with no title." }, { id: "note", now: 2 });
  rerender(<LibraryQuickPreview item={note} index={1} count={2} {...actions} />);
  expect(screen.getByRole("dialog", { name: "Untitled note" })).toBeVisible();
  expect(screen.getAllByText(note.content)).toHaveLength(1);
});

test("uses the explicit title in the header while keeping instructions available to assistive technology", async () => {
  const title = "An explicitly saved title ".repeat(12);
  const item = buildNote({ title, content: "The note body." }, { id: "note", now: 1 });
  render(<LibraryQuickPreview item={item} index={0} count={1} {...callbacks()} />);
  expect(await screen.findByRole("dialog", { name: title.trim() })).toHaveAccessibleDescription("Quick preview. Arrows browse items. Enter opens the full item.");
  expect(screen.getByRole("heading")).toHaveTextContent(title.trim());
  expect(screen.getByText(item.content)).toBeVisible();
});
