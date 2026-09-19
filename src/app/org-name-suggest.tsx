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
  /** Use inside another form so Enter adds a name instead of submitting the parent. */
  embedded?: boolean;
  /** When false, the list appears only after the user types. Default true. */
  suggestWhenEmpty?: boolean;
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
  embedded = false,
  suggestWhenEmpty = true,
}: Props) {
  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    const matches = query
      ? suggestions.filter((entry) =>
          entry.name.toLowerCase().includes(query),
        )
      : suggestWhenEmpty
        ? suggestions
        : [];
    return matches.slice(0, 8);
  }, [value, suggestions, suggestWhenEmpty]);

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
      return;
    }

    if (
      embedded &&
      event.key === "Enter" &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault();
      submitName(value);
    }
  }

  const inputClass = compact
    ? "ui-field min-h-10 min-w-0 flex-1 px-3 py-2 text-sm disabled:opacity-60"
    : "ui-field min-h-11 px-3 py-2 disabled:opacity-60";

  const buttonClass = compact
    ? "ui-control relative flex h-10 min-w-10 shrink-0 items-center justify-center px-3 text-xs font-medium disabled:opacity-60"
    : "ui-control min-h-11 px-3 py-2 text-sm font-medium disabled:opacity-60";

  const fields = (
    <>
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
            <div className="ui-popover absolute z-20 mt-2 w-full overflow-hidden">
              <ul
                className="scroll-fade max-h-40 overflow-y-auto py-1"
                role="listbox"
              >
                {filtered.map((entry) => (
                  <li key={entry.id} role="option">
                    <button
                      className="ui-menu-item block w-full text-left text-sm text-text-primary"
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
            </div>
          ) : null}
        </div>
        <button
          className={buttonClass}
          disabled={disabled}
          type={embedded ? "button" : "submit"}
          onClick={
            embedded
              ? () => {
                  submitName(value);
                }
              : undefined
          }
        >
          {pending ? "…" : submitLabel}
        </button>
      </div>
      {error ? (
        <p
          className={`${compact ? "mt-1 text-xs" : "mt-2 text-sm"} text-text-danger`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className={compact ? "w-full" : undefined}>{fields}</div>;
  }

  return (
    <form className={compact ? "w-full" : undefined} onSubmit={handleSubmit}>
      {fields}
    </form>
  );
}
