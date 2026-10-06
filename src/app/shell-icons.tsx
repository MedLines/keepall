import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon as Add01, AllBookmarkIcon as AllBookmark, ArrowDown01Icon as ArrowDown01,
  Cancel01Icon as Cancel01, Archive01Icon as Archive01,
  Folder01Icon as Folder01, GridViewIcon as GridView, FilterIcon as Filter,
  Image01Icon as Image01, ImagesIcon as Images, InboxIcon as Inbox, Layers01Icon as Layers01,
  Link04Icon as Link04, ListViewIcon as ListView, MoreVerticalIcon as MoreVertical,
  Note01Icon as Note01, Search01Icon as Search01, SidebarLeft01Icon as SidebarLeft01,
  Pdf01Icon as Pdf01,
  Sorting01Icon as Sorting01,
  Target02Icon as Target02,
  Moon02Icon as Moon02, Sun03Icon as Sun03, Tag01Icon as Tag01,
  Edit02Icon as Edit02, Delete02Icon as Delete02, PinIcon as Pin,
  ArrowLeft01Icon as ArrowLeft01, ArrowRight01Icon as ArrowRight01,
  FullScreenIcon as FullScreen, Video01Icon as Video01, PlayIcon as Play, PauseIcon as Pause, EyeIcon as Eye,
  CheckmarkCircle02Icon as CheckmarkCircle02, CircleIcon as Circle, Tick02Icon as Tick02,
  Settings02Icon as Settings02, HelpCircleIcon as HelpCircle,
  KeyboardIcon as Keyboard, TextFontIcon as TextFont, SourceCodeIcon as SourceCode,
  RefreshIcon as Refresh,
  ComputerIcon as Computer, WifiOff01Icon as WifiOff,
  Globe02Icon as Globe, Clock01Icon as Clock,
  Download01Icon as Download, Upload01Icon as Upload,
  Txt01Icon as Txt01, ArrowUpRight01Icon as ArrowUpRight01,
} from "@hugeicons/core-free-icons";

// Same folded file outline as PDF and TXT; the installed icon set has no MD file glyph.
const MarkdownFile: IconSvgElement = [Txt01[0], ["path", {
  d: "M4 22V16L7 19.5L10 16V22M14 16H16C18.2 16 20 17.35 20 19C20 20.65 18.2 22 16 22H14V16Z",
  stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.5", key: "md",
}]];

type IconProps = { className?: string; fill?: "none" | "currentColor" };

function ShellIcon({ icon, className = "", fill = "none" }: IconProps & { icon: IconSvgElement }) {
  return <HugeiconsIcon icon={icon} size={18} strokeWidth={1.5} fill={fill} className={`shrink-0 ${className}`} aria-hidden="true" />;
}

export function LogoIcon({ className = "" }: IconProps) {
  return (
    <span className={`relative block shrink-0 ${className}`} aria-hidden="true">
      {/* eslint-disable @next/next/no-img-element -- transparent SVG layers keep the brand mark animated */}
      <img src="/icons/keepall-bottom.svg" alt="" className="keepall-logo-layer keepall-logo-bottom" draggable={false} />
      <img src="/icons/keepall-middle.svg" alt="" className="keepall-logo-layer" draggable={false} />
      <img src="/icons/keepall-top.svg" alt="" className="keepall-logo-layer keepall-logo-top" draggable={false} />
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}

export function LibraryIcon(props: IconProps) { return <ShellIcon icon={AllBookmark} {...props} />; }
export function CollectionIcon(props: IconProps) { return <ShellIcon icon={Folder01} {...props} />; }
export function LinkIcon(props: IconProps) { return <ShellIcon icon={Link04} {...props} />; }
export function NoteIcon(props: IconProps) { return <ShellIcon icon={Note01} {...props} />; }
export function PdfIcon(props: IconProps) { return <ShellIcon icon={Pdf01} {...props} />; }
export function TextFileIcon(props: IconProps) { return <ShellIcon icon={Txt01} {...props} />; }
export function MarkdownFileIcon(props: IconProps) { return <ShellIcon icon={MarkdownFile} {...props} />; }
export function ExternalLinkIcon(props: IconProps) { return <ShellIcon icon={ArrowUpRight01} {...props} />; }
export function ImageIcon(props: IconProps) { return <ShellIcon icon={Image01} {...props} />; }
export function ImagesIcon(props: IconProps) { return <ShellIcon icon={Images} {...props} />; }
export function VideoIcon(props: IconProps) { return <ShellIcon icon={Video01} {...props} />; }
export function PlayIcon(props: IconProps) { return <ShellIcon icon={Play} {...props} />; }
export function PauseIcon(props: IconProps) { return <ShellIcon icon={Pause} {...props} />; }
export function KeyboardIcon(props: IconProps) { return <ShellIcon icon={Keyboard} {...props} />; }
export function BackupIcon(props: IconProps) { return <ShellIcon icon={Archive01} {...props} />; }
export function SettingsIcon(props: IconProps) { return <ShellIcon icon={Settings02} {...props} />; }
export function HelpIcon(props: IconProps) { return <ShellIcon icon={HelpCircle} {...props} />; }
export function CloseIcon(props: IconProps) { return <ShellIcon icon={Cancel01} {...props} />; }
export function SearchIcon(props: IconProps) { return <ShellIcon icon={Search01} {...props} />; }
export function PanelIcon(props: IconProps) { return <ShellIcon icon={SidebarLeft01} {...props} />; }
export function GridIcon(props: IconProps) { return <ShellIcon icon={GridView} {...props} />; }
export function ListIcon(props: IconProps) { return <ShellIcon icon={ListView} {...props} />; }
export function LayersIcon(props: IconProps) { return <ShellIcon icon={Layers01} {...props} />; }
export function FilterIcon(props: IconProps) { return <ShellIcon icon={Filter} {...props} />; }
export function ChevronDownIcon(props: IconProps) { return <ShellIcon icon={ArrowDown01} {...props} />; }
export function CheckIcon(props: IconProps) { return <ShellIcon icon={Tick02} {...props} />; }
export function SortDescIcon(props: IconProps) { return <ShellIcon icon={Sorting01} {...props} />; }
export function SortAscIcon({ className = "", ...props }: IconProps) { return <ShellIcon icon={Sorting01} {...props} className={`-scale-y-100 ${className}`} />; }
export function RelevanceIcon(props: IconProps) { return <ShellIcon icon={Target02} {...props} />; }
export function PlusIcon(props: IconProps) { return <ShellIcon icon={Add01} {...props} />; }
export function InboxIcon(props: IconProps) { return <ShellIcon icon={Inbox} {...props} />; }
export function HashIcon(props: IconProps) { return <ShellIcon icon={Tag01} {...props} />; }
export function MoreIcon(props: IconProps) { return <ShellIcon icon={MoreVertical} {...props} />; }
export function EditIcon(props: IconProps) { return <ShellIcon icon={Edit02} {...props} />; }
export function EyeIcon(props: IconProps) { return <ShellIcon icon={Eye} {...props} />; }
export function RefreshIcon(props: IconProps) { return <ShellIcon icon={Refresh} {...props} />; }
export function DeviceIcon(props: IconProps) { return <ShellIcon icon={Computer} {...props} />; }
export function OfflineIcon(props: IconProps) { return <ShellIcon icon={WifiOff} {...props} />; }
export function InternetIcon(props: IconProps) { return <ShellIcon icon={Globe} {...props} />; }
export function ClockIcon(props: IconProps) { return <ShellIcon icon={Clock} {...props} />; }
export function DownloadIcon(props: IconProps) { return <ShellIcon icon={Download} {...props} />; }
export function UploadIcon(props: IconProps) { return <ShellIcon icon={Upload} {...props} />; }
export function DeleteIcon(props: IconProps) { return <ShellIcon icon={Delete02} {...props} />; }
export function PinIcon(props: IconProps) { return <ShellIcon icon={Pin} {...props} />; }
export function ArrowLeftIcon(props: IconProps) { return <ShellIcon icon={ArrowLeft01} {...props} />; }
export function ArrowRightIcon(props: IconProps) { return <ShellIcon icon={ArrowRight01} {...props} />; }
export function FullScreenIcon(props: IconProps) { return <ShellIcon icon={FullScreen} {...props} />; }
export function SelectionEmptyIcon(props: IconProps) { return <ShellIcon icon={Circle} {...props} />; }
export function SelectionCheckedIcon(props: IconProps) { return <ShellIcon icon={CheckmarkCircle02} {...props} />; }
export function LightThemeIcon(props: IconProps) { return <ShellIcon icon={Sun03} {...props} />; }
export function DarkThemeIcon(props: IconProps) { return <ShellIcon icon={Moon02} {...props} />; }

export function SidebarChevronIcon({ expanded, className = "" }: IconProps & { expanded: boolean }) {
  return <ShellIcon icon={ArrowDown01} className={`${className} ${expanded ? "rotate-90" : "-rotate-90"}`} />;
}

export function PlainTextIcon(props: IconProps) { return <ShellIcon icon={TextFont} {...props} />; }
export function MarkdownIcon(props: IconProps) { return <ShellIcon icon={SourceCode} {...props} />; }
