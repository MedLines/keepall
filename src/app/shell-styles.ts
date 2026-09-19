const SHELL_PANEL_KEY = "keepall-shell-panel-open";

export function readShellPanelOpen(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const stored = window.localStorage.getItem(SHELL_PANEL_KEY);
  if (stored === "closed") {
    return false;
  }
  return true;
}

export function writeShellPanelOpen(open: boolean): void {
  window.localStorage.setItem(SHELL_PANEL_KEY, open ? "open" : "closed");
}

const SHELL_COLLECTIONS_OPEN_KEY = "keepall-shell-collections-open";
const SHELL_TAGS_OPEN_KEY = "keepall-shell-tags-open";

function readSectionOpen(key: string): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(key) !== "closed";
}

export function readShellCollectionsOpen(): boolean {
  return readSectionOpen(SHELL_COLLECTIONS_OPEN_KEY);
}

export function writeShellCollectionsOpen(open: boolean): void {
  window.localStorage.setItem(
    SHELL_COLLECTIONS_OPEN_KEY,
    open ? "open" : "closed",
  );
}

export function readShellTagsOpen(): boolean {
  return readSectionOpen(SHELL_TAGS_OPEN_KEY);
}

export function writeShellTagsOpen(open: boolean): void {
  window.localStorage.setItem(SHELL_TAGS_OPEN_KEY, open ? "open" : "closed");
}

/** Expanded navigation width; the content panel begins at this edge. */
export const SHELL_SIDEBAR_EXPANDED = "w-64";

/** Collapsed sidebar width (icon rail). */
export const SHELL_SIDEBAR_COLLAPSED = "w-14";

/** Horizontal padding shared by all sidebar nav rows. */
export const SHELL_NAV_GUTTER = "px-4";

/** Visual surface shared by composite nav rows and interactive nav items. */
export const SHELL_NAV_SURFACE =
  "squircle-panel relative flex items-center rounded-control-md text-text-secondary";

/** Interactive sidebar nav item — icon always; label when expanded. */
export const SHELL_NAV_ITEM =
  `${SHELL_NAV_SURFACE} transition-transform active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100`;

export const SHELL_NAV_ITEM_ACTIVE =
  "ui-selected font-medium text-text-primary";

export const SHELL_NAV_ITEM_IDLE =
  "hover:bg-bg-raised";

/** @deprecated use SHELL_NAV_ITEM */
export const SHELL_RAIL_BTN = SHELL_NAV_ITEM;

/** @deprecated use SHELL_NAV_ITEM_ACTIVE */
export const SHELL_RAIL_BTN_ACTIVE = SHELL_NAV_ITEM_ACTIVE;

/** @deprecated use SHELL_NAV_ITEM */
export const SHELL_PANEL_ROW = SHELL_NAV_ITEM;

/** @deprecated use SHELL_NAV_ITEM_ACTIVE */
export const SHELL_PANEL_ROW_ACTIVE = SHELL_NAV_ITEM_ACTIVE;

export const SHELL_TOP_BTN =
  "ui-control inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium disabled:opacity-60";

export const SHELL_TOP_BTN_ACTIVE =
  "ui-primary";

export const SHELL_TOP_BTN_IDLE =
  "text-text-secondary";

/** Sidebar sits behind the inset content panel. */
export const SHELL_ASIDE =
  "flex h-full max-h-full min-h-0 shrink-0 flex-col overflow-hidden bg-bg-shell";

export const SHELL_BACKDROP =
  "ui-backdrop fixed inset-y-0 right-0 left-14 z-40 transition-[opacity] duration-200 ease-out md:hidden";

export const SHELL_FORM_SURFACE =
  "squircle-panel rounded-control-sm bg-bg-canvas p-3";

export const SHELL_MANAGE_SURFACE =
  "squircle-panel rounded-control-sm bg-bg-surface p-3";
