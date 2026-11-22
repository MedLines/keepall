import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BackupIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  CollectionIcon,
  ColumnsIcon,
  CopyIcon,
  DarkThemeIcon,
  DeleteIcon,
  DeviceIcon,
  DownloadIcon,
  EditIcon,
  ExitFullScreenIcon,
  ExternalLinkIcon,
  EyeIcon,
  FilterIcon,
  ForwardIcon,
  FullScreenIcon,
  GridIcon,
  HashIcon,
  HelpIcon,
  ImageIcon,
  ImagesIcon,
  InboxIcon,
  InternetIcon,
  KeyboardIcon,
  LayersIcon,
  LibraryIcon,
  LightThemeIcon,
  LinkIcon,
  ListIcon,
  MarkdownFileIcon,
  MarkdownIcon,
  MoreIcon,
  MuteIcon,
  NoteIcon,
  OcrIcon,
  OfflineIcon,
  PaletteIcon,
  PanelIcon,
  PauseIcon,
  PdfIcon,
  PinIcon,
  PlainTextIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  RelevanceIcon,
  RewindIcon,
  SearchIcon,
  SelectionCheckedIcon,
  SelectionEmptyIcon,
  SettingsIcon,
  SidebarChevronIcon,
  SortAscIcon,
  SortDescIcon,
  TextFileIcon,
  UndoIcon,
  AgentIcon,
  UploadIcon,
  VideoIcon,
  VolumeIcon,
  LogoIcon,
} from "./shell-icons";

// Every icon is written out so agents can read the full set from the manifest.
// shell-icons.test.ts fails if an exported icon is missing here.
function IconTile({ name, children }: { name: string; children: ReactNode }) {
  return <li className="flex items-center gap-3 rounded-control-sm bg-bg-surface px-3 py-2">
    {children}
    <code className="truncate text-xs text-text-secondary">{name}</code>
  </li>;
}

const meta = {
  title: "Foundations/Icons",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "The closed icon set. Import icons from `@/app/shell-icons` (Hugeicons glyphs, 18px by default, stroke 1.5, aria-hidden) and size them with className. File types use `DocumentIcon`. Never use emoji or another icon library.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {
  render: () => (
    <ul className="grid grid-cols-4 gap-2 text-text-primary">
      <IconTile name="ArrowLeftIcon"><ArrowLeftIcon /></IconTile>
      <IconTile name="ArrowRightIcon"><ArrowRightIcon /></IconTile>
      <IconTile name="BackupIcon"><BackupIcon /></IconTile>
      <IconTile name="CheckIcon"><CheckIcon /></IconTile>
      <IconTile name="ChevronDownIcon"><ChevronDownIcon /></IconTile>
      <IconTile name="ClockIcon"><ClockIcon /></IconTile>
      <IconTile name="CloseIcon"><CloseIcon /></IconTile>
      <IconTile name="CollectionIcon"><CollectionIcon /></IconTile>
      <IconTile name="ColumnsIcon"><ColumnsIcon /></IconTile>
      <IconTile name="CopyIcon"><CopyIcon /></IconTile>
      <IconTile name="DarkThemeIcon"><DarkThemeIcon /></IconTile>
      <IconTile name="DeleteIcon"><DeleteIcon /></IconTile>
      <IconTile name="DeviceIcon"><DeviceIcon /></IconTile>
      <IconTile name="DownloadIcon"><DownloadIcon /></IconTile>
      <IconTile name="EditIcon"><EditIcon /></IconTile>
      <IconTile name="ExitFullScreenIcon"><ExitFullScreenIcon /></IconTile>
      <IconTile name="ExternalLinkIcon"><ExternalLinkIcon /></IconTile>
      <IconTile name="EyeIcon"><EyeIcon /></IconTile>
      <IconTile name="FilterIcon"><FilterIcon /></IconTile>
      <IconTile name="ForwardIcon"><ForwardIcon /></IconTile>
      <IconTile name="FullScreenIcon"><FullScreenIcon /></IconTile>
      <IconTile name="GridIcon"><GridIcon /></IconTile>
      <IconTile name="HashIcon"><HashIcon /></IconTile>
      <IconTile name="HelpIcon"><HelpIcon /></IconTile>
      <IconTile name="ImageIcon"><ImageIcon /></IconTile>
      <IconTile name="ImagesIcon"><ImagesIcon /></IconTile>
      <IconTile name="InboxIcon"><InboxIcon /></IconTile>
      <IconTile name="InternetIcon"><InternetIcon /></IconTile>
      <IconTile name="KeyboardIcon"><KeyboardIcon /></IconTile>
      <IconTile name="LayersIcon"><LayersIcon /></IconTile>
      <IconTile name="LibraryIcon"><LibraryIcon /></IconTile>
      <IconTile name="LightThemeIcon"><LightThemeIcon /></IconTile>
      <IconTile name="LinkIcon"><LinkIcon /></IconTile>
      <IconTile name="ListIcon"><ListIcon /></IconTile>
      <IconTile name="MarkdownFileIcon"><MarkdownFileIcon /></IconTile>
      <IconTile name="MarkdownIcon"><MarkdownIcon /></IconTile>
      <IconTile name="MoreIcon"><MoreIcon /></IconTile>
      <IconTile name="MuteIcon"><MuteIcon /></IconTile>
      <IconTile name="NoteIcon"><NoteIcon /></IconTile>
      <IconTile name="OcrIcon"><OcrIcon /></IconTile>
      <IconTile name="OfflineIcon"><OfflineIcon /></IconTile>
      <IconTile name="PaletteIcon"><PaletteIcon /></IconTile>
      <IconTile name="PanelIcon"><PanelIcon /></IconTile>
      <IconTile name="PauseIcon"><PauseIcon /></IconTile>
      <IconTile name="PdfIcon"><PdfIcon /></IconTile>
      <IconTile name="PinIcon"><PinIcon /></IconTile>
      <IconTile name="PlainTextIcon"><PlainTextIcon /></IconTile>
      <IconTile name="PlayIcon"><PlayIcon /></IconTile>
      <IconTile name="PlusIcon"><PlusIcon /></IconTile>
      <IconTile name="RefreshIcon"><RefreshIcon /></IconTile>
      <IconTile name="RelevanceIcon"><RelevanceIcon /></IconTile>
      <IconTile name="RewindIcon"><RewindIcon /></IconTile>
      <IconTile name="SearchIcon"><SearchIcon /></IconTile>
      <IconTile name="SelectionCheckedIcon"><SelectionCheckedIcon /></IconTile>
      <IconTile name="SelectionEmptyIcon"><SelectionEmptyIcon /></IconTile>
      <IconTile name="SettingsIcon"><SettingsIcon /></IconTile>
      <IconTile name="SidebarChevronIcon"><SidebarChevronIcon expanded={false} /></IconTile>
      <IconTile name="SortAscIcon"><SortAscIcon /></IconTile>
      <IconTile name="SortDescIcon"><SortDescIcon /></IconTile>
      <IconTile name="TextFileIcon"><TextFileIcon /></IconTile>
      <IconTile name="UndoIcon"><UndoIcon /></IconTile>
      <IconTile name="AgentIcon"><AgentIcon /></IconTile>
      <IconTile name="UploadIcon"><UploadIcon /></IconTile>
      <IconTile name="VideoIcon"><VideoIcon /></IconTile>
      <IconTile name="VolumeIcon"><VolumeIcon /></IconTile>
    </ul>
  ),
};

/** Size with className; the default is 18px. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-text-primary">
      <SearchIcon className="size-3" />
      <SearchIcon className="size-4" />
      <SearchIcon />
      <SearchIcon className="size-5" />
    </div>
  ),
};

/** The brand mark, for branding only. */
export const Logo: Story = {
  render: () => <LogoIcon className="size-12" />,
};
