"use client";

import { type FormEvent, type KeyboardEvent, useMemo } from "react";

export type OrgNameSuggestion = { id: string; name: string };

type Props = {
  inputId: string;
  label: string;
  hideLabel?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: OrgNameSuggestion[];
  disabled?: boolean;
  pending?: boolean;
  submitLabel?: string;
  error?: string | null;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
  compact?: boolean;
};

/** Typeahead for tag or collection names — pick existing or submit a new name. */
export function OrgNameSuggest({
  inputId,
  label,
  hideLabel = false,
  placeholder,
  value,
  onChange,
  suggestions,
  disabled = false,
  pending = false,
  submitLabel = "Add",
  error = null,
  onSubmit,
  onCancel,
  compact = false,
}: Props) {
  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    const matches = query
      ? suggestions.filter((entry) =>
          entry.name.toLowerCase().includes(query),
        )
      : suggestions;
    return matches.slice(0, 8);
  }, [value, suggestions]);

  function submitName(name: string) {
    const trimmed = name.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSubmit(trimmed);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitName(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel?.();
    }
  }

  const inputClass = compact
    ? "min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
    : "rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60";

  const buttonClass = compact
    ? "relative flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md bg-white/95 px-2 text-xs font-medium text-zinc-800 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06)] backdrop-blur-sm disabled:opacity-60"
    : "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-60";

  return (
    <form className={compact ? "w-full" : undefined} onSubmit={handleSubmit}>
      <label className={hideLabel ? "sr-only" : "text-sm font-medium"} htmlFor={inputId}>
        {label}
      </label>
      <div
        className={
          compact
            ? "flex gap-1"
            : "mt-1 flex flex-wrap items-end gap-2"
        }
      >
        <div className={compact ? "relative min-w-0 flex-1" : "relative min-w-40 flex-1"}>
          <input
            autoComplete="off"
            className={`${inputClass} w-full`}
            disabled={disabled}
            id={inputId}
            list={undefined}
            placeholder={placeholder}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={filtered.length > 0}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          {filtered.length > 0 ? (
            <ul
              className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-md"
              role="listbox"
            >
              {filtered.map((entry) => (
                <li key={entry.id} role="option">
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    type="button"
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(entry.name);
                      submitName(entry.name);
                    }}
                  >
                    {entry.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button className={buttonClass} disabled={disabled} type="submit">
          {pending ? "…" : submitLabel}
        </button>
      </div>
      {error ? (
        <p
          className={`${compact ? "mt-1 text-xs" : "mt-2 text-sm"} text-red-700`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
