import type { CardStatus } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import { ManaCost } from "../mana.tsx";
import { previewAt } from "../strip.tsx";
import { Segmented } from "./toolbar.tsx";
import type { Lab, PendingMove } from "./use-lab.ts";

export const PENDING_LAYOUTS = ["a", "b", "c", "d"] as const;
export type PendingLayout = (typeof PENDING_LAYOUTS)[number];

export const PENDING_LAYOUT_LABELS: Record<PendingLayout, string> = {
  a: "Marks in place",
  b: "Header strip",
  c: "Gutter",
  d: "Floor bar",
};

export function pendingLayout(value: string | undefined): PendingLayout {
  return PENDING_LAYOUTS.find((id) => id === value) ?? "a";
}

function side(lab: Lab, to: CardStatus): PendingMove[] {
  return lab.pending.filter((entry) => entry.to === to);
}

function Tally({ lab }: { lab: Lab }): ReactNode {
  return (
    <span className="pending-tally">
      <span data-mark="add">+{side(lab, "draft").length}</span>
      <span data-mark="cut">−{side(lab, "prospect").length}</span>
    </span>
  );
}

function Actions({ lab }: { lab: Lab }): ReactNode {
  const empty = lab.pending.length === 0;
  return (
    <span className="pending-actions">
      <button type="button" disabled={!lab.applyPending} onClick={lab.applyPending}>
        Apply
      </button>
      <button type="button" className="lab-link" disabled={empty} onClick={lab.clearPending}>
        Clear
      </button>
    </span>
  );
}

function Chip({ lab, entry }: { lab: Lab; entry: PendingMove }): ReactNode {
  const mark = entry.to === "draft" ? "add" : "cut";
  return (
    <li
      className="pending-chip"
      data-mark={mark}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          lab.onHover(previewAt(entry.card, event.currentTarget.getBoundingClientRect()));
        }
      }}
      onPointerLeave={() => {
        lab.onHover(undefined);
      }}
    >
      <span className="pending-chip-sign">{mark === "add" ? "+" : "−"}</span>
      <span className="pending-chip-name">{entry.card.name}</span>
      <ManaCost cost={entry.card.manaCost} />
      <button
        type="button"
        aria-label={`Remove ${entry.card.name} from pending`}
        onClick={() => {
          lab.onHover(undefined);
          lab.unqueue(entry.card.slug);
        }}
      >
        ×
      </button>
    </li>
  );
}

function Chips({ lab, to }: { lab: Lab; to: CardStatus }): ReactNode {
  return (
    <ul className="pending-chips" aria-label={to === "draft" ? "Pending adds" : "Pending cuts"}>
      {side(lab, to).map((entry) => (
        <Chip key={entry.card.slug} lab={lab} entry={entry} />
      ))}
    </ul>
  );
}

const HINT = "Drag cards here, or Alt-click a card";

export function DropSwitch({ lab }: { lab: Lab }): ReactNode {
  return (
    <Segmented
      label="Dropping on a pile"
      caption="Drop"
      options={[
        { id: "move", label: "Move", title: "Dropping on a pile moves the card now" },
        { id: "queue", label: "Queue", title: "Dropping on a pile adds it to Pending" },
      ]}
      value={lab.dropMode}
      onChange={lab.setDropMode}
    />
  );
}

export function PendingChip({ lab }: { lab: Lab }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="pending-a"
      data-open={open ? "" : undefined}
      data-empty={lab.pending.length === 0 ? "" : undefined}
      onPointerEnter={() => {
        setOpen(true);
      }}
      onPointerLeave={() => {
        setOpen(false);
      }}
      onFocus={() => {
        setOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      {...lab.pendingZone}
    >
      <span className="pending-title">Pending</span>
      <Tally lab={lab} />
      <Actions lab={lab} />
      {open && (
        <div className="pending-a-list">
          {lab.pending.length === 0 ? (
            <p className="muted">{HINT}</p>
          ) : (
            <>
              <Chips lab={lab} to="draft" />
              <Chips lab={lab} to="prospect" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PendingStrip({ lab }: { lab: Lab }): ReactNode {
  return (
    <div className="pending-b" aria-label="Pending" {...lab.pendingZone}>
      <span className="pending-title">Pending</span>
      <Tally lab={lab} />
      <div className="pending-b-sides">
        {lab.pending.length === 0 ? (
          <span className="muted">{HINT}</span>
        ) : (
          <>
            <Chips lab={lab} to="draft" />
            <Chips lab={lab} to="prospect" />
          </>
        )}
      </div>
      <Actions lab={lab} />
    </div>
  );
}

export function PendingGutter({ lab }: { lab: Lab }): ReactNode {
  return (
    <section className="pending-c" aria-label="Pending" {...lab.pendingZone}>
      <header>
        <span className="pending-title">Pending</span>
        <Tally lab={lab} />
      </header>
      <div className="pending-c-sides">
        <h3>Add</h3>
        <Chips lab={lab} to="draft" />
        <h3>Cut</h3>
        <Chips lab={lab} to="prospect" />
        {lab.pending.length === 0 && <p className="muted">{HINT}</p>}
      </div>
      <Actions lab={lab} />
    </section>
  );
}

export function PendingBar({ lab }: { lab: Lab }): ReactNode {
  return (
    <div className="pending-d" aria-label="Pending" {...lab.pendingZone}>
      <span className="pending-title">Pending</span>
      <Tally lab={lab} />
      <div className="pending-d-sides">
        {lab.pending.length === 0 ? (
          <span className="muted">{HINT}</span>
        ) : (
          <>
            <Chips lab={lab} to="draft" />
            <span className="pending-d-rule" />
            <Chips lab={lab} to="prospect" />
          </>
        )}
      </div>
      <Actions lab={lab} />
    </div>
  );
}
