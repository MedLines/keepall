import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocalAssetImage } from "./local-asset-image";

const { acquire } = vi.hoisted(() => ({ acquire: vi.fn() }));
vi.mock("./asset-object-url-cache", () => ({ acquireAssetObjectUrl: acquire, peekAssetObjectUrl: () => null }));

test("missing local assets reach an unavailable state instead of loading forever", async () => {
  acquire.mockReturnValue({ promise: Promise.resolve(null), release: vi.fn() });
  render(<LocalAssetImage assetId="missing" alt="Article chart" />);
  expect(await screen.findByText("Image unavailable. Article chart")).toHaveAttribute("role", "img");
});

test("failed image decoding shows a placeholder and another asset can still load", async () => {
  acquire.mockImplementation((id: string) => ({ promise: Promise.resolve(`blob:${id}`), release: vi.fn() }));
  const { rerender } = render(<LocalAssetImage assetId="broken" alt="Article chart" />);
  const image = await screen.findByAltText("Article chart");
  fireEvent.error(image);
  expect(screen.getByText("Image unavailable. Article chart")).toBeVisible();
  rerender(<LocalAssetImage assetId="working" alt="Second chart" />);
  expect(await screen.findByAltText("Second chart")).toHaveAttribute("src", "blob:working");
});
