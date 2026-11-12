import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { useRemembered } from "../view-choices.ts";
import type { Dock } from "./dock.tsx";
import { DOCKS } from "./dock.tsx";

const DOCK_LABELS: Record<Dock, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

export function useHideNonMatches(): [boolean, (on: boolean) => void] {
  return useRemembered("lab.hide", false, z.boolean());
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

export function usePlacedDock(): Dock {
  const [side] = useDockSide();
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches);
  return wide || side === "top" || side === "bottom" ? side : "top";
}

export function ForgeSettings(): ReactNode {
  const [hide, setHide] = useHideNonMatches();
  const [tags, setTags] = useStripTags();
  const [side, setSide] = useDockSide();
  return (
    <section className="settings-section" aria-label="Forge">
      <h3>Forge</h3>
      <p className="muted">Kept in this browser.</p>
      <label className="field">
        Cards that don&apos;t match the filter
        <select
          value={hide ? "hide" : "dim"}
          onChange={(event) => {
            setHide(event.target.value === "hide");
          }}
        >
          <option value="dim">Dim</option>
          <option value="hide">Hide</option>
        </select>
      </label>
      <label className="field">
        Charts panel side (wide screens)
        <select
          value={side}
          onChange={(event) => {
            const next = DOCKS.find((option) => option === event.target.value);
            if (next) {
              setSide(next);
            }
          }}
        >
          {DOCKS.map((option) => (
            <option key={option} value={option}>
              {DOCK_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={tags}
          onChange={(event) => {
            setTags(event.target.checked);
          }}
        />
        Tags on cards
      </label>
    </section>
  );
}
