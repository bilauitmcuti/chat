'use client';

import type { ReactNode } from 'react';

interface SettingsSwitchRowProps {
  label: ReactNode;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  ariaLabel: string;
  nested?: boolean;
  kbd?: ReactNode;
  /** When false, renders a static pill without an input (SSR placeholder). */
  interactive?: boolean;
}

/** Pill toggle row shared by theme and calendar filter settings. */
export function SettingsSwitchRow({
  label,
  checked,
  onChange,
  ariaLabel,
  nested = false,
  kbd,
  interactive = true,
}: SettingsSwitchRowProps) {
  return (
    <label
      className={`flex items-center justify-between cursor-pointer py-0.5${nested ? ' pl-4' : ''}`}
    >
      <div className="flex items-center gap-2">
        {typeof label === 'string' ? (
          <span
            className={
              nested
                ? 'text-xs font-medium text-muted-foreground'
                : 'text-sm font-medium text-foreground'
            }
          >
            {label}
          </span>
        ) : (
          label
        )}
        {kbd}
      </div>
      <div
        className={`toggle-switch relative inline-flex h-6 w-11 items-center rounded-full ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <span
          className={`toggle-switch-thumb inline-block h-4 w-4 rounded-full shadow-sm ${checked ? 'translate-x-5 bg-background' : 'translate-x-0.5 bg-background dark:bg-foreground'}`}
        />
        {interactive ? (
          <input
            type="checkbox"
            role="switch"
            checked={checked}
            onChange={(e) => onChange?.(e.target.checked)}
            className="sr-only"
            aria-label={ariaLabel}
          />
        ) : null}
      </div>
    </label>
  );
}
