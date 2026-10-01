import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchLinkPreview, parseOpenGraphHtml } from "./preview-fetch";

describe("parseOpenGraphHtml", () => {
  test("reads og tags and resolves relative images", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Hello &amp; Hi" />
        <meta property="og:description" content="Desc" />
        <meta property="og:image" content="/img.png" />
      </head></html>
    `;
    expect(parseOpenGraphHtml(html, "https://example.com/page")).toEqual({
      title: "Hello & Hi",
      description: "Desc",
      imageUrl: "https://example.com/img.png",
    });
  });
});

describe("fetchLinkPreview", () => {
  afterEach(() => vi.useRealTimers());

  const metadata = '<title>Swipe file</title><meta property="og:description" content="Design reference" /><meta property="og:image" content="/cover.jpg" />';
  const assertUrl = async (raw: string) => new URL(raw);

  test("extracts metadata from a page larger than the old 1 MB limit", async () => {
    const html = `<head>${metadata}</head><body>${"x".repeat(2_100_000)}</body>`;
    await expect(fetchLinkPreview("https://example.com", {
      assertUrl, fetchImpl: vi.fn().mockResolvedValue(new Response(html, { headers: { "content-type": "text/html" } })),
    })).resolves.toEqual({ title: "Swipe file", description: "Design reference", imageUrl: "https://example.com/cover.jpg" });
  });

  test("cancels the body once a complete preview is found in the head", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(`<head>${metadata}</head>`)); },
      cancel,
    });
    await expect(fetchLinkPreview("https://example.com", {
      assertUrl, fetchImpl: vi.fn().mockResolvedValue(new Response(body)),
    })).resolves.toMatchObject({ title: "Swipe file", imageUrl: "https://example.com/cover.jpg" });
    expect(cancel).toHaveBeenCalledOnce();
  }, 1000);

  test("reads metadata streamed into the body after a large page", async () => {
    const html = `<head><title>Fallback</title></head><body>${"x".repeat(2_100_000)}<meta property="og:title" content="Late title" />${metadata}</body>`;
    await expect(fetchLinkPreview("https://example.com", {
      assertUrl, fetchImpl: vi.fn().mockResolvedValue(new Response(html, { headers: { "content-type": "text/html" } })),
    })).resolves.toMatchObject({ title: "Late title", description: "Design reference" });
  });

  test("keeps usable metadata when the 5 MiB cap is reached", async () => {
    const html = `<head><title>Useful title</title></head><body>${"x".repeat(6 * 1024 * 1024)}</body>`;
    await expect(fetchLinkPreview("https://example.com", {
      assertUrl, fetchImpl: vi.fn().mockResolvedValue(new Response(html, { headers: { "content-type": "text/html" } })),
    })).resolves.toEqual({ title: "Useful title", description: "", imageUrl: "" });
  });

  test("cancels an oversized body without metadata before reading further chunks", async () => {
    const cancel = vi.fn();
    let chunks = 0;
    const body = new ReadableStream({
      pull(controller) {
        chunks += 1;
        controller.enqueue(new Uint8Array(1024 * 1024).fill(120));
        if (chunks === 7) controller.close();
      },
      cancel,
    });
    await expect(fetchLinkPreview("https://example.com", {
      assertUrl, fetchImpl: vi.fn().mockResolvedValue(new Response(body)),
    })).rejects.toThrow("Response too large");
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunks).toBeLessThanOrEqual(6);
  }, 1000);

  test("keeps the timeout active while reading a stalled body", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")), { once: true });
      },
    })));
    const result = expect(fetchLinkPreview("https://example.com", { assertUrl, fetchImpl })).rejects.toThrow("Could not fetch URL");
    await vi.advanceTimersByTimeAsync(8_001);
    await result;
  }, 1000);

  test("does not parse metadata beyond the cap within a large chunk", async () => {
    const html = "x".repeat(5 * 1024 * 1024) + metadata;
    await expect(fetchLinkPreview("https://example.com", {
      assertUrl, fetchImpl: vi.fn().mockResolvedValue(new Response(html, { headers: { "content-type": "text/html" } })),
    })).rejects.toThrow("Response too large");
  });

  test("decodes UTF-8 characters and metadata split across chunks", async () => {
    const bytes = new TextEncoder().encode(`<head><title>Café</title>${metadata.replace('<title>Swipe file</title>', '')}</head>`);
    const split = bytes.indexOf(0xc3) + 1;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.subarray(0, split));
        controller.enqueue(bytes.subarray(split));
        controller.close();
      },
    });
    await expect(fetchLinkPreview("https://example.com", {
      assertUrl, fetchImpl: vi.fn().mockResolvedValue(new Response(body)),
    })).resolves.toMatchObject({ title: "Café", imageUrl: "https://example.com/cover.jpg" });
  });

  test("follows one redirect and parses HTML", async () => {
    const assertUrl = vi.fn(async (raw: string) => new URL(raw));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/final" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          `<meta property="og:title" content="Final" /><meta property="og:image" content="https://cdn.example.com/a.jpg" />`,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
      );

    const preview = await fetchLinkPreview("https://example.com/start", {
      fetchImpl,
      assertUrl,
    });

    expect(assertUrl).toHaveBeenCalledTimes(2);
    expect(preview).toEqual({
      title: "Final",
      description: "",
      imageUrl: "https://cdn.example.com/a.jpg",
    });
  });
});
