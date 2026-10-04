"use client";

import { useId } from "react";
import type { CollectionDeleteDestination } from "@/persistence/collections";

type Props = {
  value: CollectionDeleteDestination;
  busy: boolean;
  onChange: (destination: CollectionDeleteDestination) => void;
};

export function CollectionDeleteOptions({ value, busy, onChange }: Props) {
  const name = useId();
  return <fieldset className="flex flex-col gap-2" disabled={busy}>
    <legend className="mb-2 text-sm font-medium text-text-primary">What should happen to the contents?</legend>
    <div className="grid auto-rows-fr gap-2">
    {([
      ["unsorted", "Move to Unsorted", "Items stay in your library and become Unsorted."],
      ["trash", "Move to Trash", "Items move to Trash and can be restored later."],
    ] as const).map(([destination, label, description]) => <label key={destination} className="collection-delete-option ui-control flex cursor-pointer items-start gap-3 px-4 py-3 text-sm text-text-primary has-[:checked]:bg-bg-active">
      <input className="mt-1" type="radio" name={name} value={destination} checked={value === destination} onChange={() => onChange(destination)} />
      <span><span className="block font-medium">{label}</span><span className="mt-1 block text-text-secondary">{description}</span></span>
    </label>)}
    </div>
  </fieldset>;
}
