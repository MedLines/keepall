"use client";

import type { ReactNode } from "react";
import type { LibraryTypeFilter } from "@/domain/library-view";
import {
  ImageIcon,
  LayersIcon,
  LinkIcon,
  NoteIcon,
} from "./shell-icons";
import { ShellTopMenu } from "./shell-top-menu";

type MenuValue = LibraryTypeFilter | "all";

const TYPE_FILTER_OPTIONS: {
  value: MenuValue;
  label: string;
  icon: ReactNode;
}[] = [
  { value: "all", label: "All types", icon: <LayersIcon /> },
  { value: "link", label: "Links", icon: <LinkIcon /> },
  { value: "note", label: "Notes", icon: <NoteIcon /> },
  { value: "image", label: "Images", icon: <ImageIcon /> },
];

type Props = {
  value: LibraryTypeFilter | null;
  onChange: (type: LibraryTypeFilter | null) => void;
};

export function LibraryTypeFilterMenu({ value, onChange }: Props) {
  return (
    <ShellTopMenu
      ariaLabel="Filter by type"
      iconOnly
      emphasized={value !== null}
      value={value ?? "all"}
      options={TYPE_FILTER_OPTIONS}
      onChange={(next) => onChange(next === "all" ? null : next)}
    />
  );
}
