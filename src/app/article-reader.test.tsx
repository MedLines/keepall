import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { buildLink } from "@/domain/link";
import { ArticleReader } from "./article-reader";
import { saveLinkArticle } from "@/persistence/articles";

vi.mock("@/persistence/articles", () => ({ saveLinkArticle: vi.fn() }));
const article = { title: "Offline reporting", text: "First paragraph.\n\n<script>alert(1)</script>\n\nLast paragraph.", sourceUrl: "https://example.com/story", capturedAt: 100, author: "Ada Writer" };

test("renders escaped saved text, metadata, original and notes independently without fetching", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const link = { ...buildLink({ url: article.sourceUrl, noteContent: "Personal thoughts" }), article };
  const { container } = render(<ArticleReader link={link} onSaved={vi.fn()} />);
  expect(screen.getByRole("heading", { name: article.title })).toBeVisible();
  expect(screen.getByRole("article", { name: "Article text" })).toHaveTextContent("<script>alert(1)</script>");
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByText(/Ada Writer/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Open original" })).toHaveAttribute("href", article.sourceUrl);
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test("failed capture leaves saved text available and lets the user retry", async () => {
  const link = { ...buildLink({ url: article.sourceUrl }), article };
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: "Website needs a login." }), { status: 422 })).mockResolvedValueOnce(new Response(JSON.stringify(article)));
  vi.stubGlobal("fetch", fetch);
  vi.mocked(saveLinkArticle).mockResolvedValue(link);
  const onSaved = vi.fn();
  render(<ArticleReader link={link} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: "Update saved article" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Website needs a login.");
  expect(screen.getByRole("article", { name: "Article text" })).toHaveTextContent("First paragraph.");
  fireEvent.click(screen.getByRole("button", { name: "Retry saving article" }));
  await screen.findByText("Article saved for offline reading.");
  expect(onSaved).toHaveBeenCalledWith(link);
  expect(saveLinkArticle).toHaveBeenCalledWith(link.id, link.url, article);
  vi.unstubAllGlobals();
});

test("switching the keyed reader aborts old capture before it can update the next item", async () => {
  let resolve!: (response: Response) => void;
  let signal!: AbortSignal;
  vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => {
    signal = options.signal as AbortSignal;
    return new Promise<Response>(yes => { resolve = yes; });
  }));
  vi.mocked(saveLinkArticle).mockClear();
  const first = buildLink({ url: article.sourceUrl }, { id: "first" });
  const second = buildLink({ url: "https://example.com/second" }, { id: "second" });
  const onSaved = vi.fn();
  const { rerender } = render(<ArticleReader key={`${first.id}:${first.url}`} link={first} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: "Save article" }));
  rerender(<ArticleReader key={`${second.id}:${second.url}`} link={second} onSaved={onSaved} />);
  expect(signal.aborted).toBe(true);
  resolve(new Response(JSON.stringify(article)));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(onSaved).not.toHaveBeenCalled();
  expect(saveLinkArticle).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save article" })).toBeEnabled();
  vi.unstubAllGlobals();
});
