import type { ReactNode } from "react";
import { useState } from "react";
import type { Dock } from "./dock.tsx";
import { DOCKS } from "./dock.tsx";
import { isSideDock, useDockSide, useWide } from "./view-settings.tsx";

const TURN: Record<Dock, number> = { top: 0, right: 90, bottom: 180, left: 270 };

function Chevron(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 10l4-4 4 4" />
    </svg>
  );
}

export function Seam({
  placed,
  open,
  setOpen,
}: {
  placed: Dock;
  open: boolean;
  setOpen: (open: boolean) => void;
}): ReactNode {
  const [side, setSide] = useDockSide();
  const wide = useWide();
  const [aim, setAim] = useState<Dock | undefined>(undefined);
  const toggleTip = open ? "Hide charts" : "Show charts";
  const tip =
    aim === undefined
      ? toggleTip
      : aim === side && open
        ? `Charts are on the ${aim}`
        : `Move charts to the ${aim}`;
  return (
    <div className="lab-seam" data-open={open ? "" : undefined}>
      <div className="lab-seam-handle">
        <button
          type="button"
          className="lab-seam-toggle"
          aria-label={toggleTip}
          aria-expanded={open}
          style={{ rotate: `${String(TURN[placed] + (open ? 0 : 180))}deg` }}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <Chevron />
        </button>
        <span className="lab-seam-tip" aria-hidden="true" key={tip}>
          {tip}
        </span>
        <div className="lab-seam-sides" role="group" aria-label="Charts side">
          {DOCKS.map((option) => (
            <button
              key={option}
              type="button"
              data-side={option}
              aria-label={`Charts on the ${option}`}
              aria-pressed={option === side}
              disabled={!wide && isSideDock(option)}
              title={!wide && isSideDock(option) ? "Side panels need a wide screen" : undefined}
              style={{ rotate: `${String(TURN[option])}deg` }}
              onPointerEnter={() => {
                setAim(option);
              }}
              onPointerLeave={() => {
                setAim(undefined);
              }}
              onFocus={() => {
                setAim(option);
              }}
              onBlur={() => {
                setAim(undefined);
              }}
              onClick={() => {
                setSide(option);
                setOpen(true);
              }}
            >
              <Chevron />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
