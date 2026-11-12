import type { ReactNode } from "react";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function AddCardIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...STROKE}>
      <rect x="6" y="3.5" width="12" height="17" rx="2.5" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  );
}

export function SettingsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...STROKE}>
      <circle cx="12" cy="12" r="5.8" />
      <circle cx="12" cy="12" r="2" />
      <path
        d="M18.2 15.6L19.4 16.3M12.0 19.2L12.0 20.6M5.8 15.6L4.6 16.3M5.8 8.4L4.6 7.7M12.0 4.8L12.0 3.4M18.2 8.4L19.4 7.7"
        strokeWidth="3.6"
      />
    </svg>
  );
}
