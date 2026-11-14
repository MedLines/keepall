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
  RefreshIcon as Refresh, Undo02Icon as Undo02,
  ColorsIcon as Colors, Copy01Icon as Copy01, ScanTextIcon as ScanText,
  ComputerIcon as Computer, WifiOff01Icon as WifiOff,
  Globe02Icon as Globe, Clock01Icon as Clock,
  Download01Icon as Download, Upload01Icon as Upload,
  Txt01Icon as Txt01, ArrowUpRight01Icon as ArrowUpRight01,
  LayoutThreeColumnIcon as LayoutThreeColumn,
  VolumeHighIcon as VolumeHigh, VolumeOffIcon as VolumeOff, MinimizeScreenIcon as MinimizeScreen,
  GoBackward10SecIcon as GoBackward10Sec, GoForward10SecIcon as GoForward10Sec,
} from "@hugeicons/core-free-icons";

// Same folded file outline as PDF and TXT; the installed icon set has no MD file glyph.
const MarkdownFile: IconSvgElement = [Txt01[0], ["path", {
  d: "M4 22V16L7 19.5L10 16V22M14 16H16C18.2 16 20 17.35 20 19C20 20.65 18.2 22 16 22H14V16Z",
  stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.5", key: "md",
}]];

type IconProps = { className?: string; fill?: "none" | "currentColor"; strokeWidth?: number };

/** @import import { ColumnsIcon } from "@/app/shell-icons"; */
export function ColumnsIcon(props: IconProps) { return <ShellIcon icon={LayoutThreeColumn} {...props} />; }

/** All shell icons render a Hugeicons glyph at 18px, stroke 1.5, aria-hidden; size them with className. */
function ShellIcon({ icon, className = "", fill = "none", strokeWidth = 1.5 }: IconProps & { icon: IconSvgElement }) {
  return <HugeiconsIcon icon={icon} size={18} strokeWidth={strokeWidth} fill={fill} className={`shrink-0 ${className}`} aria-hidden="true" />;
}

/**
 * DRAFT: The animated Keepall mark; use it only for branding, never as an action icon.
 *
 * @import import { LogoIcon } from "@/app/shell-icons";
 */
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

/** @import import { LibraryIcon } from "@/app/shell-icons"; */
export function LibraryIcon(props: IconProps) { return <ShellIcon icon={AllBookmark} {...props} />; }
/** @import import { CollectionIcon } from "@/app/shell-icons"; */
export function CollectionIcon(props: IconProps) { return <ShellIcon icon={Folder01} {...props} />; }
/** @import import { LinkIcon } from "@/app/shell-icons"; */
export function LinkIcon(props: IconProps) { return <ShellIcon icon={Link04} {...props} />; }
/** @import import { NoteIcon } from "@/app/shell-icons"; */
export function NoteIcon(props: IconProps) { return <ShellIcon icon={Note01} {...props} />; }
/** @import import { PdfIcon } from "@/app/shell-icons"; */
export function PdfIcon(props: IconProps) { return <ShellIcon icon={Pdf01} {...props} />; }
/** @import import { TextFileIcon } from "@/app/shell-icons"; */
export function TextFileIcon(props: IconProps) { return <ShellIcon icon={Txt01} {...props} />; }
/** @import import { MarkdownFileIcon } from "@/app/shell-icons"; */
export function MarkdownFileIcon(props: IconProps) { return <ShellIcon icon={MarkdownFile} {...props} />; }
/** @import import { ExternalLinkIcon } from "@/app/shell-icons"; */
export function ExternalLinkIcon(props: IconProps) { return <ShellIcon icon={ArrowUpRight01} {...props} />; }
/** @import import { ImageIcon } from "@/app/shell-icons"; */
export function ImageIcon(props: IconProps) { return <ShellIcon icon={Image01} {...props} />; }
/** @import import { ImagesIcon } from "@/app/shell-icons"; */
export function ImagesIcon(props: IconProps) { return <ShellIcon icon={Images} {...props} />; }
/** @import import { VideoIcon } from "@/app/shell-icons"; */
export function VideoIcon(props: IconProps) { return <ShellIcon icon={Video01} {...props} />; }
/** @import import { PlayIcon } from "@/app/shell-icons"; */
export function PlayIcon(props: IconProps) { return <ShellIcon icon={Play} {...props} />; }
/** @import import { PauseIcon } from "@/app/shell-icons"; */
export function PauseIcon(props: IconProps) { return <ShellIcon icon={Pause} {...props} />; }
/** @import import { VolumeIcon } from "@/app/shell-icons"; */
export function VolumeIcon(props: IconProps) { return <ShellIcon icon={VolumeHigh} {...props} />; }
/** @import import { MuteIcon } from "@/app/shell-icons"; */
export function MuteIcon(props: IconProps) { return <ShellIcon icon={VolumeOff} {...props} />; }
/** @import import { ExitFullScreenIcon } from "@/app/shell-icons"; */
export function ExitFullScreenIcon(props: IconProps) { return <ShellIcon icon={MinimizeScreen} {...props} />; }
/** @import import { RewindIcon } from "@/app/shell-icons"; */
export function RewindIcon(props: IconProps) { return <ShellIcon icon={GoBackward10Sec} {...props} />; }
/** @import import { ForwardIcon } from "@/app/shell-icons"; */
export function ForwardIcon(props: IconProps) { return <ShellIcon icon={GoForward10Sec} {...props} />; }
/** @import import { KeyboardIcon } from "@/app/shell-icons"; */
export function KeyboardIcon(props: IconProps) { return <ShellIcon icon={Keyboard} {...props} />; }
/** @import import { BackupIcon } from "@/app/shell-icons"; */
export function BackupIcon(props: IconProps) { return <ShellIcon icon={Archive01} {...props} />; }
/** @import import { SettingsIcon } from "@/app/shell-icons"; */
export function SettingsIcon(props: IconProps) { return <ShellIcon icon={Settings02} {...props} />; }
/** @import import { HelpIcon } from "@/app/shell-icons"; */
export function HelpIcon(props: IconProps) { return <ShellIcon icon={HelpCircle} {...props} />; }
/** @import import { CloseIcon } from "@/app/shell-icons"; */
export function CloseIcon(props: IconProps) { return <ShellIcon icon={Cancel01} {...props} />; }
/** @import import { SearchIcon } from "@/app/shell-icons"; */
export function SearchIcon(props: IconProps) { return <ShellIcon icon={Search01} {...props} />; }
/** @import import { PanelIcon } from "@/app/shell-icons"; */
export function PanelIcon(props: IconProps) { return <ShellIcon icon={SidebarLeft01} {...props} />; }
/** @import import { GridIcon } from "@/app/shell-icons"; */
export function GridIcon(props: IconProps) { return <ShellIcon icon={GridView} {...props} />; }
/** @import import { ListIcon } from "@/app/shell-icons"; */
export function ListIcon(props: IconProps) { return <ShellIcon icon={ListView} {...props} />; }
/** @import import { LayersIcon } from "@/app/shell-icons"; */
export function LayersIcon(props: IconProps) { return <ShellIcon icon={Layers01} {...props} />; }
/** @import import { FilterIcon } from "@/app/shell-icons"; */
export function FilterIcon(props: IconProps) { return <ShellIcon icon={Filter} {...props} />; }
/** @import import { ChevronDownIcon } from "@/app/shell-icons"; */
export function ChevronDownIcon(props: IconProps) { return <ShellIcon icon={ArrowDown01} {...props} />; }
/** @import import { CheckIcon } from "@/app/shell-icons"; */
export function CheckIcon(props: IconProps) { return <ShellIcon icon={Tick02} {...props} />; }
/** @import import { SortDescIcon } from "@/app/shell-icons"; */
export function SortDescIcon(props: IconProps) { return <ShellIcon icon={Sorting01} {...props} />; }
/** @import import { SortAscIcon } from "@/app/shell-icons"; */
export function SortAscIcon({ className = "", ...props }: IconProps) { return <ShellIcon icon={Sorting01} {...props} className={`-scale-y-100 ${className}`} />; }
/** @import import { RelevanceIcon } from "@/app/shell-icons"; */
export function RelevanceIcon(props: IconProps) { return <ShellIcon icon={Target02} {...props} />; }
/** @import import { PlusIcon } from "@/app/shell-icons"; */
export function PlusIcon(props: IconProps) { return <ShellIcon icon={Add01} {...props} />; }
/** @import import { InboxIcon } from "@/app/shell-icons"; */
export function InboxIcon(props: IconProps) { return <ShellIcon icon={Inbox} {...props} />; }
/** @import import { HashIcon } from "@/app/shell-icons"; */
export function HashIcon(props: IconProps) { return <ShellIcon icon={Tag01} {...props} />; }
/** @import import { MoreIcon } from "@/app/shell-icons"; */
export function MoreIcon(props: IconProps) { return <ShellIcon icon={MoreVertical} {...props} />; }
/** @import import { EditIcon } from "@/app/shell-icons"; */
export function EditIcon(props: IconProps) { return <ShellIcon icon={Edit02} {...props} />; }
/** @import import { EyeIcon } from "@/app/shell-icons"; */
export function EyeIcon(props: IconProps) { return <ShellIcon icon={Eye} {...props} />; }
/** @import import { RefreshIcon } from "@/app/shell-icons"; */
export function RefreshIcon(props: IconProps) { return <ShellIcon icon={Refresh} {...props} />; }
/** @import import { PaletteIcon } from "@/app/shell-icons"; */
export function PaletteIcon(props: IconProps) { return <ShellIcon icon={Colors} {...props} />; }
/** @import import { CopyIcon } from "@/app/shell-icons"; */
export function CopyIcon(props: IconProps) { return <ShellIcon icon={Copy01} {...props} />; }
/** @import import { OcrIcon } from "@/app/shell-icons"; */
export function OcrIcon(props: IconProps) { return <ShellIcon icon={ScanText} {...props} />; }
/** @import import { DeviceIcon } from "@/app/shell-icons"; */
export function DeviceIcon(props: IconProps) { return <ShellIcon icon={Computer} {...props} />; }
/** @import import { OfflineIcon } from "@/app/shell-icons"; */
export function OfflineIcon(props: IconProps) { return <ShellIcon icon={WifiOff} {...props} />; }
/** @import import { InternetIcon } from "@/app/shell-icons"; */
export function InternetIcon(props: IconProps) { return <ShellIcon icon={Globe} {...props} />; }
/** @import import { ClockIcon } from "@/app/shell-icons"; */
export function ClockIcon(props: IconProps) { return <ShellIcon icon={Clock} {...props} />; }
/** @import import { DownloadIcon } from "@/app/shell-icons"; */
export function DownloadIcon(props: IconProps) { return <ShellIcon icon={Download} {...props} />; }
/** @import import { UploadIcon } from "@/app/shell-icons"; */
export function UploadIcon(props: IconProps) { return <ShellIcon icon={Upload} {...props} />; }
/** @import import { DeleteIcon } from "@/app/shell-icons"; */
export function DeleteIcon(props: IconProps) { return <ShellIcon icon={Delete02} {...props} />; }
/** @import import { PinIcon } from "@/app/shell-icons"; */
export function PinIcon(props: IconProps) { return <ShellIcon icon={Pin} {...props} />; }
/** @import import { UndoIcon } from "@/app/shell-icons"; */
export function UndoIcon(props: IconProps) { return <ShellIcon icon={Undo02} {...props} />; }
/** @import import { ArrowLeftIcon } from "@/app/shell-icons"; */
export function ArrowLeftIcon(props: IconProps) { return <ShellIcon icon={ArrowLeft01} {...props} />; }
/** @import import { ArrowRightIcon } from "@/app/shell-icons"; */
export function ArrowRightIcon(props: IconProps) { return <ShellIcon icon={ArrowRight01} {...props} />; }
/** @import import { FullScreenIcon } from "@/app/shell-icons"; */
export function FullScreenIcon(props: IconProps) { return <ShellIcon icon={FullScreen} {...props} />; }
/** @import import { SelectionEmptyIcon } from "@/app/shell-icons"; */
export function SelectionEmptyIcon(props: IconProps) { return <ShellIcon icon={Circle} {...props} />; }
/** @import import { SelectionCheckedIcon } from "@/app/shell-icons"; */
export function SelectionCheckedIcon(props: IconProps) { return <ShellIcon icon={CheckmarkCircle02} {...props} />; }
/** @import import { LightThemeIcon } from "@/app/shell-icons"; */
export function LightThemeIcon(props: IconProps) { return <ShellIcon icon={Sun03} {...props} />; }
/** @import import { DarkThemeIcon } from "@/app/shell-icons"; */
export function DarkThemeIcon(props: IconProps) { return <ShellIcon icon={Moon02} {...props} />; }

/** @import import { SidebarChevronIcon } from "@/app/shell-icons"; */
export function SidebarChevronIcon({ expanded, className = "" }: IconProps & { expanded: boolean }) {
  return <ShellIcon icon={ArrowDown01} className={`${className} ${expanded ? "rotate-90" : "-rotate-90"}`} />;
}

/** @import import { PlainTextIcon } from "@/app/shell-icons"; */
export function PlainTextIcon(props: IconProps) { return <ShellIcon icon={TextFont} {...props} />; }
/** @import import { MarkdownIcon } from "@/app/shell-icons"; */
export function MarkdownIcon(props: IconProps) { return <ShellIcon icon={SourceCode} {...props} />; }
