import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { buildLink } from "@/domain/link";
import { ArticleReader } from "./article-reader";
import { saveLinkArticle } from "@/persistence/articles";
import { articleContentText, type ArticleNode } from "@/domain/article";
import { useAssetObjectUrl } from "./use-asset-object-url";

vi.mock("@/persistence/articles", () => ({ saveLinkArticle: vi.fn() }));
vi.mock("./use-asset-object-url", () => ({ useAssetObjectUrl: vi.fn(() => null) }));
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

test("renders saved structure with native headings, lists, emphasis, quotes, code and safe links", () => {
  const content: ArticleNode[] = [
    { tag: "h2", children: [{ text: "Migration evidence" }] },
    { tag: "p", children: [{ text: "A " }, { tag: "strong", children: [{ text: "careful" }] }, { text: " study." }] },
    { tag: "ol", start: 3, children: [{ tag: "li", children: [{ text: "Observe routes" }] }] },
    { tag: "blockquote", children: [{ tag: "p", children: [{ text: "Keep the evidence." }] }] },
    { tag: "pre", children: [{ tag: "code", children: [{ text: "const route = 'Arctic';\n  observe(route);" }] }] },
    { tag: "p", children: [{ tag: "a", href: "https://example.com/reference", children: [{ text: "Read references" }] }] },
  ];
  const link = { ...buildLink({ url: article.sourceUrl }), article: { ...article, text: articleContentText(content), content, siteName: "Ocean Journal", publishedAt: "2026-09-30" } };
  const { container } = render(<ArticleReader link={link} onSaved={vi.fn()} />);
  expect(screen.getByRole("heading", { level: 1, name: article.title })).toBeVisible();
  expect(screen.getByRole("heading", { level: 2, name: "Migration evidence" })).toBeVisible();
  expect(screen.getByRole("list")).toHaveAttribute("start", "3");
  expect(container.querySelector("strong")).toHaveTextContent("careful");
  expect(container.querySelector("blockquote")).toHaveTextContent("Keep the evidence.");
  expect(container.querySelector("pre code")?.textContent).toBe("const route = 'Arctic';\n  observe(route);");
  expect(screen.getByRole("link", { name: "Read references" })).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByText("Ocean Journal")).toBeVisible();
  expect(container.querySelector('time[datetime="2026-09-30"]')).not.toBeNull();
  expect(container.querySelector("img,iframe,script")).toBeNull();
});

test("legacy plain text is split into readable paragraphs and invalid local structure falls back safely", () => {
  const link = { ...buildLink({ url: article.sourceUrl }), article };
  const { container, rerender } = render(<ArticleReader link={link} onSaved={vi.fn()} />);
  expect(container.querySelectorAll('article[aria-label="Article text"] p')).toHaveLength(3);
  rerender(<ArticleReader link={{ ...link, article: { ...article, content: [{ tag: "script", children: [{ text: "alert(1)" }] }] } as unknown as typeof article }} onSaved={vi.fn()} />);
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByRole("article", { name: "Article text" })).toHaveTextContent("First paragraph.");
});

test("retains an already saved preview using a local Blob URL without a remote fallback", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const link = { ...buildLink({ url: article.sourceUrl }), article, previewAssetId: "saved-cover" };
  vi.mocked(useAssetObjectUrl).mockReturnValue("blob:https://keepall.test/local-cover");
  const { container, rerender } = render(<ArticleReader link={link} onSaved={vi.fn()} />);
  expect(container.querySelector("img")).toHaveAttribute("src", "blob:https://keepall.test/local-cover");
  expect(useAssetObjectUrl).toHaveBeenCalledWith("saved-cover");
  vi.mocked(useAssetObjectUrl).mockReturnValue(null);
  rerender(<ArticleReader link={link} onSaved={vi.fn()} />);
  expect(container.querySelector("img")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
