import { isHttpUrl } from "./classify";

export type LinkItem = {
  id: string;
  type: "link";
  title: string;
  url: string;
  tagIds: string[];
  collectionIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CreateLinkInput = {
  title?: string;
  url: string;
};

export class LinkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkValidationError";
  }
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

  return {
    ...link,
    url,
    title: input.title !== undefined ? input.title.trim() : link.title,
    updatedAt: options?.now ?? Date.now(),
  };
}

export function linkListTitle(link: LinkItem): string {
  if (link.title) {
    return link.title;
  }

  try {
    return new URL(link.url).hostname;
  } catch {
    return link.url;
  }
}
