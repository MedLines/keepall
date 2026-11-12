import { buttonClassName } from "@/components/ui/button";
const SHELL_PANEL_KEY = "keepall-shell-panel-open";
export const SIDEBAR_WIDTH_KEY = "keepall-shell-sidebar-width";
export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_MIN_WIDTH = 224;
export const SIDEBAR_MAX_WIDTH = 400;

// Static source, like the theme bootstrap: restore appearance before hydration.
export const SHELL_INIT_SCRIPT = `(()=>{try{const r=document.documentElement,w=Number(localStorage.getItem("${SIDEBAR_WIDTH_KEY}"));if(Number.isFinite(w)&&w>=${SIDEBAR_MIN_WIDTH}&&w<=${SIDEBAR_MAX_WIDTH})r.style.setProperty("--initial-sidebar-width",w+"px");r.dataset.shellPanel=localStorage.getItem("${SHELL_PANEL_KEY}")==="closed"?"closed":"open"}catch{}})()`;

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
  "library-sidebar-interactive relative flex items-center text-text-secondary";

/** Interactive sidebar nav item — icon always; label when expanded. */
export const SHELL_NAV_ITEM =
  `${SHELL_NAV_SURFACE} transition-transform active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100`;

export const SHELL_NAV_ITEM_ACTIVE =
  "ui-selected font-medium text-text-primary";

export const SHELL_NAV_ITEM_IDLE =
  "hover:bg-bg-raised";

export const SHELL_TOP_BTN =
  buttonClassName({ size: "none", className: "h-10 gap-1.5 px-3 text-sm font-medium justify-start" });

export const SHELL_DESTRUCTIVE_BTN =
  "text-text-danger hover:bg-bg-danger focus-visible:bg-bg-danger";

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
  "rounded-control-sm bg-bg-canvas p-3";

export const SHELL_MANAGE_SURFACE =
  "rounded-control-sm bg-bg-surface p-3";
