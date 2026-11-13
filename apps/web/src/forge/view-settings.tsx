import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { useRemembered } from "../view-choices.ts";
import type { Dock } from "./dock.tsx";
import { DOCKS } from "./dock.tsx";

export function useHideNonMatches(): [boolean, (on: boolean) => void] {
  return useRemembered("lab.hide", false, z.boolean());
}

export function useBaseline(): [boolean, (on: boolean) => void] {
  return useRemembered("lab.baseline", true, z.boolean());
}

export function useStripTags(): [boolean, (on: boolean) => void] {
  return useRemembered("labc.stripTags", false, z.boolean());
}

export function useDockSide(): [Dock, (side: Dock) => void] {
  return useRemembered<Dock>("labc.dockAt", "right", z.enum(DOCKS));
}

const WIDE = "(min-width: 1280px)";

function subscribeWide(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

export function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches);
}

export function isSideDock(side: Dock): boolean {
  return side === "left" || side === "right";
}

export function usePlacedDock(): Dock {
  const [side] = useDockSide();
  return useWide() || !isSideDock(side) ? side : "top";
}

export function ForgeSettings(): ReactNode {
  const [baseline, setBaseline] = useBaseline();
  return (
    <section className="settings-section" aria-label="Forge">
      <h3>Forge</h3>
      <p className="muted">Kept in this browser.</p>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={baseline}
          onChange={(event) => {
            setBaseline(event.target.checked);
          }}
        />
        Faint baseline under filtered charts
      </label>
    </section>
  );
}
