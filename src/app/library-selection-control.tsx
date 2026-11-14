"use client";

import { SelectionCheckedIcon, SelectionEmptyIcon } from "./shell-icons";

type Props = {
  label: string;
  className: string;
  visible: boolean;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
};

/**
 * DRAFT: Round checkbox in a card or row corner for multi-select; shown on hover, focus, or while selecting.
 *
 * @import import { LibrarySelectionControl } from "@/app/library-selection-control";
 */
export function LibrarySelectionControl({ label, className, visible, selected, disabled, onToggle }: Props) {
  return <label data-visible={visible} className={className}>
    <span className="sr-only">{label}</span>
    <input checked={selected} className="peer sr-only" disabled={disabled} type="checkbox" onChange={onToggle} onClick={event => event.stopPropagation()} />
    <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-border-focus" data-selection-indicator={selected ? "checked" : "empty"}>
      {selected ? <SelectionCheckedIcon className="size-4" /> : <SelectionEmptyIcon className="size-4" />}
    </span>
  </label>;
}
