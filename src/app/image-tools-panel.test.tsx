import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildImage } from "@/domain/image";
import { ImageToolsPanel } from "./image-tools-panel";
import { getDb } from "@/persistence/db";

vi.mock("./image-analysis-client", () => ({
  extractImagePalette: vi.fn(async (assetId: string) => ({ assetId, palette: ["#FF0000"] })),
  recognizeImageText: vi.fn((_: string, signal: AbortSignal) => new Promise((_, reject) => { signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError"))); })),
}));

describe("image tools", () => {
  it("saves a palette and exposes color filters and labeled copy values", async () => {
    const item = buildImage({ assetId: "a" }, { id: "image" });
    await getDb().items.put(item);
    const view = render(<ImageToolsPanel item={item} assetId="a" slide={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Extract palette" }));
    await screen.findByText("Palette saved");
    const saved = await getDb().items.get(item.id);
    if (!saved || saved.type !== "image") throw new Error("Missing saved image");
    view.rerender(<ImageToolsPanel item={saved} assetId="a" slide={0} />);
    expect(screen.getByRole("button", { name: "Copy color #FF0000" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Find similar red images" })).toHaveAttribute("href", "/?q=color%3A%23FF0000");
  });
  it("cancels pending OCR and releases controls without saving text", async () => {
    const item = buildImage({ assetId: "a" }, { id: "image" });
    await getDb().items.put(item);
    render(<ImageToolsPanel item={item} assetId="a" slide={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Read text" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled());
    // Wait until lazy import has connected recognition to the abort signal.
    const tools = await import("./image-analysis-client");
    await waitFor(() => expect(tools.recognizeImageText).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("Cancelled");
    expect(screen.getByRole("button", { name: "Read text" })).toBeEnabled();
    expect((await getDb().items.get(item.id))).not.toHaveProperty("analysis");
  });
});
