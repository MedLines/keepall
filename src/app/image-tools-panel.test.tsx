import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildImage } from "@/domain/image";
import type { ImageAnalysis } from "@/domain/image-analysis";
import { ImageToolsPanel } from "./image-tools-panel";
import { CurrentImageMenu } from "./image-actions-menu";
import type { ComponentProps } from "react";
import { getDb } from "@/persistence/db";

vi.mock("./image-analysis-client", () => ({
  extractImagePalette: vi.fn(async (assetId: string) => ({ assetId, palette: ["#FF0000"] })),
  recognizeImageText: vi.fn((_: string, signal: AbortSignal) => new Promise<ImageAnalysis>((_, reject) => { signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError"))); })),
}));

function Tools(props: ComponentProps<typeof ImageToolsPanel>) {
  return <ImageToolsPanel {...props}><CurrentImageMenu busy={false} canRemove={false} onReplace={() => {}} onRemove={() => {}} /></ImageToolsPanel>;
}

async function chooseTool(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "Current image actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: label }));
}

async function openToolMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Current image actions" }));
  return screen.findByRole("menu");
}

describe("image tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("saves a palette and exposes color filters and labeled copy values", async () => {
    const item = buildImage({ assetId: "a" }, { id: "image" });
    await getDb().items.put(item);
    const view = render(<Tools item={item} assetId="a" slide={0} />);
    await chooseTool("Extract palette");
    await screen.findByText("Palette saved");
    const saved = await getDb().items.get(item.id);
    if (!saved || saved.type !== "image") throw new Error("Missing saved image");
    view.rerender(<Tools item={saved} assetId="a" slide={0} />);
    expect(screen.getByRole("button", { name: "Copy color #FF0000" })).toBeVisible();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Copy color #FF0000" }));
    expect(await screen.findByRole("menuitem", { name: "Search library for nearby colors" })).toHaveAttribute("href", "/?q=color%3A%23FF0000");
  });
  it("cancels pending OCR and releases controls without saving text", async () => {
    const item = buildImage({ assetId: "a" }, { id: "image" });
    await getDb().items.put(item);
    render(<Tools item={item} assetId="a" slide={0} />);
    await chooseTool("Read text");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled());
    // Wait until lazy import has connected recognition to the abort signal.
    const tools = await import("./image-analysis-client");
    await waitFor(() => expect(tools.recognizeImageText).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("Cancelled");
    await openToolMenu();
    expect(screen.getByRole("menuitem", { name: "Read text" })).toBeEnabled();
    expect((await getDb().items.get(item.id))).not.toHaveProperty("analysis");
  });

  it("copies a swatch with transient SVG feedback and no visible copied text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const item = { ...buildImage({ assetId: "a" }), analysis: [{ assetId: "a", palette: ["#345D4C"] }] };
    render(<Tools item={item} assetId="a" slide={0} />);
    const swatch = screen.getByRole("button", { name: "Copy color #345D4C" });
    expect(swatch).toHaveTextContent("#345D4C");
    expect(swatch.querySelectorAll("svg")).toHaveLength(2);
    fireEvent.click(swatch);
    expect(writeText).toHaveBeenCalledWith("#345D4C");
    await waitFor(() => expect(swatch.querySelector("[data-copy-feedback]")).toHaveAttribute("data-copied", "true"));
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    expect(screen.queryByText("Copied #345D4C")).toBeNull();
    vi.useFakeTimers();
    fireEvent.click(swatch);
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
    expect(swatch.querySelector("[data-copy-feedback]")).toHaveAttribute("data-copied", "false");
  });

  it("opens actions for the right-clicked color without copying until Copy is selected", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const item = { ...buildImage({ assetId: "a" }), analysis: [{ assetId: "a", palette: ["#FF0000", "#0000FF"] }] };
    render(<Tools item={item} assetId="a" slide={0} />);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Copy color #0000FF" }), { clientX: 100, clientY: 100 });
    const blueMenu = await screen.findByRole("menu", { name: "Color #0000FF" });
    expect(blueMenu).toBeVisible();
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: "Search library for nearby colors" })).toHaveAttribute("href", "/?q=color%3A%230000FF");
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy color" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith("#0000FF"));
    await waitFor(() => expect(!blueMenu.isConnected || blueMenu.hasAttribute("data-closed")).toBe(true));
    fireEvent.contextMenu(screen.getByRole("button", { name: "Copy color #FF0000" }));
    const redMenu = await screen.findByRole("menu", { name: "Color #FF0000" });
    expect(redMenu.querySelector("a")).toHaveAttribute("href", "/?q=color%3A%23FF0000");
  });

  it.each([{ key: "ContextMenu" }, { key: "F10", shiftKey: true }])("opens swatch actions from the keyboard: $key", async keys => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const item = { ...buildImage({ assetId: "a" }), analysis: [{ assetId: "a", palette: ["#345D4C"] }] };
    render(<Tools item={item} assetId="a" slide={0} />);
    const swatch = screen.getByRole("button", { name: "Copy color #345D4C" });
    swatch.focus();
    fireEvent.keyDown(swatch, keys);
    expect(await screen.findByRole("menu", { name: "Color #345D4C" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Search library for nearby colors" })).toHaveAttribute("href", "/?q=color%3A%23345D4C");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("keeps the text copy action before the final collapse control", () => {
    const item = { ...buildImage({ assetId: "a" }), analysis: [{ assetId: "a", palette: ["#FF0000"], ocr: { text: "Invoice 4823", confidence: 81, language: "eng" as const, extractedAt: 1 } }] };
    render(<Tools item={item} assetId="a" slide={0} />);
    const copy = screen.getByRole("button", { name: "Copy text" });
    const collapse = screen.getByRole("button", { name: "Screenshot text" });
    expect(copy.parentElement?.lastElementChild).toBe(collapse);
    expect(copy.nextElementSibling).toBe(collapse);
    expect(collapse).toHaveAttribute("title", "Collapse Screenshot text");
    fireEvent.click(copy);
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(collapse);
    expect(collapse).toHaveAttribute("title", "Expand Screenshot text");
    expect(screen.getByRole("button", { name: "Palette" }).parentElement?.lastElementChild).toBe(screen.getByRole("button", { name: "Palette" }));
  });

  it("hides and restores palette and text independently without changing saved results", () => {
    const item = { ...buildImage({ assetId: "a" }), analysis: [{ assetId: "a", palette: ["#FF0000"], ocr: { text: "Invoice 4823", confidence: 81, language: "eng" as const, extractedAt: 1 } }] };
    render(<Tools item={item} assetId="a" slide={0} />);
    const palette = screen.getByRole("button", { name: "Palette" });
    const text = screen.getByRole("button", { name: "Screenshot text" });
    fireEvent.click(palette);
    expect(palette).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("region", { name: "Extracted text from image 1" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Copy color #FF0000" })).toBeNull();
    fireEvent.click(text);
    expect(text).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Extracted text from image 1" })).toBeNull();
    fireEvent.click(palette);
    expect(screen.getByRole("button", { name: "Copy color #FF0000" })).toBeVisible();
    expect(text).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(text);
    expect(screen.getByRole("region", { name: "Extracted text from image 1" })).toHaveTextContent("Invoice 4823");
    expect(item.analysis[0].palette).toEqual(["#FF0000"]);
  });

  it("keeps readable text and copy actions specific to the current gallery image", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const text = "Invoice 4823\n\nTotal 120 dollars";
    const item = { ...buildImage({ assetId: "a" }), assetIds: ["a", "b"], analysis: [{ assetId: "a", ocr: { text, confidence: 81, language: "eng" as const, extractedAt: 1 } }] };
    const view = render(<Tools key="a" item={item} assetId="a" slide={0} />);
    expect(screen.getByRole("region", { name: "Extracted text from image 1" }).textContent).toBe(text);
    fireEvent.click(screen.getByRole("button", { name: "Copy text" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(text));
    const copy = screen.getByRole("button", { name: "Copy text" });
    expect(copy).toHaveTextContent("");
    expect(copy.querySelectorAll("svg")).toHaveLength(2);
    await waitFor(() => expect(copy.querySelector("[data-copy-feedback]")).toHaveAttribute("data-copied", "true"));
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    expect(screen.queryByText("Copied")).toBeNull();
    view.rerender(<Tools key="b" item={item} assetId="b" slide={1} />);
    expect(screen.queryByText("Invoice 4823", { exact: false })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy text" })).toBeNull();
    await openToolMenu();
    expect(screen.getByRole("menuitem", { name: "Read text" })).toBeEnabled();
  });

  it("offers an explicit retry after recognition fails", async () => {
    const tools = await import("./image-analysis-client");
    vi.mocked(tools.recognizeImageText).mockRejectedValueOnce(new Error("Couldn't read this image."));
    vi.mocked(tools.recognizeImageText).mockResolvedValueOnce({ assetId: "a", ocr: { text: "Invoice 4823", confidence: 95, language: "eng", extractedAt: 1 } });
    const item = buildImage({ assetId: "a" }, { id: "image" });
    await getDb().items.put(item);
    render(<Tools item={item} assetId="a" slide={0} />);
    await chooseTool("Read text");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't read this image.");
    await chooseTool("Retry reading text");
    await screen.findByText("Text saved and searchable");
    expect(await getDb().items.get(item.id)).toHaveProperty("analysis.0.ocr.text", "Invoice 4823");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("aborts recognition when moving to a different gallery image", async () => {
    const tools = await import("./image-analysis-client");
    const item = { ...buildImage({ assetId: "a" }, { id: "image" }), assetIds: ["a", "b"] };
    await getDb().items.put(item);
    const view = render(<Tools key="a" item={item} assetId="a" slide={0} />);
    await chooseTool("Read text");
    await waitFor(() => expect(tools.recognizeImageText).toHaveBeenCalled());
    const signal = vi.mocked(tools.recognizeImageText).mock.calls[0][1];
    view.rerender(<Tools key="b" item={item} assetId="b" slide={1} />);
    expect(signal.aborted).toBe(true);
    await openToolMenu();
    expect(screen.getByRole("menuitem", { name: "Read text" })).toBeEnabled();
    expect((await getDb().items.get(item.id))).not.toHaveProperty("analysis");
  });
});
