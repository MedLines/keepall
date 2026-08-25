import { isHttpUrl } from "./classify";

export const MAX_LOCAL_IMAGE_BYTES = 3 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

export type ImageItem = {
  id: string;
  type: "image";
  title: string;
  assetId: string;
  sourceUrl: string;
  caption: string;
  tagIds: string[];
  collectionIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CreateImageInput = {
  assetId: string;
  title?: string;
  sourceUrl?: string;
  caption?: string;
};

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export function normalizeImageMime(mimeType: string): string {
  return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isAllowedLocalImageMime(mimeType: string): boolean {
  return ALLOWED_MIMES.has(normalizeImageMime(mimeType));
}

export function assertLocalImageBytes(
  bytes: Uint8Array,
  mimeType: string,
): string {
  const mime = normalizeImageMime(mimeType);
  if (!isAllowedLocalImageMime(mime)) {
    throw new ImageValidationError("Use a PNG, JPEG, GIF, WebP, or AVIF image");
  }
  if (bytes.byteLength === 0) {
    throw new ImageValidationError("Image file is empty");
  }
  if (bytes.byteLength > MAX_LOCAL_IMAGE_BYTES) {
    throw new ImageValidationError("Image must be 3MB or smaller");
  }
  return mime;
}

/**
 * When an image is preferred from a mixed clipboard, keep accompanying text:
 * http(s) → sourceUrl; other text → caption.
 */
export function textFieldsFromAccompanyingText(text: string): {
  sourceUrl: string;
  caption: string;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { sourceUrl: "", caption: "" };
  }
  if (isHttpUrl(trimmed)) {
    return { sourceUrl: trimmed, caption: "" };
  }
  return { sourceUrl: "", caption: trimmed };
}

export function buildImage(
  input: CreateImageInput,
  options?: { id?: string; now?: number },
): ImageItem {
  const assetId = input.assetId.trim();
  if (!assetId) {
    throw new ImageValidationError("Image asset is required");
  }

  const sourceUrl = (input.sourceUrl ?? "").trim();
  if (sourceUrl && !isHttpUrl(sourceUrl)) {
    throw new ImageValidationError("Source must be an http or https URL");
  }

  const now = options?.now ?? Date.now();

  return {
    id: options?.id ?? crypto.randomUUID(),
    type: "image",
    title: (input.title ?? "").trim(),
    assetId,
    sourceUrl,
    caption: (input.caption ?? "").trim(),
    tagIds: [],
    collectionIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function applyImageEdit(
  image: ImageItem,
  input: { sourceUrl?: string; caption?: string },
  options?: { now?: number },
): ImageItem {
  const sourceUrl =
    input.sourceUrl !== undefined ? input.sourceUrl.trim() : image.sourceUrl;
  if (sourceUrl && !isHttpUrl(sourceUrl)) {
    throw new ImageValidationError("Source must be an http or https URL");
  }

  return {
    ...image,
    sourceUrl,
    caption:
      input.caption !== undefined ? input.caption.trim() : image.caption,
    updatedAt: options?.now ?? Date.now(),
  };
}

export function imageListTitle(image: ImageItem): string {
  if (image.title) {
    return image.title;
  }
  if (image.caption) {
    return image.caption;
  }
  if (image.sourceUrl) {
    try {
      return new URL(image.sourceUrl).hostname;
    } catch {
      return image.sourceUrl;
    }
  }
  return "Image";
}

export function coerceImageFields(
  raw: Partial<ImageItem> | null | undefined,
): Pick<ImageItem, "assetId" | "sourceUrl" | "caption" | "title"> {
  return {
    title: typeof raw?.title === "string" ? raw.title : "",
    assetId: typeof raw?.assetId === "string" ? raw.assetId : "",
    sourceUrl: typeof raw?.sourceUrl === "string" ? raw.sourceUrl : "",
    caption: typeof raw?.caption === "string" ? raw.caption : "",
  };
}
