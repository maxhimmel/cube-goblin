import type { ReactNode } from "react";

export interface SheetTab<T extends string> {
  id: T;
  label: string;
}

export function SheetTabs<T extends string>({
  tabs,
  current,
  label,
  idPrefix,
  onChange,
}: {
  tabs: readonly SheetTab<T>[];
  current: T;
  label: string;
  idPrefix: string;
  onChange: (tab: T) => void;
}): ReactNode {
  return (
    <div className="settings-tabs" role="tablist" aria-label={label} aria-orientation="vertical">
      {tabs.map((option, index) => (
        <button
          key={option.id}
          id={`${idPrefix}-tab-${option.id}`}
          type="button"
          role="tab"
          aria-selected={option.id === current}
          aria-controls={`${idPrefix}-page-${option.id}`}
          tabIndex={option.id === current ? 0 : -1}
          onClick={() => {
            onChange(option.id);
          }}
          onKeyDown={(event) => {
            const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
            if (step === undefined) {
              return;
            }
            event.preventDefault();
            const next = tabs[(index + step + tabs.length) % tabs.length];
            if (next) {
              onChange(next.id);
              document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
