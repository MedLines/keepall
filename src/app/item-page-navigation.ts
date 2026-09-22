export function safeLibraryReturnHref(value: string | undefined): string {
  if (!value || (value !== "/" && !value.startsWith("/?"))) {
    return "/";
  }
  return value;
}

export function itemPageHref(itemId: string, returnHref: string): string {
  const query = new URLSearchParams({
    from: safeLibraryReturnHref(returnHref),
  });
  return `/items/${encodeURIComponent(itemId)}?${query.toString()}`;
}

export const imageItemHref = itemPageHref;
