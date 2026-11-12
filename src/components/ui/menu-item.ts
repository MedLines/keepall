import { cn } from "@/lib/utils";

const TONE = {
  default: "text-text-primary data-[highlighted]:bg-bg-active",
  danger: "text-text-danger data-[highlighted]:bg-bg-danger",
};

/** Icon + label row used by most menus. */
const ROW = "items-center gap-2 text-left outline-none";

type MenuItemStyle = {
  /** default: text-primary with a bg-active highlight. danger: text-danger with a bg-danger highlight. */
  tone?: keyof typeof TONE;
  /** row: icon and label aligned on one line (the common case). */
  layout?: "row" | "none";
  className?: string;
};

/** Classes for a Base UI Menu.Item / Select.Item / ContextMenu.Item on the shared .ui-menu-item surface. */
export function menuItemClassName({ tone = "default", layout = "row", className }: MenuItemStyle = {}) {
  return cn("ui-menu-item flex w-full text-sm", TONE[tone], layout === "row" && ROW, className);
}
