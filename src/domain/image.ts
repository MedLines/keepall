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
  sourceFileName?: string;
  /** Ordered gallery; cover / grid preview is always index 0. */
  assetIds: string[];
  sourceUrl: string;
  caption: string;
  tagIds: string[];
  collectionIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CreateImageInput = {
  /** First (and initially only) asset. Becomes `assetIds: [assetId]`. */
  assetId: string;
  title?: string;
  sourceFileName?: string;
  sourceUrl?: string;
  caption?: string;
};

/** Raw row may still have legacy `assetId` before coerce. */
export type ImageFieldsRaw = Partial<ImageItem> & { assetId?: string };

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

export function imageCoverAssetId(image: Pick<ImageItem, "assetIds">): string {
  return image.assetIds[0] ?? "";
}

/** Append at end. Cover (index 0) stays put. */
export function appendImageAsset(
  image: ImageItem,
  assetId: string,
  options?: { now?: number },
): ImageItem {
  const id = assetId.trim();
  if (!id) {
    throw new ImageValidationError("Image asset is required");
  }
  return {
    ...image,
    assetIds: [...image.assetIds, id],
    updatedAt: options?.now ?? Date.now(),
  };
}

export function replaceImageAssetAt(
  image: ImageItem,
  index: number,
  assetId: string,
  options?: { now?: number },
): ImageItem {
  const id = assetId.trim();
  if (!id) {
    throw new ImageValidationError("Image asset is required");
  }
  if (index < 0 || index >= image.assetIds.length) {
    throw new ImageValidationError("Image slide is out of range");
  }
  const assetIds = [...image.assetIds];
  assetIds[index] = id;
  return {
    ...image,
    assetIds,
    updatedAt: options?.now ?? Date.now(),
  };
}

export function removeImageAssetAt(
  image: ImageItem,
  index: number,
  options?: { now?: number },
): ImageItem {
  if (image.assetIds.length <= 1) {
    throw new ImageValidationError(
      "Delete the item instead of removing its last image",
    );
  }
  if (index < 0 || index >= image.assetIds.length) {
    throw new ImageValidationError("Image slide is out of range");
  }
  return {
    ...image,
    assetIds: image.assetIds.filter((_, assetIndex) => assetIndex !== index),
    updatedAt: options?.now ?? Date.now(),
  };
}

export function clampImageSlideIndex(
  assetIds: string[],
  slide: number,
): number {
  if (assetIds.length === 0) {
    return 0;
  }
  if (!Number.isFinite(slide) || slide < 0) {
    return 0;
  }
  return Math.min(Math.floor(slide), assetIds.length - 1);
}

export function buildImage(
  input: CreateImageInput,
  options?: { id?: string; now?: number },
): ImageItem {
  return buildImageFromAssetIds(
    {
      assetIds: [input.assetId],
      title: input.title,
      sourceFileName: input.sourceFileName,
      sourceUrl: input.sourceUrl,
      caption: input.caption,
    },
    options,
  );
}

export function buildImageFromAssetIds(
  input: {
    assetIds: string[];
    title?: string;
    sourceFileName?: string;
    sourceUrl?: string;
    caption?: string;
  },
  options?: { id?: string; now?: number },
): ImageItem {
  const assetIds = input.assetIds
    .map((id) => id.trim())
    .filter(Boolean);
  if (assetIds.length === 0) {
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
    ...(input.sourceFileName ? { sourceFileName: input.sourceFileName } : {}),
    assetIds,
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
  input: { title?: string; sourceUrl?: string; caption?: string },
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
    title: input.title !== undefined ? input.title.trim() : image.title,
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

function coerceAssetIds(raw: ImageFieldsRaw | null | undefined): string[] {
  if (Array.isArray(raw?.assetIds)) {
    const fromList = raw.assetIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean);
    if (fromList.length > 0) {
      return fromList;
    }
  }
  const legacy = typeof raw?.assetId === "string" ? raw.assetId.trim() : "";
  return legacy ? [legacy] : [];
}

export function coerceImageFields(
  raw: ImageFieldsRaw | null | undefined,
): Pick<ImageItem, "assetIds" | "sourceUrl" | "caption" | "title" | "sourceFileName"> {
  return {
    title: typeof raw?.title === "string" ? raw.title : "",
    ...(typeof raw?.sourceFileName === "string" ? { sourceFileName: raw.sourceFileName } : {}),
    assetIds: coerceAssetIds(raw),
    sourceUrl: typeof raw?.sourceUrl === "string" ? raw.sourceUrl : "",
    caption: typeof raw?.caption === "string" ? raw.caption : "",
  };
}
