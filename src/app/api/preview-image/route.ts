import {
  fetchPreviewImage,
  PreviewFetchError,
  PreviewUrlBlockedError,
} from "@/server/preview-image-fetch";

import { optimizePreviewImage } from "@/server/preview-image-optimize";

export const runtime = "nodejs";

type PreviewImageBody = {
  url?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: PreviewImageBody;
  try {
    body = (await request.json()) as PreviewImageBody;
  } catch {
    return jsonError("Expected JSON body", 400);
  }

  if (typeof body.url !== "string" || !body.url.trim()) {
    return jsonError("url is required", 400);
  }

  try {
    const source = await fetchPreviewImage(body.url);
    const image = await optimizePreviewImage(source.bytes);
    return new Response(Buffer.from(image.bytes), {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "no-store",
      },
    });
  } catch (caught) {
    if (caught instanceof PreviewUrlBlockedError) {
      return jsonError("URL is not allowed", 400);
    }
    if (caught instanceof PreviewFetchError) {
      if (caught.message === "Image too large") {
        return jsonError("Image too large", 413);
      }
      return jsonError("Could not fetch image", 502);
    }
    return jsonError("Could not fetch image", 502);
  }
}
