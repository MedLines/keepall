import { describe, expect, test, vi } from "vitest";
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
