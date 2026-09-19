"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useMemo, useState } from "react";
import { CloseIcon, SearchIcon } from "./shell-icons";
import type { OrgNameSuggestion } from "./org-name-suggest";

type Props = {
  kind: "collection" | "tag";
  suggestions: OrgNameSuggestion[];
  selectedNames: string[];
  disabled: boolean;
  onChoose: (name: string) => void;
  onClose: () => void;
};

function filterSuggestions(
  suggestions: OrgNameSuggestion[],
  query: string,
): OrgNameSuggestion[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return suggestions;
  }

  return suggestions
    .filter((entry) => entry.name.toLowerCase().includes(normalized))
    .sort((left, right) => {
      const leftStarts = left.name.toLowerCase().startsWith(normalized);
      const rightStarts = right.name.toLowerCase().startsWith(normalized);
      return Number(rightStarts) - Number(leftStarts);
    });
}

export function CaptureOrgBrowser({
  kind,
  suggestions,
  selectedNames,
  disabled,
  onChoose,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => filterSuggestions(suggestions, query),
    [query, suggestions],
  );
  const isCollection = kind === "collection";
  const title = isCollection ? "Choose a collection" : "Choose a tag";
  const searchLabel = isCollection ? "Search collections" : "Search tags";

  return (
    <Dialog.Root
      open
      onOpenChange={(open, eventDetails) => {
        if (open) {
          return;
        }
        if (disabled) {
          eventDetails.cancel();
          return;
        }
        onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="ui-backdrop fixed inset-0 z-[80]" />
        <Dialog.Viewport className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4">
          <Dialog.Popup className="ui-popover flex max-h-[min(80dvh,36rem)] w-full max-w-[28rem] flex-col overflow-hidden p-0 outline-none">
            <header className="flex shrink-0 items-start gap-4 border-b border-border-control px-5 py-4">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-lg font-semibold text-text-primary">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-text-secondary">
                  Search the complete list.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="ui-control flex size-10 shrink-0 items-center justify-center"
                aria-label="Close"
                disabled={disabled}
              >
                <CloseIcon />
              </Dialog.Close>
            </header>
            <div className="shrink-0 px-5 py-4">
              <label className="relative block" htmlFor={`capture-browse-${kind}`}>
                <span className="sr-only">{searchLabel}</span>
                <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                <input
                  autoFocus
                  className="ui-field h-11 w-full ps-10 pe-3 text-sm"
                  id={`capture-browse-${kind}`}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="scroll-fade min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {filtered.length > 0 ? (
                <ul className="flex flex-col gap-1" aria-label={title}>
                  {filtered.map((entry) => {
                    const selected = selectedNames.includes(entry.name);
                    return (
                      <li key={entry.id}>
                        <button
                          className={`ui-menu-item flex w-full items-center justify-between text-start text-sm ${
                            selected ? "ui-selected" : ""
                          }`}
                          type="button"
                          aria-pressed={selected}
                          disabled={disabled}
                          onClick={() => {
                            onChoose(entry.name);
                            onClose();
                          }}
                        >
                          <span className="min-w-0 truncate">{entry.name}</span>
                          {selected ? (
                            <span className="text-xs text-text-secondary">Selected</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-3 py-8 text-center text-sm text-text-secondary">
                  No matches.
                </p>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
