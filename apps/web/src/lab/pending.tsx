import type { ReactNode } from "react";
import { z } from "zod";
import { useRemembered } from "../view-choices.ts";
import { PendingStrips } from "./cards.tsx";
import { CollapseButton } from "./dock.tsx";
import type { Lab } from "./use-lab.ts";

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/u.test(navigator.userAgent);

export const QUEUE_KEY = MAC ? "⌥" : "Alt";

function count(lab: Lab, to: "draft" | "prospect"): number {
  return lab.pending.filter((entry) => entry.to === to).length;
}

function Tally({ lab }: { lab: Lab }): ReactNode {
  return (
    <span className="pending-tally">
      <span data-mark="add">+{count(lab, "draft")}</span>
      <span data-mark="cut">−{count(lab, "prospect")}</span>
    </span>
  );
}

function Side({ lab, to, tags }: { lab: Lab; to: "draft" | "prospect"; tags: boolean }): ReactNode {
  const cards = lab.pending.filter((entry) => entry.to === to).map((entry) => entry.card);
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className="pending-side" data-mark={to === "draft" ? "add" : "cut"}>
      <h3>
        {to === "draft" ? "Add to draft" : "Cut from draft"} <span>{cards.length}</span>
      </h3>
      <PendingStrips lab={lab} cards={cards} tags={tags} />
    </div>
  );
}

export function usePendingOpen(): [boolean, (open: boolean) => void] {
  return useRemembered("pending.gutterOpen", false, z.boolean());
}

export function PendingGutter({
  lab,
  tags,
  open,
  setOpen,
}: {
  lab: Lab;
  tags: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}): ReactNode {
  const toggle = (): void => {
    setOpen(!open);
  };
  return (
    <section
      className="pending"
      data-collapsed={open ? undefined : ""}
      aria-label="Pending"
      {...lab.pendingZone}
    >
      <header className="pending-head">
        <h2>Pending</h2>
        <Tally lab={lab} />
        <span className="pending-head-actions">
          <CollapseButton title="Pending" collapsed={!open} onToggle={toggle} />
        </span>
      </header>
      {open && (
        <>
          <div className="pending-sides">
            {lab.pending.length === 0 ? (
              <p className="pending-hint muted">
                Drag cards here, or <kbd>{QUEUE_KEY}</kbd>-click a card
              </p>
            ) : (
              <>
                <Side lab={lab} to="draft" tags={tags} />
                <Side lab={lab} to="prospect" tags={tags} />
              </>
            )}
          </div>
          <span className="pending-actions">
            <button type="button" disabled={!lab.applyPending} onClick={lab.applyPending}>
              Apply
            </button>
            <button
              type="button"
              className="lab-link"
              disabled={lab.pending.length === 0}
              onClick={lab.clearPending}
            >
              Clear
            </button>
          </span>
        </>
      )}
    </section>
  );
}
