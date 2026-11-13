import type { ReactNode } from "react";
import { useState } from "react";
import type { Dock } from "./dock.tsx";
import { DOCKS } from "./dock.tsx";
import { isSideDock, useDockSide, useWide } from "./view-settings.tsx";

const TURN: Record<Dock, number> = { top: 0, right: 90, bottom: 180, left: 270 };

function Here(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="lab-seam-here">
      <circle cx="8" cy="8" r="3.2" />
    </svg>
  );
}

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
  const [, setSide] = useDockSide();
  const target = TURN[placed] + (open ? 0 : 180);
  const [angle, setAngle] = useState(target);
  const turn = ((((target - angle) % 360) + 540) % 360) - 180;
  if (turn !== 0) {
    setAngle(angle + turn);
  }
  const wide = useWide();
  const [aim, setAim] = useState<Dock | undefined>(undefined);
  const toggleTip = open ? "Hide charts" : "Show charts";
  const tip =
    aim === undefined
      ? toggleTip
      : aim !== placed
        ? `Move charts to the ${aim}`
        : open
          ? `Charts are on the ${aim}`
          : `Show charts on the ${aim}`;
  return (
    <div className="lab-seam" data-open={open ? "" : undefined}>
      <div className="lab-seam-handle">
        <button
          type="button"
          className="lab-seam-toggle"
          aria-label={toggleTip}
          aria-expanded={open}
          style={{ rotate: `${String(angle)}deg` }}
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
              aria-pressed={option === placed}
              disabled={!wide && isSideDock(option)}
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
              {option === placed ? <Here /> : <Chevron />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
