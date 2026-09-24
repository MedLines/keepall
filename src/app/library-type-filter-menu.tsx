"use client";

import type { ReactNode } from "react";
import type { LibraryTypeFilter } from "@/domain/library-view";
import type { LibrarySidebarCounts } from "./library-sidebar-counts";
import {
  ImageIcon,
  LayersIcon,
  LinkIcon,
  NoteIcon,
  VideoIcon,
} from "./shell-icons";
import { ShellTopMenu } from "./shell-top-menu";

type MenuValue = LibraryTypeFilter | "all";

type Props = {
  value: LibraryTypeFilter | null;
  counts: LibrarySidebarCounts;
  loading?: boolean;
  onChange: (type: LibraryTypeFilter | null) => void;
};

export function LibraryTypeFilterMenu({
  value,
  counts,
  loading = false,
  onChange,
}: Props) {
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
      icon: <LayersIcon />,
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
      count: count(counts.byType.note),
    },
  ];

  return (
    <ShellTopMenu
      ariaLabel="Filter by type"
      iconOnly
      emphasized={value !== null}
      value={value ?? "all"}
      options={options}
      onChange={(next) => onChange(next === "all" ? null : next)}
    />
  );
}
