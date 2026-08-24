import {
  fetchLinkPreview,
  PreviewFetchError,
  PreviewUrlBlockedError,
} from "@/server/preview-fetch";

export const runtime = "nodejs";

type PreviewBody = {
  url?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return jsonError("Expected JSON body", 400);
  }

  if (typeof body.url !== "string" || !body.url.trim()) {
    return jsonError("url is required", 400);
  }

  try {
    const preview = await fetchLinkPreview(body.url);
    return Response.json({
      title: preview.title,
      description: preview.description,
      imageUrl: preview.imageUrl,
    });
  } catch (caught) {
    if (caught instanceof PreviewUrlBlockedError) {
      return jsonError("URL is not allowed", 400);
    }
    if (caught instanceof PreviewFetchError) {
      return jsonError("Could not fetch preview", 502);
    }
    return jsonError("Could not fetch preview", 502);
  }
}
