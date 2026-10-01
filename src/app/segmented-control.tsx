import type { ReactNode } from "react";

type Choice<Value extends string> = {
  value: Value;
  label: string;
  ariaLabel?: string;
  icon?: ReactNode;
};

type Props<Value extends string> = {
  label: string;
  value: Value;
  choices: readonly [Choice<Value>, Choice<Value>];
  onChange: (value: Value) => void;
  disabled?: boolean;
  className?: string;
};

export function SegmentedControl<Value extends string>({ label, value, choices, onChange, disabled = false, className = "" }: Props<Value>) {
  return <div role="group" aria-label={label} data-selected={value === choices[1].value ? "end" : "start"}
    className={`icon-segmented-switch squircle-panel relative isolate flex h-11 shrink-0 rounded-control-lg bg-bg-raised p-0.5 ${className}`}>
    <span aria-hidden="true" className="icon-segmented-thumb squircle-panel ui-selected pointer-events-none absolute left-0.5 top-0.5 h-10 w-[calc(50%_-_2px)] rounded-control-sm" />
    {choices.map(choice => <button key={choice.value} type="button" aria-label={choice.ariaLabel} aria-pressed={value === choice.value} disabled={disabled}
      className={`squircle-panel relative flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control-sm px-2 text-xs font-medium disabled:opacity-60 ${value === choice.value ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
      onClick={() => onChange(choice.value)}>
      {choice.icon}{choice.label}
    </button>)}
  </div>;
}
