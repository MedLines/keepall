import { isHttpUrl } from "./classify";

export type LinkPreviewStatus = "idle" | "pending" | "ready" | "failed";

export type LinkItem = {
  id: string;
  type: "link";
  title: string;
  url: string;
  previewStatus: LinkPreviewStatus;
  previewTitle: string;
  previewDescription: string;
  previewImageUrl: string;
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
};

export const EMPTY_LINK_PREVIEW: LinkPreviewFields = {
  previewStatus: "idle",
  previewTitle: "",
  previewDescription: "",
  previewImageUrl: "",
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

/** Fill missing preview fields on older IndexedDB / backup link rows. */
export function coerceLinkPreviewFields(
  raw: Partial<LinkPreviewFields> | null | undefined,
): LinkPreviewFields {
  const status = raw?.previewStatus;
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
  };
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
    | { status: "failed" },
  options?: { now?: number },
): LinkItem {
  if (result.status === "failed") {
    return {
      ...link,
      previewStatus: "failed",
      updatedAt: options?.now ?? Date.now(),
    };
  }

  return {
    ...link,
    previewStatus: "ready",
    previewTitle: result.title.trim(),
    previewDescription: result.description.trim(),
    previewImageUrl: result.imageUrl.trim(),
    updatedAt: options?.now ?? Date.now(),
  };
}

export function markLinkPreviewPending(
  link: LinkItem,
  options?: { now?: number },
): LinkItem {
  return {
    ...link,
    previewStatus: "pending",
    updatedAt: options?.now ?? Date.now(),
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
