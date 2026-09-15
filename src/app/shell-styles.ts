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

/** Expanded sidebar width — logo column in top bar matches this. */
export const SHELL_SIDEBAR_EXPANDED = "w-60";

/** Collapsed sidebar width (icon rail). */
export const SHELL_SIDEBAR_COLLAPSED = "w-14";

/** Horizontal padding shared by all sidebar nav rows. */
export const SHELL_NAV_GUTTER = "px-2";

/** Visual surface shared by composite nav rows and interactive nav items. */
export const SHELL_NAV_SURFACE =
  "relative flex items-center rounded-[10px] text-zinc-600 transition-[background-color,box-shadow,color] duration-150 ease-out";

/** Interactive sidebar nav item — icon always; label when expanded. */
export const SHELL_NAV_ITEM =
  `${SHELL_NAV_SURFACE} transition-transform active:scale-[0.98] motion-reduce:transition-[background-color,box-shadow,color] motion-reduce:active:scale-100`;

export const SHELL_NAV_ITEM_ACTIVE =
  "bg-zinc-100 font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)]";

export const SHELL_NAV_ITEM_IDLE =
  "hover:bg-zinc-50";

/** @deprecated use SHELL_NAV_ITEM */
export const SHELL_RAIL_BTN = SHELL_NAV_ITEM;

/** @deprecated use SHELL_NAV_ITEM_ACTIVE */
export const SHELL_RAIL_BTN_ACTIVE = SHELL_NAV_ITEM_ACTIVE;

/** @deprecated use SHELL_NAV_ITEM */
export const SHELL_PANEL_ROW = SHELL_NAV_ITEM;

/** @deprecated use SHELL_NAV_ITEM_ACTIVE */
export const SHELL_PANEL_ROW_ACTIVE = SHELL_NAV_ITEM_ACTIVE;

export const SHELL_TOP_BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-transparent px-2.5 text-sm font-medium transition-[transform,background-color,box-shadow,border-color,color] duration-150 ease-out active:scale-[0.96] motion-reduce:transition-[background-color,box-shadow,border-color,color] motion-reduce:active:scale-100";

export const SHELL_TOP_BTN_ACTIVE =
  "border-zinc-900/10 bg-zinc-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]";

export const SHELL_TOP_BTN_IDLE =
  "border-zinc-200/80 bg-white text-zinc-700 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)] hover:bg-zinc-50";

/** Shell chrome: shadow edge instead of a hard border. */
export const SHELL_ASIDE =
  "relative z-30 flex h-full max-h-full min-h-0 shrink-0 flex-col overflow-hidden bg-white shadow-[1px_0_0_rgba(0,0,0,0.05),4px_0_24px_rgba(0,0,0,0.03)]";

export const SHELL_BACKDROP =
  "fixed inset-y-0 right-0 left-14 z-40 bg-zinc-900/20 backdrop-blur-[1px] transition-[opacity] duration-200 ease-out md:hidden";

export const SHELL_FORM_SURFACE =
  "rounded-[12px] bg-zinc-50 p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.04)]";

export const SHELL_MANAGE_SURFACE =
  "rounded-[12px] bg-white p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.04)]";
