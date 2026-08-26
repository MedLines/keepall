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

/** Rail control: 40px hit, soft shadow active, scale on press. */
export const SHELL_RAIL_BTN =
  "relative flex size-10 items-center justify-center rounded-[10px] text-zinc-500 transition-[transform,background-color,box-shadow,color] duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100";

export const SHELL_RAIL_BTN_ACTIVE =
  "bg-zinc-100 text-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.05)]";

export const SHELL_PANEL_ROW =
  "mx-2 flex min-h-10 w-[calc(100%-1rem)] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm transition-[transform,background-color,box-shadow,color] duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100";

export const SHELL_PANEL_ROW_ACTIVE =
  "bg-zinc-100 font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)]";

export const SHELL_TOP_BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-transparent px-2.5 text-sm font-medium transition-[transform,background-color,box-shadow,border-color,color] duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100";

export const SHELL_TOP_BTN_ACTIVE =
  "border-zinc-900/10 bg-zinc-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]";

export const SHELL_TOP_BTN_IDLE =
  "border-zinc-200/80 bg-white text-zinc-700 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)] hover:bg-zinc-50";
