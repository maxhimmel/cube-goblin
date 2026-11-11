import type { ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";
import { useRemembered } from "../view-choices.ts";
import { PendingStrips } from "./cards.tsx";
import type { Lab } from "./use-lab.ts";

export const PENDING_LAYOUTS = ["a", "b", "c", "e"] as const;
export type PendingLayout = (typeof PENDING_LAYOUTS)[number];

export const PENDING_LAYOUT_LABELS: Record<PendingLayout, string> = {
  a: "Header chip",
  b: "Header strip",
  c: "Gutter between the piles",
  e: "Dock block",
};

export function pendingLayout(value: string | undefined): PendingLayout {
  return PENDING_LAYOUTS.find((id) => id === value) ?? "a";
}

const HINT = "Drag cards here, or Alt-click a card";

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

function Actions({ lab }: { lab: Lab }): ReactNode {
  return (
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

function Sides({ lab, tags }: { lab: Lab; tags: boolean }): ReactNode {
  return lab.pending.length === 0 ? (
    <p className="pending-hint muted">{HINT}</p>
  ) : (
    <>
      <Side lab={lab} to="draft" tags={tags} />
      <Side lab={lab} to="prospect" tags={tags} />
    </>
  );
}

export function PendingChip({ lab, tags }: { lab: Lab; tags: boolean }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="pending-a"
      data-open={open ? "" : undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
      {...lab.pendingZone}
    >
      <button
        type="button"
        className="pending-a-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <span className="pending-title">Pending</span>
        <Tally lab={lab} />
        <span className="pending-caret">▾</span>
      </button>
      {lab.pending.length > 0 && <Actions lab={lab} />}
      {open && (
        <div className="pending-a-list" tabIndex={-1}>
          <Sides lab={lab} tags={tags} />
        </div>
      )}
    </div>
  );
}

export function PendingStrip({ lab, tags }: { lab: Lab; tags: boolean }): ReactNode {
  return (
    <div className="pending-b" aria-label="Pending" {...lab.pendingZone}>
      <span className="pending-title">Pending</span>
      <Tally lab={lab} />
      <div className="pending-b-sides">
        <Sides lab={lab} tags={tags} />
      </div>
      <Actions lab={lab} />
    </div>
  );
}

export function useGutterOpen(): [boolean, (open: boolean) => void] {
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
  if (!open) {
    return (
      <button
        type="button"
        className="pending-c pending-c-rail"
        aria-label="Show pending"
        title="Show pending"
        onClick={() => {
          setOpen(true);
        }}
        {...lab.pendingZone}
      >
        <span className="pending-title">Pending</span>
        <Tally lab={lab} />
        <span className="pending-c-arrows">⇄</span>
      </button>
    );
  }
  return (
    <section className="pending-c" aria-label="Pending" {...lab.pendingZone}>
      <header>
        <span className="pending-title">Pending</span>
        <Tally lab={lab} />
        <button
          type="button"
          className="pending-c-close"
          aria-label="Collapse pending"
          title="Collapse pending"
          onClick={() => {
            setOpen(false);
          }}
        >
          ⇥
        </button>
      </header>
      <div className="pending-c-sides">
        <Sides lab={lab} tags={tags} />
      </div>
      <Actions lab={lab} />
    </section>
  );
}

export function PendingBlockBody({ lab, tags }: { lab: Lab; tags: boolean }): ReactNode {
  return (
    <div className="pending-e" {...lab.pendingZone}>
      <div className="pending-e-head">
        <Tally lab={lab} />
        <Actions lab={lab} />
      </div>
      <div className="pending-e-sides">
        <Sides lab={lab} tags={tags} />
      </div>
    </div>
  );
}
