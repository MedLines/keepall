import { isHttpUrl } from "./classify";

export type LinkPreviewStatus = "idle" | "pending" | "ready" | "failed";

/** Why preview stopped: try again later vs never. null = no outstanding retry. */
export type LinkPreviewRetry = "network" | "none";

/** Pending enrich older than this is treated as dead (crash / sleep). */
export const LINK_PREVIEW_PENDING_LEASE_MS = 2 * 60 * 1000;

export type LinkItem = {
  id: string;
  type: "link";
  title: string;
  url: string;
  previewStatus: LinkPreviewStatus;
  previewTitle: string;
  previewDescription: string;
  previewImageUrl: string;
  /** Local asset id for offline preview bytes; null if none. */
  previewAssetId: string | null;
  previewRetry: LinkPreviewRetry | null;
  /** When pending/last attempt started; used for the dead-lease check. */
  previewAttemptedAt: number | null;
  tagIds: string[];
  collectionIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CreateLinkInput = {
  title?: string;
  url: string;
};

export type LinkPreviewFields = {
  previewStatus: LinkPreviewStatus;
  previewTitle: string;
  previewDescription: string;
  previewImageUrl: string;
  previewAssetId: string | null;
  previewRetry: LinkPreviewRetry | null;
  previewAttemptedAt: number | null;
};

export const EMPTY_LINK_PREVIEW: LinkPreviewFields = {
  previewStatus: "idle",
  previewTitle: "",
  previewDescription: "",
  previewImageUrl: "",
  previewAssetId: null,
  previewRetry: null,
  previewAttemptedAt: null,
};

export class LinkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkValidationError";
  }
}

const PREVIEW_STATUSES = new Set<string>([
  "idle",
  "pending",
  "ready",
  "failed",
]);

const PREVIEW_RETRIES = new Set<string>(["network", "none"]);

/** Fill missing preview fields on older IndexedDB / backup link rows. */
export function coerceLinkPreviewFields(
  raw: Partial<LinkPreviewFields> | null | undefined,
): LinkPreviewFields {
  const status = raw?.previewStatus;
  const assetId = raw?.previewAssetId;
  const retry = raw?.previewRetry;
  const attemptedAt = raw?.previewAttemptedAt;
  return {
    previewStatus:
      typeof status === "string" && PREVIEW_STATUSES.has(status)
        ? (status as LinkPreviewStatus)
        : "idle",
    previewTitle: typeof raw?.previewTitle === "string" ? raw.previewTitle : "",
    previewDescription:
      typeof raw?.previewDescription === "string" ? raw.previewDescription : "",
    previewImageUrl:
      typeof raw?.previewImageUrl === "string" ? raw.previewImageUrl : "",
    previewAssetId: typeof assetId === "string" && assetId ? assetId : null,
    previewRetry:
      typeof retry === "string" && PREVIEW_RETRIES.has(retry)
        ? (retry as LinkPreviewRetry)
        : null,
    previewAttemptedAt:
      typeof attemptedAt === "number" && Number.isFinite(attemptedAt)
        ? attemptedAt
        : null,
  };
}

/** True when a wake should call enrich again for this link. */
export function linkNeedsPreviewRetry(
  link: LinkItem,
  now = Date.now(),
): boolean {
  if (link.previewRetry === "none") {
    return false;
  }
  if (link.previewRetry === "network") {
    return true;
  }
  if (link.previewStatus === "failed") {
    // Older rows before Slice 27 had no reason; treat as retryable.
    return true;
  }
  if (link.previewStatus === "pending") {
    const started = link.previewAttemptedAt ?? link.updatedAt;
    return now - started >= LINK_PREVIEW_PENDING_LEASE_MS;
  }
  return false;
}

/**
 * Compare key for “same page?”. Not what we store on first save.
 * Lowercases host, strips www., trailing slash, and hash; defaults https.
 */
export function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }

    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    const protocol = url.protocol === "http:" ? "http:" : "https:";
    return `${protocol}//${host}${path}${url.search}`;
  } catch {
    return null;
  }
}

/** Ask before changing collection when the existing link is already filed. */
export function captureCollectionConflict(
  existingCollectionName: string | null,
  nextCollectionName: string | null,
): boolean {
  if (!existingCollectionName) {
    return false;
  }
  return existingCollectionName !== nextCollectionName;
}

/** Ask before changing tags when both existing and capture have tags. */
export function captureTagConflict(
  existingTagNames: string[],
  nextTagNames: string[],
): boolean {
  if (existingTagNames.length === 0 || nextTagNames.length === 0) {
    return false;
  }
  const existing = new Set(
    existingTagNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  const next = new Set(
    nextTagNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  if (existing.size !== next.size) {
    return true;
  }
  for (const name of existing) {
    if (!next.has(name)) {
      return true;
    }
  }
  return false;
}

export function buildLink(
  input: CreateLinkInput,
  options?: { id?: string; now?: number },
): LinkItem {
  const url = input.url.trim();

  if (!isHttpUrl(url)) {
    throw new LinkValidationError("Enter an http or https URL");
  }

  const now = options?.now ?? Date.now();

  return {
    id: options?.id ?? crypto.randomUUID(),
    type: "link",
    title: (input.title ?? "").trim(),
    url,
    ...EMPTY_LINK_PREVIEW,
    tagIds: [],
    collectionIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function applyLinkEdit(
  link: LinkItem,
  input: { url: string; title?: string },
  options?: { now?: number },
): LinkItem {
  const url = input.url.trim();

  if (!isHttpUrl(url)) {
    throw new LinkValidationError("Enter an http or https URL");
  }

  const urlChanged = url !== link.url;

  return {
    ...link,
    url,
    title: input.title !== undefined ? input.title.trim() : link.title,
    ...(urlChanged ? EMPTY_LINK_PREVIEW : {}),
    updatedAt: options?.now ?? Date.now(),
  };
}

export function applyLinkPreviewResult(
  link: LinkItem,
  result:
    | { status: "ready"; title: string; description: string; imageUrl: string }
    | { status: "failed"; retry?: LinkPreviewRetry },
  options?: { now?: number },
): LinkItem {
  const now = options?.now ?? Date.now();
  if (result.status === "failed") {
    return {
      ...link,
      previewStatus: "failed",
      previewRetry: result.retry ?? "network",
      previewAttemptedAt: now,
      updatedAt: now,
    };
  }

  return {
    ...link,
    previewStatus: "ready",
    previewTitle: result.title.trim(),
    previewDescription: result.description.trim(),
    previewImageUrl: result.imageUrl.trim(),
    // New metadata may point at a different image; clear until bytes are stored.
    previewAssetId: null,
    // Bytes still needed → network until store succeeds or marks none.
    previewRetry: result.imageUrl.trim() ? "network" : null,
    previewAttemptedAt: now,
    updatedAt: now,
  };
}

export function applyLinkPreviewAssetId(
  link: LinkItem,
  previewAssetId: string | null,
  options?: { now?: number },
): LinkItem {
  return {
    ...link,
    previewAssetId,
    previewRetry: previewAssetId ? null : link.previewRetry,
    updatedAt: options?.now ?? Date.now(),
  };
}

export function applyLinkPreviewRetry(
  link: LinkItem,
  previewRetry: LinkPreviewRetry | null,
  options?: { now?: number },
): LinkItem {
  const now = options?.now ?? Date.now();
  return {
    ...link,
    previewRetry,
    previewAttemptedAt: now,
    updatedAt: now,
  };
}

export function markLinkPreviewPending(
  link: LinkItem,
  options?: { now?: number },
): LinkItem {
  const now = options?.now ?? Date.now();
  return {
    ...link,
    previewStatus: "pending",
    previewRetry: null,
    previewAttemptedAt: now,
    updatedAt: now,
  };
}

export function linkListTitle(link: LinkItem): string {
  if (link.title) {
    return link.title;
  }

  if (link.previewTitle) {
    return link.previewTitle;
  }

  try {
    return new URL(link.url).hostname;
  } catch {
    return link.url;
  }
}
