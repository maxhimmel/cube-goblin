import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";
import { SortMenu } from "../sort-chain.tsx";
import { Preview } from "../strip.tsx";
import { useRemembered } from "../view-choices.ts";
import { CardColumns, CardRows } from "./cards.tsx";
import type { Dock } from "./dock.tsx";
import { BlocksMenu, DOCKS, DockBlocks, useDockState } from "./dock.tsx";
import { LayoutsMenu } from "./layouts-menu.tsx";
import type { PendingLayout } from "./pending.tsx";
import {
  PENDING_LAYOUTS,
  PENDING_LAYOUT_LABELS,
  PendingBlockBody,
  PendingChip,
  PendingGutter,
  PendingStrip,
  pendingLayout,
  useGutterOpen,
} from "./pending.tsx";
import { AxisTabs, DraftCount, QueryBar, Segmented, Toggle } from "./toolbar.tsx";
import type { Lab } from "./use-lab.ts";
import { useLab } from "./use-lab.ts";

type CardView = "columns" | "rows";

const DOCK_ARROWS: Record<Dock, string> = { top: "↑", right: "→", bottom: "↓", left: "←" };

function LabView({ lab, onApply }: { lab: Lab; onApply: () => void }): ReactNode {
  const [dockAt, setDockAt] = useRemembered<Dock>("labc.dockAt", "top", z.enum(DOCKS));
  const [tags, setTags] = useRemembered("labc.stripTags", false, z.boolean());
  const [open, setOpen] = useRemembered("labc.dockOpen", true, z.boolean());
  const [view, setView] = useRemembered<CardView>(
    "labc.view",
    "columns",
    z.enum(["columns", "rows"]),
  );
  const dock = useDockState();
  const search: { pending?: string | undefined } = useSearch({ strict: false });
  const navigate = useNavigate();
  const layout = pendingLayout(search.pending);
  const [gutterOpen, setGutterOpen] = useGutterOpen();
  const setLayout = (next: PendingLayout): void => {
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, pending: next }),
      replace: true,
      resetScroll: false,
    });
  };
  const draft = lab.cards.filter((card) => card.status === "draft");
  const prospects = lab.cards.filter((card) => card.status !== "draft");
  const pile = (cards: typeof draft, compact: boolean): ReactNode =>
    view === "columns" ? (
      <CardColumns lab={lab} cards={cards} compact={compact} tags={tags} />
    ) : (
      <CardRows lab={lab} cards={cards} />
    );
  return (
    <div
      className="lab"
      data-dock={dockAt}
      data-dock-open={open ? "" : undefined}
      data-pending-layout={layout}
      data-gutter-open={layout === "c" && gutterOpen ? "" : undefined}
      {...lab.dragRoot}
    >
      <header className="lab-top">
        <h1>Lab</h1>
        <DraftCount lab={lab} />
        {layout === "a" && <PendingChip lab={lab} tags={tags} />}
        <QueryBar lab={lab} />
        <div className="lab-controls">
          <Segmented
            label="Cards that don't match"
            caption="Non-matches"
            options={[
              { id: false, label: "Dim" },
              { id: true, label: "Hide" },
            ]}
            value={lab.hide}
            onChange={lab.setHide}
          />
          <div className="lab-dock-controls">
            <Segmented
              label="Charts dock"
              caption="Charts"
              options={DOCKS.map((id) => ({
                id,
                label: DOCK_ARROWS[id],
                title: `Charts on the ${id}`,
              }))}
              value={dockAt}
              onChange={setDockAt}
            />
            <button
              type="button"
              className="lab-dock-toggle"
              aria-pressed={!open}
              aria-label="Collapse charts"
              title={open ? "Collapse charts" : "Show charts"}
              onClick={() => {
                setOpen(!open);
              }}
            >
              {open ? "⊟" : "⊞"}
            </button>
          </div>
          <Segmented
            label="Pending layout (demo)"
            caption="Pending layout"
            options={PENDING_LAYOUTS.map((id) => ({
              id,
              label: id.toUpperCase(),
              title: PENDING_LAYOUT_LABELS[id],
            }))}
            value={layout}
            onChange={setLayout}
          />
          <BlocksMenu dock={dock} skip={layout === "e" ? undefined : "lab:pending"} />
          <LayoutsMenu onApply={onApply} />
          <div className="lab-switches">
            <Toggle label="Baseline" checked={lab.baseline} onChange={lab.setBaseline} />
            <Toggle
              label="Tags on cards"
              checked={tags}
              onChange={setTags}
              hidden={view === "rows"}
            />
            <Toggle label="Show cut" checked={lab.showCut} onChange={lab.setShowCut} />
          </div>
        </div>
        {layout === "b" && <PendingStrip lab={lab} tags={tags} />}
      </header>
      <div className="lab-dock">
        {open ? (
          <DockBlocks
            lab={lab}
            dock={dock}
            pending={layout === "e" ? <PendingBlockBody lab={lab} tags={tags} /> : undefined}
          />
        ) : (
          <button
            type="button"
            className="lab-dock-bar"
            onClick={() => {
              setOpen(true);
            }}
          >
            Charts · {dock.order.length - dock.hidden.size} blocks · show
          </button>
        )}
      </div>
      <div className="lab-floor">
        <section className="lab-pile" aria-label="Draft" {...lab.zone("draft")}>
          <header className="lab-pile-head">
            <h2>Draft</h2>
            <div className="lab-pile-tools">
              <Segmented
                label="Card layout"
                options={[
                  { id: "columns", label: "Columns" },
                  { id: "rows", label: "Rows" },
                ]}
                value={view}
                onChange={setView}
              />
              <AxisTabs lab={lab} />
              <SortMenu keys={lab.sort} onChange={lab.setSort} />
            </div>
          </header>
          {pile(draft, false)}
        </section>
        {layout === "c" && (
          <PendingGutter lab={lab} tags={tags} open={gutterOpen} setOpen={setGutterOpen} />
        )}
        <section
          className="lab-pile"
          data-pile="prospects"
          aria-label="Prospects"
          {...lab.zone("prospect")}
        >
          <header className="lab-pile-head">
            <h2>
              Prospects <span className="muted">{prospects.length}</span>
            </h2>
          </header>
          {pile(prospects, true)}
        </section>
      </div>
      <Preview hover={lab.hover} />
    </div>
  );
}

function LabRoot({ onApply }: { onApply: () => void }): ReactNode {
  const lab = useLab();
  if (!lab) {
    return <p className="muted">Loading cube…</p>;
  }
  return <LabView lab={lab} onApply={onApply} />;
}

export function LabPage(): ReactNode {
  const [round, setRound] = useState(0);
  return (
    <LabRoot
      key={round}
      onApply={() => {
        setRound(round + 1);
      }}
    />
  );
}
