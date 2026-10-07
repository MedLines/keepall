import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  afterEach(() => vi.unstubAllGlobals());
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
    expect(screen.getByRole("link", { name: "Find similar red images" })).toHaveAttribute("href", "/?q=color%3A%23FF0000");
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

  it("copies a swatch and announces the copied value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const item = { ...buildImage({ assetId: "a" }), analysis: [{ assetId: "a", palette: ["#345D4C"] }] };
    render(<Tools item={item} assetId="a" slide={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy color #345D4C" }));
    expect(writeText).toHaveBeenCalledWith("#345D4C");
    expect(await screen.findByRole("status")).toHaveTextContent("Copied #345D4C");
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
