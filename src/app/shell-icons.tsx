import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon as Add01, ArrowDown01Icon as ArrowDown01,
  Cancel01Icon as Cancel01, Download01Icon as Download01,
  Folder01Icon as Folder01, GridViewIcon as GridView,
  Image01Icon as Image01, InboxIcon as Inbox, Layers01Icon as Layers01,
  Link01Icon as Link01, Menu01Icon as Menu01, MoreVerticalIcon as MoreVertical,
  Note01Icon as Note01, Search01Icon as Search01, SidebarLeft01Icon as SidebarLeft01,
  Sorting01Icon as Sorting01, Sorting02Icon as Sorting02,
  Sun03Icon as Sun03, Tag01Icon as Tag01,
} from "@hugeicons/core-free-icons";

type IconProps = { className?: string };

function ShellIcon({ icon, className = "" }: IconProps & { icon: IconSvgElement }) {
  return <HugeiconsIcon icon={icon} size={18} strokeWidth={1.5} className={`shrink-0 ${className}`} aria-hidden="true" />;
}

export function LogoIcon({ className = "" }: IconProps) {
  return (
    <svg className={`size-6 shrink-0 ${className}`} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="2" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M6 14V8M10 14V5M14 14V10" />
    </svg>
  );
}

export function LibraryIcon(props: IconProps) { return <ShellIcon icon={GridView} {...props} />; }
export function CollectionIcon(props: IconProps) { return <ShellIcon icon={Folder01} {...props} />; }
export function LinkIcon(props: IconProps) { return <ShellIcon icon={Link01} {...props} />; }
export function NoteIcon(props: IconProps) { return <ShellIcon icon={Note01} {...props} />; }
export function ImageIcon(props: IconProps) { return <ShellIcon icon={Image01} {...props} />; }
export function BackupIcon(props: IconProps) { return <ShellIcon icon={Download01} {...props} />; }
export function CloseIcon(props: IconProps) { return <ShellIcon icon={Cancel01} {...props} />; }
export function SearchIcon(props: IconProps) { return <ShellIcon icon={Search01} {...props} />; }
export function PanelIcon(props: IconProps) { return <ShellIcon icon={SidebarLeft01} {...props} />; }
export function GridIcon(props: IconProps) { return <ShellIcon icon={GridView} {...props} />; }
export function ListIcon(props: IconProps) { return <ShellIcon icon={Menu01} {...props} />; }
export function LayersIcon(props: IconProps) { return <ShellIcon icon={Layers01} {...props} />; }
export function ChevronDownIcon(props: IconProps) { return <ShellIcon icon={ArrowDown01} {...props} />; }
export function SortDescIcon(props: IconProps) { return <ShellIcon icon={Sorting01} {...props} />; }
export function SortAscIcon(props: IconProps) { return <ShellIcon icon={Sorting02} {...props} />; }
export function PlusIcon(props: IconProps) { return <ShellIcon icon={Add01} {...props} />; }
export function InboxIcon(props: IconProps) { return <ShellIcon icon={Inbox} {...props} />; }
export function HashIcon(props: IconProps) { return <ShellIcon icon={Tag01} {...props} />; }
export function MoreIcon(props: IconProps) { return <ShellIcon icon={MoreVertical} {...props} />; }
export function ThemeIcon(props: IconProps) { return <ShellIcon icon={Sun03} {...props} />; }

export function SidebarChevronIcon({ expanded, className = "" }: IconProps & { expanded: boolean }) {
  return <ShellIcon icon={ArrowDown01} className={`${className} ${expanded ? "rotate-90" : "-rotate-90"}`} />;
}
