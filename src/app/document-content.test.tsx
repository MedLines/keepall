import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { DocumentItem } from "@/domain/document";
import { DocumentContent } from "./document-content";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="pdf-live">Loading PDF…</div> }));

const item: DocumentItem = { id: "pdf", assetId: "pdf-asset", type: "document", format: "pdf", title: "Preview PDF", sourceFileName: "preview.pdf", noteContent: "", tagIds: [], collectionIds: [], createdAt: 1, updatedAt: 1 };

test("keeps the first-page preview until the real first page has painted", async () => {
  render(<DocumentContent item={item} initialPreview={{ pdfImage: "data:image/png;base64,preview" }} />);
  expect(screen.getByRole("img", { name: "First page of Preview PDF" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "PDF page number" })).toBeDisabled();
  const live = screen.getByTestId("pdf-live");
  expect(live.parentElement).toHaveClass("invisible", "absolute");
  const page = document.createElement("div");
  live.append(page);
  page.setAttribute("data-pdf-ready", "2");
  expect(screen.getByRole("img", { name: "First page of Preview PDF" })).toBeVisible();
  page.setAttribute("data-pdf-ready", "1");
  await waitFor(() => expect(live.parentElement).toHaveClass("pdf-preview-reveal"));
  expect(document.querySelector("[data-pdf-opening-preview]")).not.toBeNull();
  fireEvent.animationEnd(live.parentElement!, { animationName: "pdf-preview-reveal" });
  await waitFor(() => expect(screen.queryByRole("img", { name: "First page of Preview PDF" })).toBeNull());
  expect(live.parentElement).not.toHaveClass("invisible", "absolute");
  page.remove();
  expect(screen.queryByRole("img", { name: "First page of Preview PDF" })).toBeNull();
});

test("replaces the PDF preview with recovery controls when rendering fails", async () => {
  render(<DocumentContent item={item} initialPreview={{ pdfImage: "data:image/png;base64,preview" }} />);
  const alert = document.createElement("div");
  alert.setAttribute("role", "alert");
  alert.textContent = "Couldn't read this PDF";
  screen.getByTestId("pdf-live").append(alert);
  await waitFor(() => expect(screen.queryByRole("img", { name: "First page of Preview PDF" })).toBeNull());
  expect(screen.getByTestId("pdf-live").parentElement).not.toHaveClass("invisible");
});
