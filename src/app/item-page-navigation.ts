export function safeLibraryReturnHref(value: string | undefined): string {
  if (!value || (value !== "/" && !value.startsWith("/?"))) {
    return "/";
  }
  return value;
}

export function imageItemHref(itemId: string, returnHref: string): string {
  const query = new URLSearchParams({
    from: safeLibraryReturnHref(returnHref),
  });
  return `/items/${encodeURIComponent(itemId)}?${query.toString()}`;
}
