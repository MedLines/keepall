"use client";

import { useId, type ReactNode } from "react";
import { Select } from "@base-ui/react/select";
import { Tooltip } from "@base-ui/react/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MenuHoverList } from "@/components/ui/menu-hover-list";
import { libraryTypeSelectionLabel, parseLibraryType, selectedLibraryTypes, type LibraryTypeFilter, type LibraryTypeSelection } from "@/domain/library-view";
import type { LibrarySidebarCounts } from "./library-sidebar-counts";
import {
  ImageIcon,
  FilterIcon,
  LinkIcon,
  NoteIcon,
  PdfIcon,
  VideoIcon,
  CheckIcon,
} from "./shell-icons";
import { SHELL_TOOLTIP } from "./shell-styles";

type MenuValue = LibraryTypeFilter | "all";

type Props = {
  value: LibraryTypeSelection;
  counts: LibrarySidebarCounts;
  loading?: boolean;
  onChange: (type: LibraryTypeSelection) => void;
};

export function LibraryTypeFilterMenu({
  value,
  counts,
  loading = false,
  onChange,
}: Props) {
  const tooltipId = useId();
  const selected = selectedLibraryTypes(value);
  const label = `Filter by type: ${libraryTypeSelectionLabel(value) ?? "All types"}`;
  const count = (value: number) => (loading ? undefined : value);
  const options: {
    value: MenuValue;
    label: string;
    icon: ReactNode;
    count?: number;
  }[] = [
    {
      value: "all",
      label: "All types",
      icon: <FilterIcon />,
      count: count(counts.all),
    },
    {
      value: "image",
      label: "Images",
      icon: <ImageIcon />,
      count: count(counts.byType.image),
    },
    {
      value: "video",
      label: "Videos",
      icon: <VideoIcon />,
      count: count(counts.byType.video),
    },
    {
      value: "link",
      label: "Links",
      icon: <LinkIcon />,
      count: count(counts.byType.link),
    },
    {
      value: "note",
      label: "Notes",
      icon: <NoteIcon />,
      count: count(counts.byType.note + counts.byType.document - counts.pdfDocuments),
    },
    { value: "document", label: "Documents", icon: <PdfIcon />, count: count(counts.byType.document) },
  ];

  return (
    <Tooltip.Root>
      <Select.Root<MenuValue, true>
        multiple
        value={selected.length ? selected : ["all"]}
        onValueChange={(next) => onChange(next.includes("all") && selected.length ? null : parseLibraryType(next.filter(type => type !== "all").join(",")))}
      >
        <Select.Trigger
          render={<Tooltip.Trigger delay={350} />}
          aria-label={label}
          title={label}
          aria-describedby={tooltipId}
          className={`ui-control inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-control-lg px-3 ${selected.length ? "ui-selected" : ""}`}
        >
          <span aria-hidden="true" className="inline-flex items-center gap-2">
            {selected.length ? options.filter(option => option.value !== "all" && selected.includes(option.value)).map(option => <span key={option.value} className="inline-flex shrink-0">{option.icon}</span>) : <FilterIcon />}
          </span>
          <span className="sr-only">{libraryTypeSelectionLabel(value) ?? "All types"}</span>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner align="end" alignItemWithTrigger={false} sideOffset={8} collisionPadding={8} positionMethod="fixed" className="z-[90] data-[anchor-hidden]:invisible">
            <Select.Popup className="shell-select-popup ui-menu-popup ui-popover flex max-h-[min(24rem,var(--available-height))] min-w-[max(12rem,var(--anchor-width))] max-w-[calc(100vw-1rem)] flex-col overflow-hidden outline-none">
              <ScrollArea className="flex min-h-0 flex-col" viewportClassName="min-h-0 flex-1">
                <Select.List aria-label="Filter by type">
                  <MenuHoverList>
                    {options.map(option => <Select.Item key={option.value} value={option.value} label={option.label} className="shell-select-option ui-menu-item flex w-full items-center gap-2 text-left text-sm text-text-primary outline-none data-[highlighted]:bg-bg-active">
                      {option.icon}
                      <Select.ItemText className="flex-1 whitespace-nowrap">{option.label}</Select.ItemText>
                      {option.count !== undefined ? <span className="pl-2 text-xs tabular-nums text-text-secondary">{option.count}</span> : null}
                      <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center"><Select.ItemIndicator><CheckIcon className="size-4" /></Select.ItemIndicator></span>
                    </Select.Item>)}
                  </MenuHoverList>
                </Select.List>
              </ScrollArea>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Tooltip.Portal><Tooltip.Positioner side="bottom" sideOffset={8} collisionPadding={8} className="z-[100]"><Tooltip.Popup id={tooltipId} role="tooltip" className={SHELL_TOOLTIP}>{label}</Tooltip.Popup></Tooltip.Positioner></Tooltip.Portal>
    </Tooltip.Root>
  );
}
