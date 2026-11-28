/**
 * Whether a closing popup may still move focus. Base UI hands focus back only after the exit
 * animation, so by then the person may have opened something else. Focus is unclaimed while it
 * sits inside the closing popup or has fallen back to the page; anywhere else it is theirs.
 */
export function focusIsUnclaimed(popup: Element | null | undefined): boolean {
  const active = document.activeElement;
  return !active || active === document.body || !active.isConnected || Boolean(popup?.contains(active));
}
