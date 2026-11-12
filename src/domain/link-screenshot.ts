import type { LinkItem } from "./link";

/** A viewport capture of a saved page, stored as a local image asset. */
export type LinkScreenshot = {
  assetId: string;
  capturedAt: number;
  /** Stored pixel size. */
  width: number;
  height: number;
};

export const MAX_LINK_SCREENSHOTS = 8;
const MAX_SCREENSHOT_SIDE = 16384;

export class LinkScreenshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkScreenshotError";
  }
}

type ScreenshotFields = Pick<LinkItem, "previewAssetId" | "screenshots" | "coverAssetId">;

function isPixelSize(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_SCREENSHOT_SIDE;
}

export function isLinkScreenshot(raw: unknown): raw is LinkScreenshot {
  if (!raw || typeof raw !== "object") return false;
  const shot = raw as Partial<LinkScreenshot>;
  return typeof shot.assetId === "string" && shot.assetId.length > 0 && shot.assetId.length <= 100 &&
    typeof shot.capturedAt === "number" && Number.isFinite(shot.capturedAt) && shot.capturedAt >= 0 &&
    isPixelSize(shot.width) && isPixelSize(shot.height);
}

/** Valid screenshots in order, without duplicate assets. */
export function linkScreenshots(link: Pick<LinkItem, "screenshots">): LinkScreenshot[] {
  if (!Array.isArray(link.screenshots)) return [];
  const seen = new Set<string>();
  const result: LinkScreenshot[] = [];
  for (const raw of link.screenshots as unknown[]) {
    if (!isLinkScreenshot(raw) || seen.has(raw.assetId)) continue;
    seen.add(raw.assetId);
    result.push({ assetId: raw.assetId, capturedAt: raw.capturedAt, width: raw.width, height: raw.height });
  }
  return result;
}

export function linkScreenshotAssetIds(link: Pick<LinkItem, "screenshots">): string[] {
  return linkScreenshots(link).map((shot) => shot.assetId);
}

/** A copy of the link without screenshot fields. */
export function withoutLinkScreenshotFields<T extends Partial<ScreenshotFields>>(link: T): Omit<T, "screenshots" | "coverAssetId"> {
  const copy = { ...link };
  delete copy.screenshots;
  delete copy.coverAssetId;
  return copy;
}

function isValidCover(link: ScreenshotFields, assetId: string): boolean {
  return assetId === link.previewAssetId || linkScreenshotAssetIds(link).includes(assetId);
}

/**
 * Coerce-on-read for screenshot fields. Rows without them are returned
 * unchanged; malformed entries and stale cover choices are dropped.
 */
export function coerceLinkScreenshotFields<T extends Partial<ScreenshotFields>>(link: T): T {
  if (link.screenshots === undefined && link.coverAssetId === undefined) return link;
  const screenshots = linkScreenshots(link);
  const fields = { previewAssetId: link.previewAssetId ?? null, screenshots };
  const rawCover = link.coverAssetId;
  const coverAssetId = typeof rawCover === "string" && isValidCover(fields, rawCover) ? rawCover : undefined;
  return {
    ...withoutLinkScreenshotFields(link),
    ...(screenshots.length ? { screenshots } : {}),
    ...(coverAssetId ? { coverAssetId } : {}),
  } as T;
}

/** The asset a card shows: chosen cover, then page preview, then first screenshot. */
export function linkCoverAssetId(link: ScreenshotFields): string | null {
  if (link.coverAssetId && isValidCover(link, link.coverAssetId)) return link.coverAssetId;
  return link.previewAssetId ?? linkScreenshots(link)[0]?.assetId ?? null;
}

/** Appends a screenshot. The same asset twice returns the link unchanged. */
export function addLinkScreenshot(link: LinkItem, shot: LinkScreenshot, options?: { now?: number }): LinkItem {
  if (!isLinkScreenshot(shot)) throw new LinkScreenshotError("Invalid screenshot");
  const current = linkScreenshots(link);
  if (current.some((existing) => existing.assetId === shot.assetId)) return link;
  if (current.length >= MAX_LINK_SCREENSHOTS) {
    throw new LinkScreenshotError(`A link can have up to ${MAX_LINK_SCREENSHOTS} screenshots`);
  }
  return { ...link, screenshots: [...current, shot], updatedAt: options?.now ?? Date.now() };
}

/** Removes a screenshot; a cover pointing at it falls back to automatic. */
export function removeLinkScreenshot(link: LinkItem, assetId: string, options?: { now?: number }): LinkItem {
  const current = linkScreenshots(link);
  if (!current.some((shot) => shot.assetId === assetId)) return link;
  const screenshots = current.filter((shot) => shot.assetId !== assetId);
  const { coverAssetId } = link;
  return {
    ...withoutLinkScreenshotFields(link),
    ...(screenshots.length ? { screenshots } : {}),
    ...(coverAssetId && coverAssetId !== assetId ? { coverAssetId } : {}),
    updatedAt: options?.now ?? Date.now(),
  };
}

/** Pins the card cover to the preview or a screenshot; null restores automatic. */
export function setLinkCover(link: LinkItem, assetId: string | null, options?: { now?: number }): LinkItem {
  if (assetId !== null && !isValidCover(link, assetId)) {
    throw new LinkScreenshotError("Choose the page preview or one of this link's screenshots");
  }
  const next: LinkItem = { ...link, updatedAt: options?.now ?? Date.now() };
  if (assetId) next.coverAssetId = assetId;
  else delete next.coverAssetId;
  return next;
}
