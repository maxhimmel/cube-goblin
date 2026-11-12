import type { ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";
import { SortMenu } from "../sort-chain.tsx";
import { Preview } from "../strip.tsx";
import { useRemembered } from "../view-choices.ts";
import { mode } from "#mode";
import { CardColumns, CardImages, CardRows } from "./cards.tsx";
import type { Dock } from "./dock.tsx";
import { BlocksMenu, DOCKS, DockBlocks, useDockState } from "./dock.tsx";
import { LayoutsMenu } from "./layouts-menu.tsx";
import { PendingGutter, usePendingOpen } from "./pending.tsx";
import { AxisTabs, DraftCount, QueryBar, Segmented, Toggle } from "./toolbar.tsx";
import type { Lab } from "./use-lab.ts";
import { useLab } from "./use-lab.ts";

type CardView = "columns" | "rows" | "images";

const DOCK_ARROWS: Record<Dock, string> = { top: "↑", right: "→", bottom: "↓", left: "←" };

function LabView({ lab, onApply }: { lab: Lab; onApply: () => void }): ReactNode {
  const [dockAt, setDockAt] = useRemembered<Dock>("labc.dockAt", "top", z.enum(DOCKS));
  const [tags, setTags] = useRemembered("labc.stripTags", false, z.boolean());
  const [open, setOpen] = useRemembered("labc.dockOpen", true, z.boolean());
  const [view, setView] = useRemembered<CardView>(
    "labc.view",
    "columns",
    z.enum(["columns", "rows", "images"]),
  );
  const dock = useDockState();
  const [pendingOpen, setPendingOpen] = usePendingOpen();
  const draft = lab.cards.filter((card) => card.status === "draft");
  const prospects = lab.cards.filter((card) => card.status !== "draft");
  const pile = (cards: typeof draft, compact: boolean): ReactNode =>
    view === "columns" ? (
      <CardColumns lab={lab} cards={cards} compact={compact} tags={tags} />
    ) : view === "rows" ? (
      <CardRows lab={lab} cards={cards} />
    ) : (
      <CardImages lab={lab} cards={cards} compact={compact} />
    );
  return (
    <div
      className="lab"
      data-dock={dockAt}
      data-dock-open={open ? "" : undefined}
      data-pending-open={pendingOpen ? "" : undefined}
      {...lab.dragRoot}
    >
      <header className="lab-top">
        <h1>Forge</h1>
        <DraftCount lab={lab} />
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
          <BlocksMenu dock={dock} />
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
      </header>
      <div className="lab-dock">
        {open ? (
          <DockBlocks lab={lab} dock={dock} />
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
                  { id: "images", label: "Images" },
                ]}
                value={view}
                onChange={setView}
              />
              <AxisTabs lab={lab} />
              <SortMenu keys={lab.sort} onChange={lab.setSort} />
            </div>
          </header>
          {view === "images" && <mode.BulkBar />}
          {pile(draft, false)}
        </section>
        <PendingGutter lab={lab} tags={tags} open={pendingOpen} setOpen={setPendingOpen} />
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

export function ForgePage(): ReactNode {
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
